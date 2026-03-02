/**
 * Adapter capability identifiers.
 * These map to the capability interfaces an adapter may implement.
 */
export type AdapterCapability = 'source-control' | 'messaging' | 'issue-tracking' | 'ci-cd' | 'app-store';

import type { OAuthHandler } from './oauth.js';
import type { WebhookHandler } from './webhook.js';
import type { SourceControlCapability } from './capabilities/source-control.js';
import type { MessagingCapability } from './capabilities/messaging.js';
import type { IssueTrackingCapability } from './capabilities/issue-tracking.js';
import type { AppStoreCapability } from './capabilities/app-store.js';
import type { CryptoProvider } from '../crypto.js';
import type { IntegrationEvent } from './models.js';

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

/**
 * Descriptive metadata about an adapter — used for display, discovery, and auditing.
 */
export interface AdapterMetadata {
  /**
   * URL or data-URI for the provider's logo/icon.
   * Recommended: SVG or 64×64 PNG.
   */
  iconUrl?: string;

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
