import * as oauth from "oauth4webapi";
import { OAuthError, TokenRefreshError } from "@apollo-deploy/integrations";
import type { OAuthHandler } from "@apollo-deploy/integrations";
import type { LinearAdapterConfig } from "./types.js";

const AUTHORIZATION_URL = "https://linear.app/oauth/authorize";
const AS: oauth.AuthorizationServer = {
  issuer: "https://linear.app",
  authorization_endpoint: AUTHORIZATION_URL,
  token_endpoint: "https://api.linear.app/oauth/token",
};

export function createLinearOAuth(config: LinearAdapterConfig): OAuthHandler {
  const client: oauth.Client = { client_id: config.clientId };
  const clientAuth = oauth.ClientSecretPost(config.clientSecret);

  return {
    getAuthorizationUrl({ state, scopes, redirectUri }) {
      const url = new URL(AUTHORIZATION_URL);
      url.searchParams.set("client_id", config.clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set(
        "scope",
        (scopes.length > 0 ? scopes : ["read", "write"]).join(","),
      );
      url.searchParams.set("state", state);
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
          scope: result.scope ?? "read,write",
          expiresAt:
            result.expires_in != null
              ? new Date(Date.now() + result.expires_in * 1000)
              : undefined,
          providerData: {},
        };
      } catch (err) {
        if (err instanceof OAuthError) throw err;
        throw new OAuthError("linear", String(err));
      }
    },

    refreshToken(_refreshToken) {
      // Linear does not support token refresh
      throw new TokenRefreshError(
        "linear",
        "Linear does not support token refresh — re-authorise",
        false,
      );
    },

    async getIdentity(accessToken) {
      const query = "{ viewer { id name email avatarUrl } }";
      const resp = await fetch("https://api.linear.app/graphql", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });
      if (!resp.ok)
        throw new OAuthError(
          "linear",
          `Failed to fetch identity: ${String(resp.status)}`,
        );
      const data = (await resp.json()) as {
        data?: {
          viewer: {
            id: string;
            name: string;
            email: string;
            avatarUrl?: string;
          };
        };
      };
      const viewer = data.data?.viewer;
      return {
        providerAccountId: viewer?.id ?? "",
        displayName: viewer?.name ?? "",
        email: viewer?.email,
        avatarUrl: viewer?.avatarUrl,
        metadata: {},
      };
    },
  };
}
