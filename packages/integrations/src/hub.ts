/**
 * IntegrationHub — central coordinator for all integration adapters.
 *
 * Modeled after the Chat SDK's Chat class:
 * - Generic over adapter map for compile-time type safety
 * - Type-safe webhook routing: hub.webhooks.github(req) ← only exists if github is registered
 * - Event subscriptions via hub.onEvent()
 * - Capability discovery via hub.getAdaptersByCapability()
 */

import { UnknownAdapterError } from './errors.js';
import type {
  AdapterCapability,
  AdapterContext,
  AdapterMetadata,
  IntegrationAdapter,
  Logger,
} from './types/adapter.js';
import type { IntegrationEvent } from './types/models.js';
import type { CryptoProvider } from './crypto.js';

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface WebhookRequest {
  rawBody: Buffer;
  headers: Record<string, string>;
  body: unknown;
}

export interface WebhookResponse {
  statusCode: number;
  body?: unknown;
}

export interface WebhookHandlerOptions {
  /** Secret override — if not provided, the adapter's default config secret is used. */
  secret?: string;
  /** Async processing callback for serverless (waitUntil pattern). */
  waitUntil?: (promise: Promise<unknown>) => void;
}

export type EventHandler = (event: IntegrationEvent, context: EventContext) => Promise<void>;

export interface EventContext {
  hub: IntegrationHub;
  getAdapter<K extends string>(key: K): IntegrationAdapter;
  logger: Logger;
}

/**
 * Snapshot of static information about a registered adapter.
 * Returned by `hub.listAdapters()` for display, discovery, and auditing.
 */
export interface AdapterInfo {
  /** The key this adapter was registered under in the hub (e.g. 'github'). */
  key: string;
  /** Unique adapter identifier (mirrors `IntegrationAdapter.id`). */
  id: string;
  /** Human-readable name (mirrors `IntegrationAdapter.name`). */
  name: string;
  /** Declared capabilities. */
  capabilities: readonly AdapterCapability[];
  /** Descriptive metadata: icon, description, dateAdded, etc. */
  metadata: AdapterMetadata;
}

export interface HubConfig<TAdapters extends Record<string, IntegrationAdapter>> {
  adapters: TAdapters;
  crypto: CryptoProvider;
  logger: Logger;
}

/**
 * Type-safe webhook router.
 * hub.webhooks.github(req) only compiles if 'github' is in TAdapters.
 */
export type WebhookRouter<TAdapters extends Record<string, IntegrationAdapter>> = {
  [K in keyof TAdapters]: (
    request: WebhookRequest,
    options?: WebhookHandlerOptions,
  ) => Promise<WebhookResponse>;
};

// ─── Hub Implementation ───────────────────────────────────────────────────────

export class IntegrationHub<
  TAdapters extends Record<string, IntegrationAdapter> = Record<string, IntegrationAdapter>,
> {
  readonly adapters: TAdapters;
  readonly webhooks: WebhookRouter<TAdapters>;

  private readonly _eventHandlers: Map<string, EventHandler[]> = new Map();
  private readonly _wildcardHandlers: EventHandler[] = [];
  private readonly _context: Omit<AdapterContext, 'emitEvent'> & {
    emitEvent: (event: IntegrationEvent) => Promise<void>;
  };

  constructor(private readonly config: HubConfig<TAdapters>) {
    this.adapters = config.adapters;

    this._context = {
      logger: config.logger,
      crypto: config.crypto,
      emitEvent: async (event) => {
        await this._dispatch(event);
      },
    };

    // Build type-safe webhook router via Proxy
    this.webhooks = new Proxy({} as WebhookRouter<TAdapters>, {
      get: (_target, prop: string) => {
        return (request: WebhookRequest, options?: WebhookHandlerOptions) =>
          this._handleWebhook(prop, request, options);
      },
    });
  }

  // ── Adapter Access ────────────────────────────────────────────────────────

  /** Get a specific adapter by its registered key. */
  getAdapter<K extends keyof TAdapters>(key: K): TAdapters[K] {
    const adapter = this.adapters[key];
    if (!adapter) {
      throw new UnknownAdapterError(String(key));
    }
    return adapter;
  }

  /** Get all adapters that support a given capability. */
  getAdaptersByCapability(capability: AdapterCapability): IntegrationAdapter[] {
    return Object.values(this.adapters).filter((a) =>
      (a as IntegrationAdapter).supports(capability),
    );
  }

  /** Get an array of all registered adapter IDs. */
  getRegisteredAdapters(): string[] {
    return Object.keys(this.adapters);
  }

  /**
   * Return a snapshot of static info for every registered adapter.
   * Useful for building integration listings, onboarding UIs, or audit logs.
   */
  listAdapters(): AdapterInfo[] {
    return Object.entries(this.adapters).map(([key, adapter]) => {
      const a = adapter as IntegrationAdapter;
      return {
        key,
        id: a.id,
        name: a.name,
        capabilities: a.capabilities,
        metadata: a.metadata ?? {},
      };
    });
  }

  // ── Event Subscriptions ───────────────────────────────────────────────────

  /**
   * Register a handler for one or more event types.
   * Fires when any adapter emits a matching normalized event.
   */
  onEvent(eventTypeOrTypes: string | string[], handler: EventHandler): void {
    const types = Array.isArray(eventTypeOrTypes) ? eventTypeOrTypes : [eventTypeOrTypes];
    for (const type of types) {
      const existing = this._eventHandlers.get(type) ?? [];
      existing.push(handler);
      this._eventHandlers.set(type, existing);
    }
  }

  /** Register a wildcard handler that fires for every event. */
  onAnyEvent(handler: EventHandler): void {
    this._wildcardHandlers.push(handler);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** Initialize all adapters — call onRegister then onReady. */
  async initialize(): Promise<void> {
    const logger = this.config.logger;
    logger.info('IntegrationHub: initializing adapters');

    for (const [id, adapter] of Object.entries(this.adapters)) {
      const a = adapter as IntegrationAdapter;
      try {
        if (a.onRegister) {
          await a.onRegister(this._context);
        }
        logger.info({ adapterId: id }, 'IntegrationHub: adapter registered');
      } catch (err) {
        logger.error({ adapterId: id, err }, 'IntegrationHub: adapter onRegister failed');
        throw err;
      }
    }

    for (const [id, adapter] of Object.entries(this.adapters)) {
      const a = adapter as IntegrationAdapter;
      try {
        if (a.onReady) {
          await a.onReady(this._context);
        }
        logger.info({ adapterId: id }, 'IntegrationHub: adapter ready');
      } catch (err) {
        logger.error({ adapterId: id, err }, 'IntegrationHub: adapter onReady failed');
        throw err;
      }
    }

    logger.info(
      { adapters: this.getRegisteredAdapters() },
      'IntegrationHub: all adapters ready',
    );
  }

  /** Graceful shutdown — calls onShutdown on all adapters. */
  async shutdown(): Promise<void> {
    const logger = this.config.logger;
    logger.info('IntegrationHub: shutting down');

    await Promise.allSettled(
      Object.values(this.adapters).map(async (adapter) => {
        const a = adapter as IntegrationAdapter;
        if (a.onShutdown) {
          try {
            await a.onShutdown();
          } catch (err) {
            logger.error({ adapterId: a.id, err }, 'IntegrationHub: adapter onShutdown error');
          }
        }
      }),
    );
  }

  // ── Internal: Webhook Routing ─────────────────────────────────────────────

  private async _handleWebhook(
    adapterId: string,
    request: WebhookRequest,
    options?: WebhookHandlerOptions,
  ): Promise<WebhookResponse> {
    const adapter = (this.adapters as Record<string, IntegrationAdapter>)[adapterId];
    if (!adapter) {
      return { statusCode: 404, body: { error: `Unknown adapter: ${adapterId}` } };
    }

    const handler = adapter.webhook;
    const secret = options?.secret ?? '';

    // 1. Verify signature
    const verified = handler.verifySignature({
      rawBody: request.rawBody,
      headers: request.headers,
      secret,
    });
    if (!verified) {
      return { statusCode: 401, body: { error: 'Invalid webhook signature' } };
    }

    // 2. Check for synchronous challenge responses (Slack url_verification)
    if (handler.handleSynchronous) {
      const sync = handler.handleSynchronous({ body: request.body, headers: request.headers });
      if (sync) {
        if (!sync.skipAsyncProcessing) {
          // Process in background, respond synchronously
          const asyncWork = this._processWebhookAsync(adapter, request);
          if (options?.waitUntil) {
            options.waitUntil(asyncWork);
          }
        }
        return { statusCode: sync.statusCode, body: sync.body };
      }
    }

    // 3. Respond 200 immediately, process asynchronously
    const asyncWork = this._processWebhookAsync(adapter, request);
    if (options?.waitUntil) {
      options.waitUntil(asyncWork);
    } else {
      // Fire-and-forget with error logging
      asyncWork.catch((err) => {
        this.config.logger.error({ adapterId, err }, 'IntegrationHub: async webhook processing failed');
      });
    }

    return { statusCode: 200, body: { ok: true } };
  }

  private async _processWebhookAsync(
    adapter: IntegrationAdapter,
    request: WebhookRequest,
  ): Promise<void> {
    const event = adapter.webhook.parseEvent({
      body: request.body,
      headers: request.headers,
    });
    await this._dispatch(event);
  }

  // ── Internal: Event Dispatch ──────────────────────────────────────────────

  private async _dispatch(event: IntegrationEvent): Promise<void> {
    const ctx: EventContext = {
      hub: this,
      getAdapter: (key) => (this.adapters as Record<string, IntegrationAdapter>)[key] as IntegrationAdapter,
      logger: this.config.logger,
    };

    // Specific handlers
    const specific = this._eventHandlers.get(event.eventType) ?? [];
    // Wildcard handlers
    const all = this._wildcardHandlers;

    await Promise.allSettled([
      ...specific.map((h) => h(event, ctx)),
      ...all.map((h) => h(event, ctx)),
    ]);
  }
}
