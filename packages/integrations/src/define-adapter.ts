/**
 * defineAdapter — helper for type-safe adapter factory functions.
 *
 * Inspired by the Chat SDK's defineAdapter pattern:
 * - Each provider package calls defineAdapter() to create its factory.
 * - The factory is a pure function: config → IntegrationAdapter.
 * - Adapters hold configuration, not runtime state.
 *
 * Usage:
 * ```typescript
 * export const createGithubAdapter = defineAdapter<GithubAdapterConfig>({
 *   id: 'github',
 *   name: 'GitHub',
 *   capabilities: ['source-control'] as const,
 *   tokenMetadata: { expiresInSeconds: 3600, refreshable: true, rotatesRefreshToken: false, requiresRefreshLock: false },
 *   createOAuthHandler: (config) => createGithubOAuth(config),
 *   createWebhookHandler: (config) => createGithubWebhook(config),
 *   createSourceControl: (config) => createGithubSourceControl(config),
 * });
 * ```
 */

import type {
  AdapterCapability,
  AdapterContext,
  AdapterMetadata,
  IntegrationAdapter,
  TokenMetadata,
} from './types/adapter.js';
import type { OAuthHandler } from './types/oauth.js';
import type { WebhookHandler } from './types/webhook.js';
import type { SourceControlCapability } from './types/capabilities/source-control.js';
import type { MessagingCapability } from './types/capabilities/messaging.js';
import type { IssueTrackingCapability } from './types/capabilities/issue-tracking.js';
import type { AppStoreCapability } from './types/capabilities/app-store.js';

export interface AdapterDefinition<TConfig> {
  id: string;
  name: string;
  /** Descriptive metadata: icon, description, dateAdded, category, docsUrl, websiteUrl. */
  metadata?: AdapterMetadata;
  capabilities: readonly AdapterCapability[];
  tokenMetadata: TokenMetadata;

  createOAuthHandler(config: TConfig): OAuthHandler;
  createWebhookHandler(config: TConfig): WebhookHandler;

  // Capability factories — only required if the capability is declared
  createSourceControl?(config: TConfig): SourceControlCapability;
  createMessaging?(config: TConfig): MessagingCapability;
  createIssueTracking?(config: TConfig): IssueTrackingCapability;
  createAppStore?(config: TConfig): AppStoreCapability;

  // Lifecycle hooks
  onRegister?(config: TConfig, context: AdapterContext): void | Promise<void>;
  onReady?(config: TConfig, context: AdapterContext): void | Promise<void>;
  onShutdown?(config: TConfig): void | Promise<void>;
}

/**
 * Metadata-only snapshot of an adapter definition.
 * Available on the factory function as `.definition` — no config required.
 */
export interface AdapterDefinitionInfo {
  readonly id: string;
  readonly name: string;
  readonly metadata?: AdapterMetadata;
  readonly capabilities: readonly AdapterCapability[];
  readonly tokenMetadata: TokenMetadata;
}

/**
 * Factory function returned by `defineAdapter`.
 * Carries a `.definition` property with the adapter's static metadata.
 */
export interface AdapterFactory<TConfig> {
  (config: TConfig): IntegrationAdapter<TConfig>;
  /** Static metadata — always available, no config required. */
  readonly definition: AdapterDefinitionInfo;
}

/**
 * Create a type-safe adapter factory function from a definition object.
 * Returns a function `(config: TConfig) => IntegrationAdapter` with a
 * `.definition` property that exposes the adapter's metadata without
 * needing credentials / config.
 */
export function defineAdapter<TConfig>(
  definition: AdapterDefinition<TConfig>,
): AdapterFactory<TConfig> {
  const factory = (config: TConfig): IntegrationAdapter<TConfig> => {
    const adapter: IntegrationAdapter<TConfig> = {
      id: definition.id,
      name: definition.name,
      metadata: definition.metadata,
      capabilities: definition.capabilities,
      tokenMetadata: definition.tokenMetadata,

      oauth: definition.createOAuthHandler(config),
      webhook: definition.createWebhookHandler(config),

      sourceControl: definition.capabilities.includes('source-control')
        ? definition.createSourceControl?.(config)
        : undefined,

      messaging: definition.capabilities.includes('messaging')
        ? definition.createMessaging?.(config)
        : undefined,

      issueTracking: definition.capabilities.includes('issue-tracking')
        ? definition.createIssueTracking?.(config)
        : undefined,

      appStore: definition.capabilities.includes('app-store')
        ? definition.createAppStore?.(config)
        : undefined,

      supports(capability: AdapterCapability): boolean {
        return (this.capabilities as readonly string[]).includes(capability);
      },

      async onRegister(context: AdapterContext) {
        return definition.onRegister?.(config, context);
      },

      async onReady(context: AdapterContext) {
        return definition.onReady?.(config, context);
      },

      async onShutdown() {
        return definition.onShutdown?.(config);
      },
    };

    return adapter;
  };

  // Attach static metadata onto the factory function
  Object.defineProperty(factory, 'definition', {
    value: Object.freeze({
      id: definition.id,
      name: definition.name,
      metadata: definition.metadata,
      capabilities: definition.capabilities,
      tokenMetadata: definition.tokenMetadata,
    }),
    writable: false,
    enumerable: true,
    configurable: false,
  });

  return factory as AdapterFactory<TConfig>;
}
