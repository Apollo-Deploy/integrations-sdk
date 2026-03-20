import { describe, test, expect } from "bun:test";
import crypto from "node:crypto";
import { generateAppleJWT } from "../src/oauth";

// Generate a real ES256 key pair for testing
function generateTestKeyPair() {
  return crypto.generateKeyPairSync("ec", {
    namedCurve: "P-256",
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
}

function base64urlDecode(str: string): unknown {
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  return JSON.parse(
    Buffer.from(
      padded.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    ).toString("utf8"),
  );
}

describe("generateAppleJWT", () => {
  test("produces a valid 3-part JWT", () => {
    const { privateKey } = generateTestKeyPair();
    const config = { issuerId: "test-issuer", keyId: "ABCDEF1234", privateKey };

    const jwt = generateAppleJWT(config);
    const parts = jwt.split(".");
    expect(parts).toHaveLength(3);
  });

  test("header contains correct alg, kid, and typ", () => {
    const { privateKey } = generateTestKeyPair();
    const config = { issuerId: "test-issuer", keyId: "ABCDEF1234", privateKey };

    const jwt = generateAppleJWT(config);
    const [header] = jwt.split(".");
    const decoded = base64urlDecode(header) as Record<string, string>;

    expect(decoded.alg).toBe("ES256");
    expect(decoded.kid).toBe("ABCDEF1234");
    expect(decoded.typ).toBe("JWT");
  });

  test("payload contains iss, iat, exp, and aud", () => {
    const { privateKey } = generateTestKeyPair();
    const config = {
      issuerId: "MY-ISSUER-ID",
      keyId: "ABCDEF1234",
      privateKey,
    };

    const beforeMs = Math.floor(Date.now() / 1000);
    const jwt = generateAppleJWT(config);
    const afterMs = Math.floor(Date.now() / 1000);

    const [, payloadPart] = jwt.split(".");
    const payload = base64urlDecode(payloadPart) as Record<string, unknown>;

    expect(payload.iss).toBe("MY-ISSUER-ID");
    expect(payload.aud).toBe("appstoreconnect-v1");
    expect(typeof payload.iat).toBe("number");
    expect(typeof payload.exp).toBe("number");
    expect(payload.iat as number).toBeGreaterThanOrEqual(beforeMs);
    expect(payload.iat as number).toBeLessThanOrEqual(afterMs);
    expect((payload.exp as number) - (payload.iat as number)).toBe(1200); // 20 minutes
  });

  test("signature is verifiable with corresponding public key", () => {
    const { privateKey, publicKey } = generateTestKeyPair();
    const config = { issuerId: "test-issuer", keyId: "ABCDEF1234", privateKey };

    const jwt = generateAppleJWT(config);
    const [header, payloadPart, sig] = jwt.split(".");
    const signingInput = `${header}.${payloadPart}`;

    const padded = sig + "=".repeat((4 - (sig.length % 4)) % 4);
    const sigBuf = Buffer.from(
      padded.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    );

    const verify = crypto.createVerify("SHA256");
    verify.update(signingInput);
    expect(verify.verify(publicKey, sigBuf)).toBe(true);
  });

  test("different issuerIds produce different JWTs", () => {
    const { privateKey } = generateTestKeyPair();
    const jwt1 = generateAppleJWT({
      issuerId: "issuer-1",
      keyId: "KEY1",
      privateKey,
    });
    const jwt2 = generateAppleJWT({
      issuerId: "issuer-2",
      keyId: "KEY1",
      privateKey,
    });
    expect(jwt1).not.toBe(jwt2);
  });
});
