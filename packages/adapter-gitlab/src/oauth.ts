import { OAuthError } from '@apollo-deploy/integrations';
import type { OAuthHandler } from '@apollo-deploy/integrations';
import type { GitlabAdapterConfig } from './types.js';

export function createGitlabOAuth(config: GitlabAdapterConfig): OAuthHandler {
  const base = config.instanceUrl?.replace(/\/$/, '') ?? 'https://gitlab.com';

  return {
    getAuthorizationUrl({ state, scopes, redirectUri }) {
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: (scopes.length ? scopes : ['read_user', 'api', 'read_repository']).join(' '),
        state,
      });
      return `${base}/oauth/authorize?${params.toString()}`;
    },

    async exchangeCode({ code, redirectUri }) {
      const resp = await fetch(`${base}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });
      if (!resp.ok) throw new OAuthError('gitlab', `Code exchange failed: ${resp.status}`);
      const data = await resp.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; token_type?: string; error?: string };
      if (data.error || !data.access_token) throw new OAuthError('gitlab', data.error ?? 'Missing access_token');
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        scope: data.scope ?? '',
        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
        providerData: { instanceUrl: base },
      };
    },

    async refreshToken(refreshToken) {
      // GitLab REQUIRES redirect_uri in refresh requests
      const resp = await fetch(`${base}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
          redirect_uri: config.redirectUri ?? 'https://example.com/oauth/callback',
        }),
      });
      if (!resp.ok) throw new OAuthError('gitlab', `Token refresh failed: ${resp.status}`);
      const data = await resp.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string };
      if (data.error || !data.access_token) throw new OAuthError('gitlab', data.error ?? 'Missing access_token');
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        scope: data.scope ?? '',
        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
        providerData: { instanceUrl: base },
      };
    },

    async getIdentity(accessToken) {
      const resp = await fetch(`${base}/api/v4/user`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const user = await resp.json() as { id: number; username: string; name: string; email: string; avatar_url?: string };
      return {
        providerAccountId: String(user.id),
        displayName: user.name ?? user.username,
        email: user.email,
        avatarUrl: user.avatar_url,
        metadata: { username: user.username },
      };
    },
  };
}
