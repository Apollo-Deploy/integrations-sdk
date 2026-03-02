import { OAuthError, TokenRefreshError } from '@apollo-deploy/integrations';
import type { OAuthHandler } from '@apollo-deploy/integrations';
import type { DiscordAdapterConfig } from './types.js';

export function createDiscordOAuth(config: DiscordAdapterConfig): OAuthHandler {
  return {
    getAuthorizationUrl({ state, scopes, redirectUri }) {
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: (scopes.length ? scopes : ['identify', 'email', 'guilds']).join(' '),
        state,
      });
      return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
    },

    async exchangeCode({ code, redirectUri }) {
      const resp = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }).toString(),
      });
      if (!resp.ok) throw new OAuthError('discord', `Code exchange failed: ${resp.status}`);
      const data = await resp.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string };
      if (data.error || !data.access_token) throw new OAuthError('discord', data.error ?? 'Missing access_token');
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        scope: data.scope ?? '',
        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
        providerData: {},
      };
    },

    async refreshToken(refreshToken) {
      const resp = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }).toString(),
      });
      if (!resp.ok) throw new TokenRefreshError('discord', `Refresh failed: ${resp.status}`, resp.status === 401 ? false : true);
      const data = await resp.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string };
      if (data.error || !data.access_token) throw new OAuthError('discord', data.error ?? 'Missing access_token');
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        scope: data.scope ?? '',
        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
        providerData: {},
      };
    },

    async getIdentity(accessToken) {
      const resp = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const user = await resp.json() as { id: string; username: string; global_name?: string; email?: string; avatar?: string };
      const avatarUrl = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : undefined;
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
