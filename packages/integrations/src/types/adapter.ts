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
import type { TokenSet } from "./oauth.js";
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

// ─── Adapter UI Manifest ───────────────────────────────────────────────────

/**
 * Connection flow the host application should expose to users.
 */
export type ConnectionFlow = "oauth" | "credentials" | "none";

/**
 * Select option label/value pair.
 */
export interface UiChoice {
  value: string;
  label: string;
}

/**
 * Optional source descriptor for paged or dynamically-resolved choices.
 */
export interface UiChoiceSource {
  key: string;
  pageSize?: number;
}

/**
 * Shared field primitive used by connection and configuration surfaces.
 */
export interface UiField {
  /** Stable field identifier — used as the key when submitting values. */
  key: string;
  /** User-facing label shown above the input. */
  label: string;
  /** UI control type. */
  type:
    | "text"
    | "secret"
    | "url"
    | "select"
    | "multiselect"
    | "bool"
    | "textarea"
    | "number";
  helpText?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: unknown;
  choices?: UiChoice[];
  choiceSource?: UiChoiceSource;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
}

/**
 * Connection-surface manifest.
 *
 * Use `flow` for adapters with a single connection mode.
 * Use `flows` when multiple connection modes are available.
 */
export interface ConnectionSurfaceManifest {
  flow?: ConnectionFlow;
  flows?: ConnectionFlow[];
  submitLabel?: string;
  fields?: UiField[];
}

/**
 * Reusable configuration surface for shared or resource-specific settings.
 */
export interface ConfigSurfaceManifest {
  submitLabel?: string;
  fields: UiField[];
}

/**
 * General-purpose UI manifest that host applications can compose with
 * their own persistence and transport layers.
 */
export interface AdapterUiManifest {
  connection: ConnectionSurfaceManifest;
  sharedConfig?: ConfigSurfaceManifest;
  resourceConfig?: ConfigSurfaceManifest;
}

/**
 * Page of select choices returned by an adapter-level resolver.
 */
export interface ChoicePage {
  choices: UiChoice[];
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Context provided when resolving paged choices for a UI field.
 */
export interface ChoiceResolverContext {
  tokens: TokenSet;
  scope?: Record<string, unknown>;
  cursor?: string;
  limit?: number;
  query?: string;
}

/**
 * UI capabilities exposed by an adapter instance.
 */
export interface AdapterUi {
  manifest: AdapterUiManifest;
  listChoices?: (
    sourceKey: string,
    ctx: ChoiceResolverContext,
  ) => Promise<ChoicePage>;
}

/**
 * Static UI snapshot exposed by adapter definitions and hub listings.
 */
export interface AdapterUiInfo {
  manifest: AdapterUiManifest;
}

/**
 * Capability subset available to adapter-level choice resolvers.
 */
export interface AdapterUiCapabilities {
  sourceControl?: SourceControlCapability;
  messaging?: MessagingCapability;
  issueTracking?: IssueTrackingCapability;
  appStore?: AppStoreCapability;
  monitoring?: MonitoringCapability;
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

  /** General-purpose UI manifest and optional choice resolver. */
  readonly ui?: AdapterUi;

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
