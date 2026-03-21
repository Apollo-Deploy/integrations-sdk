import {
  createOAuthHandler,
  ClientSecretPost,
  OAuthError,
} from "@apollo-deploy/integrations";
import type { OAuthHandler } from "@apollo-deploy/integrations";
import type { GitlabAdapterConfig } from "./types.js";

export function createGitlabOAuth(config: GitlabAdapterConfig): OAuthHandler {
  const base = config.instanceUrl?.replace(/\/$/, "") ?? "https://gitlab.com";
  return createOAuthHandler({
    provider: "gitlab",
    as: {
      issuer: base,
      authorization_endpoint: `${base}/oauth/authorize`,
      token_endpoint: `${base}/oauth/token`,
    },
    client: { client_id: config.clientId },
    clientAuth: ClientSecretPost(config.clientSecret),
    defaultScopes: ["read_user", "api", "read_repository"],
    toExchangeProviderData: () => ({ instanceUrl: base }),
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
  });
}
