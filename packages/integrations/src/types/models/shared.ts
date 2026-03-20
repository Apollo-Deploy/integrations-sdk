import type { AdapterCapability } from "../adapter.js";

// ─── Universal Domain Models ──────────────────────────────────────────────────

export interface IntegrationEvent<T = Record<string, unknown>> {
  readonly id: string;
  /** Adapter ID: 'github', 'slack', etc. */
  readonly provider: string;
  /** Original provider event type, e.g. 'pull_request.opened' */
  readonly providerEventType: string;
  /** Normalized domain: 'source-control', 'messaging', etc. */
  readonly domain: AdapterCapability;
  /** Normalized event type: 'pull_request.created' */
  readonly eventType: string;
  readonly timestamp: Date;
  /** Groups related events from the same fan-out chain. */
  readonly correlationId: string;
  /** Which connected account received this event. */
  readonly connectionId: string;
  /** Resolved from webhook config. */
  readonly projectId?: string;
  readonly actor?: ActorInfo;
  readonly data: T;
}

export interface Connection {
  id: string;
  organizationId: string;
  userId: string;
  provider: string;
  providerAccountId: string;
  status: ConnectionStatus;
  scopes: string[];
  metadata: Record<string, unknown>;
  tokenExpiresAt?: Date;
  lastRefreshedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type ConnectionStatus = "active" | "expired" | "revoked" | "error";

export interface ActorInfo {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface Paginated<T> {
  items: T[];
  hasMore: boolean;
  cursor?: string;
}

export interface PaginationOpts {
  cursor?: string;
  limit?: number;
}
