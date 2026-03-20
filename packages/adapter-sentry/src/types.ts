/**
 * Sentry adapter configuration.
 *
 * Authentication: auth token (Bearer), generated in Sentry → Settings → Auth Tokens.
 * Scope requirements for full capability coverage:
 *   org:read, org:write, project:read, project:write, project:releases,
 *   team:read, member:read, event:read, event:write, event:admin,
 *   alerts:read, alerts:write, releases (legacy scope)
 *
 * For webhook inbound events, configure the DSN Signing Secret in Sentry's
 * integration settings — passed as `webhookSecret` here.
 */

import type {
  MonitoringCapability,
  TokenSet,
  Paginated,
} from "@apollo-deploy/integrations";

export interface SentryAdapterConfig {
  /**
   * Sentry auth token (Bearer).
   * Generate at https://sentry.io/settings/account/api/auth-tokens/
   * Required scopes: org:read, project:read, event:read, alerts:read, releases
   */
  authToken: string;

  /**
   * Default organization slug.
   * Used when orgSlug is not provided to capability methods.
   * Most capability methods accept an explicit orgSlug that overrides this.
   */
  defaultOrgSlug?: string;

  /**
   * Optional: base URL override for self-hosted Sentry instances.
   * @default 'https://sentry.io'
   */
  baseUrl?: string;

  /**
   * HMAC-SHA256 webhook signing secret.
   * Configure in Sentry → Settings → Integrations → your integration → Webhooks.
   * Used to verify inbound webhook signatures (sentry-hook-signature header).
   */
  webhookSecret?: string;

  /**
   * Client ID for Sentry OAuth app (internal / public integrations).
   * Only required if using OAuth 2.0 flow instead of auth tokens.
   */
  clientId?: string;

  /**
   * Client secret for Sentry OAuth app.
   * Only required if using OAuth 2.0 flow instead of auth tokens.
   */
  clientSecret?: string;
}

// ─── Sentry-specific model extensions ────────────────────────────────────────

/** Sentry SDK client key (DSN). Not a generic monitoring concept. */
export interface SentryDsnKey {
  id: string;
  name: string;
  label: string;
  public: string;
  secret: string;
  projectId: number;
  isActive: boolean;
  dsn: {
    public: string;
    secret: string;
    csp: string;
    security: string;
    minidump: string;
    unreal: string;
    crons: string;
  };
  browserSdkVersion: string;
  dateCreated: Date;
}

/** Sentry event ingestion statistics. */
export interface SentryStats {
  /** Array of [unix_timestamp, value] tuples. */
  data: [number, { count: number }[]][];
}

export interface SentryStatsQueryOpts {
  project?: string | number;
  environment?: string;
  stat?: "received" | "rejected" | "blacklisted" | "generated";
  since?: number; // unix timestamp
  until?: number; // unix timestamp
  resolution?: "10s" | "1h" | "1d";
  groups?: string[];
}

/** Sentry debug information file (dSYM, ProGuard, source map, etc.). */
export interface SentryDebugFile {
  id: string;
  uuid: string;
  objectName: string;
  symbolType:
    | "macho"
    | "elf"
    | "pdb"
    | "pe"
    | "wasm"
    | "sourcemap"
    | "proguard"
    | "breakpad";
  codeId?: string;
  debugId?: string;
  size: number;
  sha1: string;
  dateCreated: Date;
}

export interface SentrySourceMapRelease {
  version: string;
  files: number;
  dateCreated: Date;
}

/** Sentry webhook installation payload. */
export interface SentryWebhookInstallation {
  uuid: string;
  app: { uuid: string; slug: string; name: string };
  organization: { slug: string };
}

export type SentryWebhookAction =
  | "created"
  | "resolved"
  | "assigned"
  | "ignored"
  | "unresolved"
  | "archived"
  | "escalating";

// ─── Sentry monitoring capability extension ───────────────────────────────────

/**
 * Extends the generic MonitoringCapability with Sentry-specific operations.
 * Use this type when you need direct access to Sentry-only features.
 */
export interface SentryMonitoringCapability extends MonitoringCapability {
  /** List client keys (DSNs) for a project. */
  listDsnKeys(
    tokens: TokenSet,
    orgSlug: string,
    projectSlug: string,
  ): Promise<SentryDsnKey[]>;

  /** Create a new client key (DSN) for a project. */
  createDsnKey(
    tokens: TokenSet,
    orgSlug: string,
    projectSlug: string,
    name: string,
  ): Promise<SentryDsnKey>;

  /** Retrieve event ingestion stats (received, rejected, blacklisted). */
  getStats(
    tokens: TokenSet,
    orgSlug: string,
    opts?: SentryStatsQueryOpts,
  ): Promise<SentryStats>;

  /** List uploaded debug information files (dSYMs, ProGuard, source maps). */
  listDebugFiles(
    tokens: TokenSet,
    orgSlug: string,
    projectSlug: string,
  ): Promise<Paginated<SentryDebugFile>>;

  /** Delete a debug file by ID. */
  deleteDebugFile(
    tokens: TokenSet,
    orgSlug: string,
    projectSlug: string,
    fileId: string,
  ): Promise<void>;
}
