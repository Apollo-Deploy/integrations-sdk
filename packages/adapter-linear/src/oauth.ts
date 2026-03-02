import { OAuthError, TokenRefreshError } from '@apollo-deploy/integrations';
import type { OAuthHandler } from '@apollo-deploy/integrations';
import type { LinearAdapterConfig } from './types.js';

export function createLinearOAuth(config: LinearAdapterConfig): OAuthHandler {
  return {
    getAuthorizationUrl({ state, scopes, redirectUri }) {
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: (scopes.length ? scopes : ['read', 'write']).join(','),
        state,
        prompt: 'consent',
      });
      return `https://linear.app/oauth/authorize?${params.toString()}`;
    },

    async exchangeCode({ code, redirectUri }) {
      const resp = await fetch('https://api.linear.app/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: redirectUri,
          code,
          grant_type: 'authorization_code',
        }).toString(),
      });
      if (!resp.ok) throw new OAuthError('linear', `Code exchange failed: ${resp.status}`);
      const data = await resp.json() as { access_token: string; token_type: string; expires_in?: number; scope?: string; error?: string };
      if (data.error) throw new OAuthError('linear', data.error);
      return {
        accessToken: data.access_token,
        scope: data.scope ?? 'read,write',
        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
        providerData: {},
      };
    },

    async refreshToken(_refreshToken) {
      // Linear uses standard OAuth2 refresh
      throw new TokenRefreshError('linear', 'Linear does not support token refresh — re-authorise', false);
    },

    async getIdentity(accessToken) {
      const query = '{ viewer { id name email avatarUrl } }';
      const resp = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await resp.json() as { data?: { viewer: { id: string; name: string; email: string; avatarUrl?: string } } };
      const viewer = data.data?.viewer;
      return {
        providerAccountId: viewer?.id ?? '',
        displayName: viewer?.name ?? '',
        email: viewer?.email,
        avatarUrl: viewer?.avatarUrl,
        metadata: {},
      };
    },
  };
}
