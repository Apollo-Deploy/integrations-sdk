/**
 * Jira 3LO OAuth handler.
 *
 * Key specifics:
 * - afterAuthorize calls accessible-resources to discover cloudId.
 * - Refresh token ROTATES on each use — must store new refresh token.
 * - Uses distributed lock in worker (requiresRefreshLock: true).
 * - Single redirect_uri per Atlassian Developer app.
 */

import {
  createOAuthHandler,
  ClientSecretPost,
  OAuthError,
} from "@apollo-deploy/integrations";
import type {
  OAuthHandler,
  PostAuthResult,
  TokenSet,
} from "@apollo-deploy/integrations";
import type { JiraAdapterConfig } from "./types.js";

const BASE = "https://auth.atlassian.com";

export function createJiraOAuth(config: JiraAdapterConfig): OAuthHandler {
  return createOAuthHandler({
    provider: "jira",
    as: {
      issuer: BASE,
      authorization_endpoint: `${BASE}/authorize`,
      token_endpoint: `${BASE}/oauth/token`,
    },
    client: { client_id: config.clientId },
    clientAuth: ClientSecretPost(config.clientSecret),
    defaultScopes: ["read:jira-work", "write:jira-work", "offline_access"],
    // Atlassian requires audience + forced consent prompt on every authorization
    extraAuthParams: { audience: "api.atlassian.com", prompt: "consent" },
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
    async afterAuthorize(tokens: TokenSet): Promise<PostAuthResult> {
      const resp = await fetch(
        "https://api.atlassian.com/oauth/token/accessible-resources",
        { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
      );
      if (!resp.ok) return { metadata: {} };
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
  });
}
