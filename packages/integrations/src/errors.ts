/**
 * Integration platform error types.
 */

/** Base class for all adapter errors. */
export class AdapterError extends Error {
  readonly code: string;
  readonly provider: string;
  readonly retryable: boolean;

  constructor(params: { message: string; code: string; provider: string; retryable?: boolean }) {
    super(params.message);
    this.name = 'AdapterError';
    this.code = params.code;
    this.provider = params.provider;
    this.retryable = params.retryable ?? false;
  }
}

/** Thrown during OAuth flows (authorization URL errors, code exchange failures, etc.) */
export class OAuthError extends AdapterError {
  constructor(provider: string, message: string, code = 'OAUTH_ERROR') {
    super({ message, code, provider, retryable: false });
    this.name = 'OAuthError';
  }
}

/** Thrown for inbound webhook issues (invalid signature, parse errors, etc.) */
export class WebhookError extends AdapterError {
  readonly statusCode: number;

  constructor(provider: string, message: string, statusCode = 400) {
    super({ message, code: 'WEBHOOK_ERROR', provider, retryable: false });
    this.name = 'WebhookError';
    this.statusCode = statusCode;
  }
}

/** Thrown when a capability method call fails. Optionally retryable. */
export class CapabilityError extends AdapterError {
  constructor(provider: string, message: string, retryable = true) {
    super({ message, code: 'CAPABILITY_ERROR', provider, retryable });
    this.name = 'CapabilityError';
  }
}

/** Thrown when token refresh fails. retryable=false means the connection needs re-authorisation. */
export class TokenRefreshError extends AdapterError {
  constructor(provider: string, message: string, retryable = false) {
    super({ message, code: 'TOKEN_REFRESH_ERROR', provider, retryable });
    this.name = 'TokenRefreshError';
  }
}

/** Thrown when the requested adapter is not registered in the hub. */
export class UnknownAdapterError extends Error {
  constructor(adapterId: string) {
    super(`Adapter '${adapterId}' is not registered in this IntegrationHub`);
    this.name = 'UnknownAdapterError';
  }
}
