import type { IntegrationEvent } from "./models/index.js";

/**
 * Inbound webhook handler — every adapter provides one.
 * Handles ingestion of events FROM external services (GitHub, Slack, etc.)
 */
export interface WebhookHandler {
  /** Event types this adapter can receive and normalize. */
  readonly supportedEvents: readonly string[];

  /**
   * Verify the webhook request signature.
   * Each provider uses different signing mechanisms — adapter encapsulates this.
   * Return false → hub responds 401.
   */
  verifySignature(params: VerifyParams): boolean;

  /**
   * Parse the raw webhook into a normalized IntegrationEvent.
   * The adapter maps provider-specific payloads to the universal event shape.
   */
  parseEvent(params: ParseParams): IntegrationEvent;

  /**
   * Extract the provider's unique delivery ID for idempotent deduplication.
   * - GitHub:   X-GitHub-Delivery header
   * - Slack:    X-Slack-Request-Timestamp + computed hash
   * - Linear:   Linear-Delivery-ID header
   * - Discord:  no delivery ID — generate from body hash
   */
  getDeliveryId(headers: Record<string, string>, body: unknown): string;

  /**
   * Optional: handle synchronous webhook challenges.
   * Slack url_verification must be answered inline.
   * Return null to proceed with normal async processing.
   */
  handleSynchronous?(params: ParseParams): SynchronousResponse | null;
}

export interface VerifyParams {
  rawBody: Buffer;
  headers: Record<string, string>;
  /** The secret configured for signature verification. */
  secret: string;
}

export interface ParseParams {
  body: unknown;
  headers: Record<string, string>;
}

export interface SynchronousResponse {
  statusCode: number;
  body: unknown;
  /** If true, skip async processing after sending this response. */
  skipAsyncProcessing: boolean;
}
