import {
  createOAuthHandler,
  ClientSecretPost,
  OAuthError,
} from "@apollo-deploy/integrations";
import type { OAuthHandler } from "@apollo-deploy/integrations";
import type { LinearAdapterConfig } from "./types.js";

export function createLinearOAuth(config: LinearAdapterConfig): OAuthHandler {
  return createOAuthHandler({
    provider: "linear",
    as: {
      issuer: "https://linear.app",
      authorization_endpoint: "https://linear.app/oauth/authorize",
      token_endpoint: "https://api.linear.app/oauth/token",
    },
    client: { client_id: config.clientId },
    clientAuth: ClientSecretPost(config.clientSecret),
    defaultScopes: ["read", "write"],
    scopeSeparator: ",",
    extraAuthParams: { prompt: "consent" },
    async getIdentity(accessToken) {
      const resp = await fetch("https://api.linear.app/graphql", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: "{ viewer { id name email avatarUrl } }" }),
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
  });
}
