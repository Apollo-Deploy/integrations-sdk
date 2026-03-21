import {
  createOAuthHandler,
  ClientSecretPost,
  OAuthError,
} from "@apollo-deploy/integrations";
import type { OAuthHandler } from "@apollo-deploy/integrations";
import type { DiscordAdapterConfig } from "./types.js";

const AS = {
  issuer: "https://discord.com",
  authorization_endpoint: "https://discord.com/api/oauth2/authorize",
  token_endpoint: "https://discord.com/api/oauth2/token",
};

export function createDiscordOAuth(config: DiscordAdapterConfig): OAuthHandler {
  return createOAuthHandler({
    provider: "discord",
    as: AS,
    client: { client_id: config.clientId },
    clientAuth: ClientSecretPost(config.clientSecret),
    defaultScopes: ["identify", "email", "guilds"],
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
  });
}
