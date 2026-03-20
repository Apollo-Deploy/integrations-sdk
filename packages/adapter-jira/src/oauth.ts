/**
 * Jira 3LO OAuth handler.
 *
 * Key specifics:
 * - afterAuthorize calls accessible-resources to discover cloudId.
 * - Refresh token ROTATES on each use — must store new refresh token.
 * - Uses distributed lock in worker (requiresRefreshLock: true).
 * - Single redirect_uri per Atlassian Developer app.
 */

import * as oauth from "oauth4webapi";
import { OAuthError, TokenRefreshError } from "@apollo-deploy/integrations";
import type { OAuthHandler, PostAuthResult } from "@apollo-deploy/integrations";
import type { JiraAdapterConfig } from "./types.js";

const BASE = "https://auth.atlassian.com";
const AUTHORIZATION_URL = `${BASE}/authorize`;

const AS: oauth.AuthorizationServer = {
  issuer: BASE,
  authorization_endpoint: AUTHORIZATION_URL,
  token_endpoint: `${BASE}/oauth/token`,
};

export function createJiraOAuth(config: JiraAdapterConfig): OAuthHandler {
  const client: oauth.Client = { client_id: config.clientId };
  const clientAuth = oauth.ClientSecretPost(config.clientSecret);

  return {
    getAuthorizationUrl({ state, scopes, redirectUri }) {
      const url = new URL(AUTHORIZATION_URL);
      url.searchParams.set("audience", "api.atlassian.com");
      url.searchParams.set("client_id", config.clientId);
      url.searchParams.set(
        "scope",
        (scopes.length > 0
          ? scopes
          : ["read:jira-work", "write:jira-work", "offline_access"]
        ).join(" "),
      );
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("state", state);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("prompt", "consent");
      return url.toString();
    },

    async exchangeCode({ code, redirectUri, codeVerifier }) {
      try {
        const response = await oauth.authorizationCodeGrantRequest(
          AS,
          client,
          clientAuth,
          new URLSearchParams({ code }),
          redirectUri,
          codeVerifier ?? oauth.nopkce,
        );
        const result = await oauth.processAuthorizationCodeResponse(
          AS,
          client,
          response,
        );
        return {
          accessToken: result.access_token,
          // Jira rotates refresh tokens — store the one returned
          refreshToken: result.refresh_token,
          scope: result.scope ?? "",
          expiresAt:
            result.expires_in != null
              ? new Date(Date.now() + result.expires_in * 1000)
              : undefined,
          providerData: {},
        };
      } catch (err) {
        if (err instanceof OAuthError) throw err;
        throw new OAuthError("jira", String(err));
      }
    },

    async refreshToken(refreshToken) {
      try {
        const response = await oauth.refreshTokenGrantRequest(
          AS,
          client,
          clientAuth,
          refreshToken,
        );
        const result = await oauth.processRefreshTokenResponse(
          AS,
          client,
          response,
        );
        return {
          accessToken: result.access_token,
          // Jira rotates refresh tokens — store the NEW one
          refreshToken: result.refresh_token,
          scope: result.scope ?? "",
          expiresAt:
            result.expires_in != null
              ? new Date(Date.now() + result.expires_in * 1000)
              : undefined,
          providerData: {},
        };
      } catch (err) {
        throw new TokenRefreshError(
          "jira",
          `Jira token refresh failed: ${String(err)}`,
          false,
        );
      }
    },

    async getIdentity(accessToken) {
      const resp = await fetch("https://api.atlassian.com/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!resp.ok)
        throw new OAuthError(
          "jira",
          `Failed to fetch identity: ${String(resp.status)}`,
        );
      const data = (await resp.json()) as {
        account_id: string;
        display_name: string;
        email?: string;
        picture?: string;
      };
      return {
        providerAccountId: data.account_id,
        displayName: data.display_name,
        email: data.email,
        avatarUrl: data.picture,
        metadata: {},
      };
    },

    async afterAuthorize(tokens): Promise<PostAuthResult> {
      // Discover accessible Jira cloud sites
      const resp = await fetch(
        "https://api.atlassian.com/oauth/token/accessible-resources",
        {
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        },
      );

      if (!resp.ok) {
        return { metadata: {} };
      }

      const sites = (await resp.json()) as {
        id: string;
        name: string;
        url: string;
        scopes: string[];
      }[];
      const primary = sites[0] as
        | { id: string; name: string; url: string; scopes: string[] }
        | undefined;

      return {
        metadata: {
          cloudId: primary?.id,
          cloudName: primary?.name,
          cloudUrl: primary?.url,
          sites: sites.map((s) => ({ id: s.id, name: s.name, url: s.url })),
        },
      };
    },
  };
}
