/**
 * Jira 3LO OAuth handler.
 *
 * Key specifics:
 * - afterAuthorize calls accessible-resources to discover cloudId.
 * - Refresh token ROTATES on each use — must store new refresh token.
 * - Uses distributed lock in worker (requiresRefreshLock: true).
 * - Single redirect_uri per Atlassian Developer app.
 */

import { OAuthError, TokenRefreshError } from '@apollo-deploy/integrations';
import type { OAuthHandler, PostAuthResult } from '@apollo-deploy/integrations';
import type { JiraAdapterConfig } from './types.js';

const BASE = 'https://auth.atlassian.com';

export function createJiraOAuth(config: JiraAdapterConfig): OAuthHandler {
  return {
    getAuthorizationUrl({ state, scopes, redirectUri }) {
      const params = new URLSearchParams({
        audience: 'api.atlassian.com',
        client_id: config.clientId,
        scope: (scopes.length ? scopes : ['read:jira-work', 'write:jira-work', 'offline_access']).join(' '),
        redirect_uri: redirectUri,
        state,
        response_type: 'code',
        prompt: 'consent',
      });
      return `${BASE}/authorize?${params.toString()}`;
    },

    async exchangeCode({ code, redirectUri }) {
      const resp = await fetch(`${BASE}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      });

      if (!resp.ok) {
        throw new OAuthError('jira', `Token exchange failed: ${resp.status}`);
      }

      const data = await resp.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        scope?: string;
        error?: string;
      };

      if (data.error) {
        throw new OAuthError('jira', data.error);
      }

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        scope: data.scope ?? '',
        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
        providerData: {},
      };
    },

    async refreshToken(refreshToken) {
      const resp = await fetch(`${BASE}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          client_id: config.clientId,
          client_secret: config.clientSecret,
          refresh_token: refreshToken,
        }),
      });

      if (!resp.ok) {
        throw new TokenRefreshError('jira', `Jira token refresh failed: ${resp.status}`, false);
      }

      const data = await resp.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        scope?: string;
        error?: string;
      };

      if (data.error) {
        throw new TokenRefreshError('jira', data.error, false);
      }

      return {
        accessToken: data.access_token,
        // Jira rotates refresh tokens — store the NEW one
        refreshToken: data.refresh_token,
        scope: data.scope ?? '',
        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
        providerData: {},
      };
    },

    async getIdentity(accessToken) {
      const resp = await fetch('https://api.atlassian.com/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await resp.json() as {
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

    async afterAuthorize(tokens): Promise<PostAuthResult> {
      // Discover accessible Jira cloud sites
      const resp = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });

      if (!resp.ok) {
        return { metadata: {} };
      }

      const sites = await resp.json() as Array<{ id: string; name: string; url: string; scopes: string[] }>;
      const primary = sites[0];

      return {
        metadata: {
          cloudId: primary?.id,
          cloudName: primary?.name,
          cloudUrl: primary?.url,
          sites: sites.map((s) => ({ id: s.id, name: s.name, url: s.url })),
        },
      };
    },
  };
}
