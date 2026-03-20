import * as oauth from "oauth4webapi";
import { OAuthError, TokenRefreshError } from "@apollo-deploy/integrations";
import type { OAuthHandler } from "@apollo-deploy/integrations";
import type { DiscordAdapterConfig } from "./types.js";

const DISCORD_AUTH_URL = "https://discord.com/api/oauth2/authorize";
const AS: oauth.AuthorizationServer = {
  issuer: "https://discord.com",
  authorization_endpoint: DISCORD_AUTH_URL,
  token_endpoint: "https://discord.com/api/oauth2/token",
};

const DEFAULT_SCOPES = ["identify", "email", "guilds"];

export function createDiscordOAuth(config: DiscordAdapterConfig): OAuthHandler {
  const client: oauth.Client = { client_id: config.clientId };
  const clientAuth = oauth.ClientSecretPost(config.clientSecret);

  return {
    getAuthorizationUrl({ state, scopes, redirectUri }) {
      const url = new URL(DISCORD_AUTH_URL);
      url.searchParams.set("client_id", config.clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set(
        "scope",
        (scopes.length > 0 ? scopes : DEFAULT_SCOPES).join(" "),
      );
      url.searchParams.set("state", state);
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
        throw new OAuthError("discord", String(err));
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
          refreshToken: result.refresh_token,
          scope: result.scope ?? "",
          expiresAt:
            result.expires_in != null
              ? new Date(Date.now() + result.expires_in * 1000)
              : undefined,
          providerData: {},
        };
      } catch (err) {
        if (err instanceof TokenRefreshError) throw err;
        throw new TokenRefreshError(
          "discord",
          `Refresh failed: ${String(err)}`,
          true,
        );
      }
    },

    async getIdentity(accessToken) {
      const resp = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!resp.ok)
        throw new OAuthError(
          "discord",
          `Failed to fetch identity: ${String(resp.status)}`,
        );
      const user = (await resp.json()) as {
        id: string;
        username: string;
        global_name?: string;
        email?: string;
        avatar?: string;
      };
      const avatarUrl =
        user.avatar != null
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
          : undefined;
      return {
        providerAccountId: user.id,
        displayName: user.global_name ?? user.username,
        email: user.email,
        avatarUrl,
        metadata: { username: user.username },
      };
    },
  };
}
