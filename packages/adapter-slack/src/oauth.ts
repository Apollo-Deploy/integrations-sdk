/**
 * Slack OAuth handler.
 *
 * Key specifics:
 * - Dual tokens: xoxb- (bot) + xoxp- (user) stored together.
 * - scope → bot scopes, user_scope → user scopes.
 * - teamId + teamName stored in providerData for display and dedup.
 */

import { OAuthError, TokenRefreshError } from "@apollo-deploy/integrations";
import type {
  OAuthHandler,
  ProviderIdentity,
} from "@apollo-deploy/integrations";
import type { SlackAdapterConfig } from "./types.js";

const SLACK_OAUTH_TOKEN_URL = "https://slack.com/api/oauth.v2.access";

export function createSlackOAuth(config: SlackAdapterConfig): OAuthHandler {
  const botScopes = config.scopes ?? [
    "chat:write",
    "channels:read",
    "channels:history",
  ];
  const userScopes = config.userScopes ?? [];

  return {
    getAuthorizationUrl({ state, redirectUri }) {
      const params = new URLSearchParams({
        client_id: config.clientId,
        scope: botScopes.join(","),
        user_scope: userScopes.join(","),
        redirect_uri: redirectUri,
        state,
      });
      return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
    },

    async exchangeCode({ code, redirectUri }) {
      const credentials = Buffer.from(
        `${config.clientId}:${config.clientSecret}`,
      ).toString("base64");
      const body = new URLSearchParams({ code, redirect_uri: redirectUri });

      const resp = await fetch(SLACK_OAUTH_TOKEN_URL, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      if (!resp.ok) {
        throw new OAuthError(
          "slack",
          `Token exchange HTTP error: ${String(resp.status)}`,
        );
      }

      const data = (await resp.json()) as {
        ok: boolean;
        error?: string;
        access_token?: string;
        token_type?: string;
        scope?: string;
        bot_user_id?: string;
        app_id?: string;
        team?: { id: string; name: string };
        authed_user?: {
          id: string;
          scope: string;
          access_token?: string;
          token_type?: string;
        };
        incoming_webhook?: { channel: string; url: string };
      };

      if (!data.ok || data.access_token == null || data.access_token === "") {
        throw new OAuthError("slack", data.error ?? "Token exchange failed");
      }

      return {
        accessToken: data.access_token,
        scope: data.scope ?? "",
        providerData: {
          teamId: data.team?.id,
          teamName: data.team?.name,
          botUserId: data.bot_user_id,
          userAccessToken: data.authed_user?.access_token,
          userScope: data.authed_user?.scope,
          appId: data.app_id,
        },
      };
    },

    refreshToken(_refreshToken) {
      // Slack does not support standard OAuth token refresh.
      // Tokens are long-lived unless rotation is explicitly enabled.
      throw new TokenRefreshError(
        "slack",
        "Slack tokens do not support refresh. Re-authorise the connection.",
        false,
      );
    },

    async getIdentity(accessToken) {
      const resp = await fetch("https://slack.com/api/auth.test", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = (await resp.json()) as {
        ok: boolean;
        error?: string;
        user_id?: string;
        user?: string;
        team?: string;
        team_id?: string;
      };

      if (!data.ok) {
        throw new OAuthError(
          "slack",
          data.error ?? "Failed to get Slack identity",
        );
      }

      return {
        providerAccountId: data.user_id ?? "",
        displayName: data.user ?? data.team ?? "Slack",
        metadata: { teamId: data.team_id, team: data.team },
      } satisfies ProviderIdentity;
    },
  };
}
