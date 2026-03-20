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
 * the proper OAuth flow; otherwise it short-circuits with the static authToken.
 */

import { OAuthError, TokenRefreshError } from "@apollo-deploy/integrations";
import type {
  OAuthHandler,
  ProviderIdentity,
} from "@apollo-deploy/integrations";
import type { SentryAdapterConfig } from "./types.js";

const BASE = "https://sentry.io";

export function createSentryOAuth(config: SentryAdapterConfig): OAuthHandler {
  const base = config.baseUrl?.replace(/\/$/, "") ?? BASE;

  return {
    getAuthorizationUrl({ state, scopes, redirectUri }) {
      if (config.clientId == null || config.clientId === "") {
        // Static auth token flow — no OAuth redirect needed.
        // Return a placeholder; the UI should render the credential form instead.
        return `${base}/settings/account/api/auth-tokens/`;
      }
      const url = new URL(`${base}/oauth/authorize/`);
      url.searchParams.set("client_id", config.clientId);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("state", state);
      url.searchParams.set("redirect_uri", redirectUri);
      if (scopes.length > 0) {
        url.searchParams.set("scope", scopes.join(" "));
      }
      return url.toString();
    },

    async exchangeCode({ code, redirectUri }) {
      if (
        config.clientId == null ||
        config.clientId === "" ||
        config.clientSecret == null ||
        config.clientSecret === ""
      ) {
        // Static auth token — code is the token itself (credential form flow).
        return {
          accessToken: code,
          scope: "",
          providerData: { static: true },
        };
      }
      try {
        const resp = await fetch(`${base}/oauth/token/`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code,
            redirect_uri: redirectUri,
          }),
        });
        if (!resp.ok) {
          const err = await resp.text();
          throw new OAuthError("sentry", `Code exchange failed: ${err}`);
        }
        const data = (await resp.json()) as {
          access_token: string;
          refresh_token?: string;
          expires_in?: number;
          token_type: string;
          scope?: string;
        };
        return {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          scope: data.scope ?? "",
          expiresAt:
            data.expires_in != null
              ? new Date(Date.now() + data.expires_in * 1000)
              : undefined,
          providerData: {},
        };
      } catch (err) {
        if (err instanceof OAuthError) throw err;
        throw new OAuthError("sentry", `Code exchange error: ${String(err)}`);
      }
    },

    async refreshToken(refreshToken) {
      if (
        config.clientId == null ||
        config.clientId === "" ||
        config.clientSecret == null ||
        config.clientSecret === ""
      ) {
        // Static token — nothing to refresh.
        throw new TokenRefreshError(
          "sentry",
          "Static auth tokens cannot be refreshed. Re-enter the token.",
          false,
        );
      }
      try {
        const resp = await fetch(`${base}/oauth/token/`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: config.clientId,
            client_secret: config.clientSecret,
            refresh_token: refreshToken,
          }),
        });
        if (!resp.ok) {
          const err = await resp.text();
          throw new TokenRefreshError(
            "sentry",
            `Token refresh failed: ${err}`,
            false,
          );
        }
        const data = (await resp.json()) as {
          access_token: string;
          refresh_token?: string;
          expires_in?: number;
          scope?: string;
        };
        return {
          accessToken: data.access_token,
          refreshToken: data.refresh_token ?? refreshToken,
          scope: data.scope ?? "",
          expiresAt:
            data.expires_in != null
              ? new Date(Date.now() + data.expires_in * 1000)
              : undefined,
          providerData: {},
        };
      } catch (err) {
        if (err instanceof TokenRefreshError) throw err;
        throw new TokenRefreshError(
          "sentry",
          `Token refresh error: ${String(err)}`,
          false,
        );
      }
    },

    async getIdentity(accessToken): Promise<ProviderIdentity> {
      const _resp = await fetch(`${base}/api/0/`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      // /api/0/ returns basic auth info; try /api/0/users/me/ for user details
      const meResp = await fetch(`${base}/api/0/users/me/`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!meResp.ok) {
        throw new OAuthError(
          "sentry",
          `getIdentity failed: ${String(meResp.status)}`,
        );
      }
      const me = (await meResp.json()) as {
        id: string;
        username: string;
        email: string;
        name: string;
        avatarUrl?: string;
      };
      return {
        providerAccountId: me.id,
        displayName: me.name,
        email: me.email,
        avatarUrl: me.avatarUrl,
        metadata: { username: me.username },
      };
    },
  };
}
