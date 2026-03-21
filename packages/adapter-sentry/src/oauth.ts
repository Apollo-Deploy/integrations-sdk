/**
 * Sentry OAuth handler.
 *
 * Sentry supports two auth modes:
 *
 * 1. Auth Token (api_key) — static Bearer token, no OAuth flow.
 *    Most integrations use this. The "OAuth" handler in this case stores
 *    the token as if it were exchanged via code flow.
 *
 * 2. OAuth 2.0 (oauth2) — for Sentry internal/public integrations.
 *    Authorization endpoint: https://sentry.io/oauth/authorize/
 *    Token endpoint:         https://sentry.io/oauth/token/
 *
 * This handler supports both. When clientId/clientSecret are provided it uses
 * the proper OAuth flow via createOAuthHandler; otherwise it short-circuits
 * with the static authToken.
 */

import {
  createOAuthHandler,
  ClientSecretPost,
  OAuthError,
  TokenRefreshError,
} from "@apollo-deploy/integrations";
import type {
  OAuthHandler,
  ProviderIdentity,
  TokenEndpointResponse,
} from "@apollo-deploy/integrations";
import type { SentryAdapterConfig } from "./types.js";

const BASE_DEFAULT = "https://sentry.io";

async function getSentryIdentity(
  base: string,
  accessToken: string,
): Promise<ProviderIdentity> {
  const resp = await fetch(`${base}/api/0/users/me/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) {
    throw new OAuthError(
      "sentry",
      `getIdentity failed: ${String(resp.status)}`,
    );
  }
  const me = (await resp.json()) as {
    id: string;
    username: string;
    email: string;
    name: string;
    avatar?: { avatarUrl?: string };
  };
  return {
    providerAccountId: me.id,
    displayName: me.name,
    email: me.email,
    avatarUrl: me.avatar?.avatarUrl,
    metadata: { username: me.username },
  };
}

/**
 * Sentry returns both `expires_in` (seconds) and `expires_at` (ISO string).
 * Prefer the absolute timestamp when present.
 */
function sentryExpiresAt(result: TokenEndpointResponse): Date | undefined {
  const raw = result as { expires_at?: string };
  if (raw.expires_at != null) return new Date(raw.expires_at);
  if (result.expires_in != null)
    return new Date(Date.now() + result.expires_in * 1000);
  return undefined;
}

export function createSentryOAuth(config: SentryAdapterConfig): OAuthHandler {
  const base = config.baseUrl?.replace(/\/$/, "") ?? BASE_DEFAULT;

  // Static auth-token flow — no OAuth redirect needed
  if (config.clientId == null || config.clientId === "") {
    return {
      getAuthorizationUrl() {
        return `${base}/settings/account/api/auth-tokens/`;
      },
      async exchangeCode({ code }) {
        return { accessToken: code, scope: "", providerData: { static: true } };
      },
      refreshToken() {
        throw new TokenRefreshError(
          "sentry",
          "Static auth tokens cannot be refreshed. Re-enter the token.",
          false,
        );
      },
      getIdentity: (token) => getSentryIdentity(base, token),
    };
  }

  if (config.clientSecret == null || config.clientSecret === "") {
    throw new OAuthError(
      "sentry",
      "clientSecret is required for Sentry OAuth2 flow",
    );
  }

  return createOAuthHandler({
    provider: "sentry",
    as: {
      issuer: base,
      authorization_endpoint: `${base}/oauth/authorize/`,
      token_endpoint: `${base}/oauth/token/`,
    },
    client: { client_id: config.clientId },
    clientAuth: ClientSecretPost(config.clientSecret),
    toExpiresAt: sentryExpiresAt,
    getIdentity: (token) => getSentryIdentity(base, token),
  });
}
