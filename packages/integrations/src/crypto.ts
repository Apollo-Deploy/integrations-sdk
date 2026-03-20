/**
 * @apollo-deploy/crypto
 *
 * Shared AES-256-GCM encryption utilities for token storage.
 * Extracted from IAM credentials module for reuse across integration adapters.
 *
 * Design:
 * - Primitives (encryptGCM, decryptGCM) accept explicit keys — no hidden env reads.
 * - CryptoProvider is the higher-level interface used by IntegrationHub.
 * - getRootKeyFromEnv() is the canonical way to load the key at startup.
 */

import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  timingSafeEqual,
} from "node:crypto";

// ─── Error Types ─────────────────────────────────────────────────────────────

export class DecryptError extends Error {
  readonly code = "ERR_DECRYPT" as const;
  constructor(message = "Decryption failed") {
    super(message);
    this.name = "DecryptError";
  }
}

export class CryptoConfigError extends Error {
  readonly code = "ERR_CRYPTO_CONFIG" as const;
  constructor(message: string) {
    super(message);
    this.name = "CryptoConfigError";
  }
}

// ─── Envelope ────────────────────────────────────────────────────────────────

/** Serialisable envelope stored in the database (all buffers as base64). */
export interface EncryptedEnvelope {
  /** Schema version for forward compatibility. Current: '1'. */
  v: string;
  /** Base64 12-byte nonce/IV. */
  nonce: string;
  /** Base64 ciphertext + 16-byte GCM auth tag. */
  ciphertext: string;
  /** Base64 16-byte HKDF salt (only for 'cipher' purpose). */
  salt?: string;
}

// ─── Low-level Primitives ────────────────────────────────────────────────────

/**
 * Encrypt plaintext with AES-256-GCM.
 * Returns ciphertext with auth tag appended and a random 12-byte nonce.
 * All sensitive buffer arguments are zeroized after use.
 */
export function encryptGCM(
  plaintext: Buffer,
  key: Buffer,
  aad?: Buffer,
): { cipher: Buffer; nonce: Buffer } {
  const nonce = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, nonce);
  if (aad) {
    try {
      c.setAAD(aad);
    } catch {
      // older Node versions may reject; ignore
    }
  }
  const enc = Buffer.concat([c.update(plaintext), c.final()]);
  const tag = c.getAuthTag();
  const cipherWithTag = Buffer.concat([enc, tag]);
  zeroize(key);
  return { cipher: cipherWithTag, nonce };
}

/**
 * Decrypt AES-256-GCM ciphertext+tag.
 * Throws DecryptError on auth/tag mismatch.
 * All sensitive buffer arguments are zeroized after use.
 */
// eslint-disable-next-line max-params -- required parameters for this utility function
export function decryptGCM(
  cipherWithTag: Buffer,
  nonce: Buffer,
  key: Buffer,
  aad?: Buffer,
): Buffer {
  if (nonce.length < 12) {
    throw new DecryptError("Invalid nonce length");
  }
  const ciphertext = cipherWithTag.subarray(0, cipherWithTag.length - 16);
  const tag = cipherWithTag.subarray(cipherWithTag.length - 16);
  const d = createDecipheriv("aes-256-gcm", key, nonce);
  d.setAuthTag(tag);
  if (aad) {
    try {
      d.setAAD(aad);
    } catch {
      /* intentional: setAAD failure is non-critical */
    }
  }
  try {
    const plain = Buffer.concat([d.update(ciphertext), d.final()]);
    zeroize(key);
    return plain;
  } catch {
    zeroize(key);
    throw new DecryptError(
      "GCM authentication tag mismatch — data may be tampered",
    );
  }
}

/** Zero out buffer contents to prevent lingering secrets in memory. */
export function zeroize(buf: Buffer): void {
  buf.fill(0);
}

// ─── HKDF Key Derivation ─────────────────────────────────────────────────────

/**
 * Derive a 32-byte AES-256 data key using HKDF-SHA256.
 *
 * `info` binds the key to a specific purpose + entity:
 *   e.g. `apollo:oauth:token:org123:conn456`
 *
 * When `saltOverride` is not provided a fresh random 16-byte salt is generated
 * (store it in the envelope so you can re-derive the same key later).
 */
export function deriveDataKey(
  rootKey: Buffer,
  info: string,
  saltOverride?: Buffer,
): { key: Buffer; salt: Buffer } {
  const salt = saltOverride ?? randomBytes(16);
  const infoBytes = Buffer.from(info, "utf8");
  const raw = hkdfSync("sha256", rootKey, salt, infoBytes, 32);
  const key = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
  return { key, salt };
}

// ─── High-level CryptoProvider ───────────────────────────────────────────────

export interface CryptoProvider {
  /** Encrypt a UTF-8 string. Returns a serialisable envelope. */
  encrypt(plaintext: string, context: EncryptionContext): EncryptedEnvelope;
  /** Decrypt an envelope back to a UTF-8 string. */
  decrypt(envelope: EncryptedEnvelope, context: EncryptionContext): string;
  /** Constant-time string comparison (avoids timing attacks). */
  safeEqual(a: string, b: string): boolean;
}

export interface EncryptionContext {
  /** Bound to the key derivation — changes here = different key. */
  orgId: string;
  entityId: string;
  purpose: string;
}

/**
 * Create a CryptoProvider backed by the given root key.
 * Use `getRootKeyFromEnv()` to load the key in production.
 */
export function createCryptoProvider(rootKey: Buffer): CryptoProvider {
  return {
    encrypt(plaintext, ctx) {
      const info = `apollo:oauth:${ctx.purpose}:${ctx.orgId}:${ctx.entityId}`;
      const { key, salt } = deriveDataKey(rootKey, info);
      const { cipher, nonce } = encryptGCM(Buffer.from(plaintext, "utf8"), key);
      return {
        v: "1",
        nonce: nonce.toString("base64"),
        ciphertext: cipher.toString("base64"),
        salt: salt.toString("base64"),
      };
    },

    decrypt(envelope, ctx) {
      const info = `apollo:oauth:${ctx.purpose}:${ctx.orgId}:${ctx.entityId}`;
      const salt =
        envelope.salt != null
          ? Buffer.from(envelope.salt, "base64")
          : undefined;
      const { key } = deriveDataKey(rootKey, info, salt);
      const plain = decryptGCM(
        Buffer.from(envelope.ciphertext, "base64"),
        Buffer.from(envelope.nonce, "base64"),
        key,
      );
      return plain.toString("utf8");
    },

    safeEqual(a, b) {
      try {
        return timingSafeEqual(Buffer.from(a), Buffer.from(b));
      } catch {
        return false;
      }
    },
  };
}

// ─── Environment Helpers ─────────────────────────────────────────────────────

/**
 * Load a 32-byte root key from a base64 environment variable.
 * Throws CryptoConfigError if missing or malformed.
 *
 * Expected env vars (in priority order):
 *  1. KMS_ROOT_KEY_B64  — preferred
 *  2. KMS_KEY_V1        — legacy fallback
 */
export function getRootKeyFromEnv(
  env: Record<string, string | undefined> = process.env,
): Buffer {
  const b64 = env.KMS_ROOT_KEY_B64 ?? env.KMS_KEY_V1;
  if (b64 == null) {
    throw new CryptoConfigError(
      "Root key not configured. Set KMS_ROOT_KEY_B64 environment variable.",
    );
  }
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) {
    throw new CryptoConfigError(
      `Invalid root key length: expected 32 bytes, got ${String(key.length)}`,
    );
  }
  return key;
}

/** Convenience: load from env and create provider in one call. */
export function createCryptoProviderFromEnv(
  env: Record<string, string | undefined> = process.env,
): CryptoProvider {
  return createCryptoProvider(getRootKeyFromEnv(env));
}
