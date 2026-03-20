import * as oauth from "oauth4webapi";
import { OAuthError } from "@apollo-deploy/integrations";
import type { OAuthHandler } from "@apollo-deploy/integrations";
import type { GitlabAdapterConfig } from "./types.js";

export function createGitlabOAuth(config: GitlabAdapterConfig): OAuthHandler {
  const base = config.instanceUrl?.replace(/\/$/, "") ?? "https://gitlab.com";
  const authorizationUrl = `${base}/oauth/authorize`;
  const as: oauth.AuthorizationServer = {
    issuer: base,
    authorization_endpoint: authorizationUrl,
    token_endpoint: `${base}/oauth/token`,
  };
  const client: oauth.Client = { client_id: config.clientId };
  const clientAuth = oauth.ClientSecretPost(config.clientSecret);

  return {
    getAuthorizationUrl({ state, scopes, redirectUri }) {
      const url = new URL(authorizationUrl);
      url.searchParams.set("client_id", config.clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set(
        "scope",
        (scopes.length > 0
          ? scopes
          : ["read_user", "api", "read_repository"]
        ).join(" "),
      );
      url.searchParams.set("state", state);
      return url.toString();
    },

    async exchangeCode({ code, redirectUri, codeVerifier }) {
      try {
        const response = await oauth.authorizationCodeGrantRequest(
          as,
          client,
          clientAuth,
          new URLSearchParams({ code }),
          redirectUri,
          codeVerifier ?? oauth.nopkce,
        );
        const result = await oauth.processAuthorizationCodeResponse(
          as,
          client,
          response,
        );
        return {
          accessToken: result.access_token,
          refreshToken: result.refresh_token,
          scope: result.scope ?? "",
          expiresAt:
            result.expires_in != null
              ? new Date(Date.now() + result.expires_in * 1000)
              : undefined,
          providerData: { instanceUrl: base },
        };
      } catch (err) {
        if (err instanceof OAuthError) throw err;
        throw new OAuthError("gitlab", String(err));
      }
    },

    async refreshToken(refreshToken) {
      try {
        const response = await oauth.refreshTokenGrantRequest(
          as,
          client,
          clientAuth,
          refreshToken,
        );
        const result = await oauth.processRefreshTokenResponse(
          as,
          client,
          response,
        );
        return {
          accessToken: result.access_token,
          refreshToken: result.refresh_token,
          scope: result.scope ?? "",
          expiresAt:
            result.expires_in != null
              ? new Date(Date.now() + result.expires_in * 1000)
              : undefined,
          providerData: { instanceUrl: base },
        };
      } catch (err) {
        if (err instanceof OAuthError) throw err;
        throw new OAuthError("gitlab", `Token refresh failed: ${String(err)}`);
      }
    },

    async getIdentity(accessToken) {
      const resp = await fetch(`${base}/api/v4/user`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!resp.ok)
        throw new OAuthError(
          "gitlab",
          `Failed to fetch identity: ${String(resp.status)}`,
        );
      const user = (await resp.json()) as {
        id: number;
        username: string;
        name: string;
        email: string;
        avatar_url?: string;
      };
      return {
        providerAccountId: String(user.id),
        displayName: user.name,
        email: user.email,
        avatarUrl: user.avatar_url,
        metadata: { username: user.username },
      };
    },
  };
}
