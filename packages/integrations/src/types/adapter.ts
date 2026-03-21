/**
 * Adapter capability identifiers.
 * These map to the capability interfaces an adapter may implement.
 */
export type AdapterCapability =
  | "source-control"
  | "messaging"
  | "issue-tracking"
  | "ci-cd"
  | "app-store"
  | "monitoring";

import type { OAuthHandler } from "./oauth.js";
import type { WebhookHandler } from "./webhook.js";
import type { SourceControlCapability } from "./capabilities/source-control.js";
import type { MessagingCapability } from "./capabilities/messaging.js";
import type { IssueTrackingCapability } from "./capabilities/issue-tracking.js";
import type { AppStoreCapability } from "./capabilities/app-store.js";
import type { MonitoringCapability } from "./capabilities/monitoring.js";
import type { CryptoProvider } from "../crypto.js";
import type { IntegrationEvent } from "./models/index.js";

/** Minimal logger interface — compatible with Fastify's logger and pino. */
export interface Logger {
  debug(obj: object | string, msg?: string): void;
  info(obj: object | string, msg?: string): void;
  warn(obj: object | string, msg?: string): void;
  error(obj: object | string, msg?: string): void;
  child(bindings: Record<string, unknown>): Logger;
}

/**
 * Context provided to adapters during lifecycle hooks and event emissions.
 */
export interface AdapterContext {
  logger: Logger;
  crypto: CryptoProvider;
  emitEvent: (event: IntegrationEvent) => Promise<void>;
}

// ─── Auth Method & Setup Flow ────────────────────────────────────────────────

/**
 * Internal authentication mechanism the adapter uses.
 *
 * - `oauth2`          — Standard OAuth 2.0 authorization-code flow.
 * - `api_key`         — Static API key or personal-access token.
 * - `webhook_secret`  — Inbound webhook with a shared HMAC secret.
 * - `basic`           — Username + password (HTTP Basic or equivalent).
 * - `pat`             — Personal Access Token (provider-issued, not OAuth).
 * - `none`            — No credentials required (public / unauthenticated APIs).
 */
export type AuthMethod =
  | "oauth2"
  | "api_key"
  | "webhook_secret"
  | "basic"
  | "pat"
  | "none";

/**
 * A single credential field the connect UI must render.
 */
export interface CredentialInputField {
  /** Stable field identifier — used as the key when submitting credentials. */
  key: string;
  /** User-facing label shown above the input. */
  label: string;
  /**
   * UI control type:
   * - `text`         — Plain single-line text input.
   * - `password`     — Masked text input (secrets, tokens).
   * - `url`          — URL input with validation.
   * - `select`       — Dropdown; requires `options`.
   * - `textarea`     — Multi-line text area (JSON configs, keys).
   */
  type: "text" | "password" | "url" | "select" | "textarea";
  required: boolean;
  placeholder?: string;
  /** Short help copy rendered below the input. */
  helpText?: string;
  /** Only for `type: 'select'`. */
  options?: { value: string; label: string }[];

  // ── Client-side validation ──────────────────────────────────────────────

  /** Regex pattern the value must match (applied client-side). */
  pattern?: string;
  /** Minimum string length. */
  minLength?: number;
  /** Maximum string length. */
  maxLength?: number;
}

/**
 * A single field in an integration's runtime configuration schema.
 * Consumers use this to build a settings form for a connected integration.
 */
export interface ConfigField {
  /** Stable key used when persisting the config value. */
  key: string;
  /** User-facing label shown above the input. */
  label: string;
  /** Optional longer description rendered as help text. */
  description?: string;
  /** UI control type. */
  type: "text" | "select" | "boolean" | "number";
  required: boolean;
  /** Options for `type: 'select'`. */
  options?: { value: string; label: string }[];
  /**
   * When `true`, options are fetched at runtime from the integration
   * rather than being statically declared here.
   */
  dynamic?: boolean;
}

/**
 * Authentication configuration declared by an adapter.
 */
export interface AdapterAuthConfig {
  /** Authentication mechanism — drives what the UI renders. */
  method: AuthMethod;
  /**
   * Credential fields to render in the connect UI.
   * Omit for pure OAuth flows.
   */
  fields?: CredentialInputField[];
  /**
   * OAuth scopes requested during authorization.
   * Server-only — never serialised to the client.
   */
  oauthScopes?: string[];
}

/**
 * Client-safe subset of `AdapterAuthConfig`.
 * Exposed via the listing endpoint — contains only what the UI needs.
 *
 * UI rendering rules:
 *   method="oauth2", no fields → OAuth button only
 *   method="oauth2" + fields   → mode picker (OAuth | form)
 *   any other method + fields  → form only
 */
export interface ClientAuthConfig {
  method: AuthMethod;
  fields?: CredentialInputField[];
}

// ─── Adapter Metadata ─────────────────────────────────────────────────────────

/**
 * Descriptive metadata about an adapter — used for display, discovery, and auditing.
 */
export interface AdapterMetadata {
  /**
   * URL or data-URI for the provider's logo/icon.
   * Recommended: SVG or 64×64 PNG.
   *
   * Can be a single URL used for all themes, or an object with separate
   * `light` and `dark` variants for theme-aware display.
   */
  iconUrl?: string | { light: string; dark: string };

  /** One-sentence description of what the integration does. */
  description?: string;

  /**
   * ISO 8601 date string indicating when this adapter was added to the SDK.
   * @example '2024-01-15'
   */
  dateAdded?: string;

  /**
   * High-level category for grouping adapters in a UI.
   * @example 'Source Control', 'Messaging', 'Project Management', 'App Stores'
   */
  category?: string;

  /** Link to the provider's developer docs or OAuth app setup guide. */
  docsUrl?: string;

  /** Link to the provider's marketing / home page. */
  websiteUrl?: string;

  /**
   * Authentication method and credential input specification for this integration.
   * When omitted the hub defaults to `{ method: 'oauth2' }` at runtime,
   * since all current adapters implement the OAuth handler interface.
   */
  auth?: AdapterAuthConfig;

  /**
   * Schema for runtime configuration fields shown after the integration is connected.
   * Use this to let users configure the integration's behaviour (e.g. default repo, channel).
   * Omit when no post-connection configuration is needed.
   */
  configSchema?: ConfigField[];
}

/**
 * Token lifecycle metadata — drives refresh scheduling and locking strategy.
 */
export interface TokenMetadata {
  /** Null means the token never expires (GitHub OAuth bot tokens, Discord bot tokens). */
  expiresInSeconds: number | null;
  /** Whether a refresh flow exists for this provider. */
  refreshable: boolean;
  /** Jira: refresh tokens rotate on each use — require atomic swap. */
  rotatesRefreshToken: boolean;
  /** Whether a distributed lock must be held during token refresh. */
  requiresRefreshLock: boolean;
}

/**
 * IntegrationAdapter — the contract every provider adapter must satisfy.
 *
 * Adapters are created via factory functions: createGithubAdapter(), not new GithubAdapter().
 * The `defineAdapter` helper enforces this pattern.
 *
 * Rule: adapters are stateless. Tokens are passed as parameters. Adapters hold config, not state.
 */
export interface IntegrationAdapter<_TConfig = unknown> {
  /** Unique adapter identifier: 'github', 'slack', 'jira', 'linear', 'gitlab', 'discord' */
  readonly id: string;

  /** Human-readable name: 'GitHub', 'Slack', etc. */
  readonly name: string;

  /** Descriptive metadata: icon, description, dateAdded, category, etc. */
  readonly metadata?: AdapterMetadata;

  /** Declared capabilities this adapter supports. */
  readonly capabilities: readonly AdapterCapability[];

  /** OAuth flow handler. */
  readonly oauth: OAuthHandler;

  /** Inbound webhook ingestion handler. */
  readonly webhook: WebhookHandler;

  /** Source-control capability implementation. Present only if declared in capabilities. */
  readonly sourceControl?: SourceControlCapability;

  /** Messaging capability implementation. Present only if declared in capabilities. */
  readonly messaging?: MessagingCapability;

  /** Issue-tracking capability implementation. Present only if declared in capabilities. */
  readonly issueTracking?: IssueTrackingCapability;

  /** App store capability implementation. Present only if declared in capabilities. */
  readonly appStore?: AppStoreCapability;

  /** Monitoring capability implementation (errors, vitals, logs). Present only if declared in capabilities. */
  readonly monitoring?: MonitoringCapability;

  /** Token lifecycle metadata — drives refresh scheduling. */
  readonly tokenMetadata: TokenMetadata;

  /** Type guard for runtime capability checking. */
  supports(capability: AdapterCapability): boolean;

  // ── Lifecycle Hooks ────────────────────────────────────────────────────────
  /** Called when adapter is registered with the hub. */
  onRegister?(context: AdapterContext): void | Promise<void>;
  /** Called after all adapters are registered and the hub is ready. */
  onReady?(context: AdapterContext): void | Promise<void>;
  /** Called during graceful shutdown. */
  onShutdown?(): void | Promise<void>;
}
