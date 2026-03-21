/**
 * OAuth helper — factory for the standard OAuth 2.0 authorization code flow.
 *
 * Wraps oauth4webapi so adapter oauth.ts files stay lightweight:
 *
 *   import { createOAuthHandler, ClientSecretPost } from "@apollo-deploy/integrations"
 *
 * Re-exports the oauth4webapi utilities adapters need so they don't require
 * a direct dependency on the library.
 */

import * as oauthLib from "oauth4webapi";
import { OAuthError, TokenRefreshError } from "./errors.js";
import type {
  OAuthHandler,
  AuthorizationParams,
  CodeExchangeParams,
  TokenSet,
  ProviderIdentity,
  PostAuthResult,
} from "./types/oauth.js";

// Re-exports ────────────────────────────────────────────────────────────────
export { ClientSecretPost } from "oauth4webapi";
export type {
  AuthorizationServer,
  Client,
  ClientAuth,
  TokenEndpointResponse,
} from "oauth4webapi";

// ── Factory types ─────────────────────────────────────────────────────────────

export interface StandardOAuthOptions {
  /** Provider name used in error messages, e.g. "gitlab", "discord" */
  provider: string;
  /** OAuth 2.0 AS metadata — at minimum authorization_endpoint and token_endpoint */
  as: oauthLib.AuthorizationServer;
  client: oauthLib.Client;
  clientAuth: oauthLib.ClientAuth;
  /** Default scopes when the caller passes an empty list */
  defaultScopes?: string[];
  /** Separator for the scope list — default " ", Linear uses "," */
  scopeSeparator?: string;
  /** Static extra query params appended to the authorization URL (e.g. audience, prompt) */
  extraAuthParams?: Record<string, string>;
  /** Dynamic extra params derived from the runtime authorization request */
  buildExtraAuthParams?: (p: AuthorizationParams) => Record<string, string>;
  /** Map token response → providerData stored in the TokenSet from exchangeCode */
  toExchangeProviderData?: (r: oauthLib.TokenEndpointResponse) => Record<string, unknown>;
  /** Map token response → providerData for refresh — falls back to toExchangeProviderData */
  toRefreshProviderData?: (r: oauthLib.TokenEndpointResponse) => Record<string, unknown>;
  /**
   * Override how expiresAt is computed from the token response.
   * Default: Date.now() + expires_in * 1000. Use this for providers like Sentry
   * that also return an `expires_at` absolute ISO timestamp.
   */
  toExpiresAt?: (r: oauthLib.TokenEndpointResponse) => Date | undefined;
  /** If set, throw TokenRefreshError with this message instead of calling the token endpoint */
  noRefresh?: string;
  /** Fetch the authenticated user identity */
  getIdentity: (accessToken: string) => Promise<ProviderIdentity>;
  /** Optional post-authorization hook (Jira: cloud discovery, GitHub: installation discovery) */
  afterAuthorize?: (tokens: TokenSet) => Promise<PostAuthResult>;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function computeExpiresAt(
  result: oauthLib.TokenEndpointResponse,
  toExpiresAt?: (r: oauthLib.TokenEndpointResponse) => Date | undefined,
): Date | undefined {
  if (toExpiresAt != null) return toExpiresAt(result);
  return result.expires_in != null
    ? new Date(Date.now() + result.expires_in * 1000)
    : undefined;
}

function buildTokenSet(
  result: oauthLib.TokenEndpointResponse,
  providerData: Record<string, unknown>,
  toExpiresAt?: (r: oauthLib.TokenEndpointResponse) => Date | undefined,
): TokenSet {
  return {
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    scope: result.scope ?? "",
    expiresAt: computeExpiresAt(result, toExpiresAt),
    providerData,
  };
}

function buildAuthorizationUrl(
  opts: StandardOAuthOptions,
  params: AuthorizationParams,
): string {
  const endpoint = opts.as.authorization_endpoint;
  if (endpoint == null) {
    throw new OAuthError(
      opts.provider,
      "authorization_endpoint is not set in AS metadata",
    );
  }
  const url = new URL(endpoint);
  url.searchParams.set("client_id", opts.client.client_id);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", params.state);
  const sep = opts.scopeSeparator ?? " ";
  const scopes =
    params.scopes.length > 0 ? params.scopes : (opts.defaultScopes ?? []);
  if (scopes.length > 0) url.searchParams.set("scope", scopes.join(sep));
  for (const [k, v] of Object.entries(opts.extraAuthParams ?? {})) {
    url.searchParams.set(k, v);
  }
  if (opts.buildExtraAuthParams != null) {
    for (const [k, v] of Object.entries(opts.buildExtraAuthParams(params))) {
      url.searchParams.set(k, v);
    }
  }
  for (const [k, v] of Object.entries(params.extras ?? {})) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

async function executeExchange(
  opts: StandardOAuthOptions,
  { code, redirectUri, codeVerifier }: CodeExchangeParams,
): Promise<TokenSet> {
  const response = await oauthLib.authorizationCodeGrantRequest(
    opts.as,
    opts.client,
    opts.clientAuth,
    new URLSearchParams({ code }),
    redirectUri,
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    codeVerifier ?? oauthLib.nopkce,
  );
  const result = await oauthLib.processAuthorizationCodeResponse(
    opts.as,
    opts.client,
    response,
  );
  const providerData = opts.toExchangeProviderData?.(result) ?? {};
  return buildTokenSet(result, providerData, opts.toExpiresAt);
}

async function executeRefresh(
  opts: StandardOAuthOptions,
  refreshToken: string,
): Promise<TokenSet> {
  const response = await oauthLib.refreshTokenGrantRequest(
    opts.as,
    opts.client,
    opts.clientAuth,
    refreshToken,
  );
  const result = await oauthLib.processRefreshTokenResponse(
    opts.as,
    opts.client,
    response,
  );
  const toProviderData =
    opts.toRefreshProviderData ?? opts.toExchangeProviderData;
  const providerData = toProviderData?.(result) ?? {};
  return buildTokenSet(result, providerData, opts.toExpiresAt);
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Build a standard OAuth 2.0 authorization code handler.
 *
 * Handles getAuthorizationUrl, exchangeCode, refreshToken, and getIdentity via
 * oauth4webapi. Provider-specific logic (identity fetch, providerData, etc.) is
 * supplied through callbacks.
 *
 * @example
 * ```ts
 * export function createGitlabOAuth(config: GitlabAdapterConfig): OAuthHandler {
 *   const base = config.instanceUrl ?? "https://gitlab.com";
 *   return createOAuthHandler({
 *     provider: "gitlab",
 *     as: { issuer: base, authorization_endpoint: `${base}/oauth/authorize`, token_endpoint: `${base}/oauth/token` },
 *     client: { client_id: config.clientId },
 *     clientAuth: ClientSecretPost(config.clientSecret),
 *     defaultScopes: ["read_user", "api", "read_repository"],
 *     toExchangeProviderData: () => ({ instanceUrl: base }),
 *     async getIdentity(accessToken) { ... },
 *   });
 * }
 * ```
 */
export function createOAuthHandler(opts: StandardOAuthOptions): OAuthHandler {
  return {
    getAuthorizationUrl: (params) => buildAuthorizationUrl(opts, params),

    async exchangeCode(params) {
      try {
        return await executeExchange(opts, params);
      } catch (err) {
        if (err instanceof OAuthError) throw err;
        throw new OAuthError(opts.provider, String(err));
      }
    },

    async refreshToken(refreshToken) {
      if (opts.noRefresh != null) {
        throw new TokenRefreshError(opts.provider, opts.noRefresh, false);
      }
      try {
        return await executeRefresh(opts, refreshToken);
      } catch (err) {
        if (err instanceof TokenRefreshError) throw err;
        throw new TokenRefreshError(
          opts.provider,
          `Token refresh failed: ${String(err)}`,
          false,
        );
      }
    },

    getIdentity: opts.getIdentity,
    afterAuthorize: opts.afterAuthorize,
  };
}
