/**
 * GitHub OAuth handler.
 *
 * GitHub Apps use a non-standard token model:
 * - "Refresh" = sign a new JWT with the private key, then call
 *   POST /app/installations/{installationId}/access_tokens
 * - Installation tokens expire after 1 hour.
 * - The `installationId` is stored in providerData, not as a refresh token.
 */

import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { OAuthError, TokenRefreshError } from '@apollo-deploy/integrations';
import type { OAuthHandler, ProviderIdentity, PostAuthResult } from '@apollo-deploy/integrations';
import type { GithubAdapterConfig } from './types.js';

export function createGithubOAuth(config: GithubAdapterConfig): OAuthHandler {
  return {
    getAuthorizationUrl({ state, redirectUri, extras }) {
      const params = new URLSearchParams({
        state,
        redirect_uri: redirectUri,
        ...(extras ?? {}),
      });
      // GitHub App installation flow
      return `https://github.com/apps/${config.appId}/installations/new?${params.toString()}`;
    },

    async exchangeCode({ code }) {
      // Exchange OAuth code for an installation access token.
      // GitHub's installation flow provides an installation_id query param on callback.
      try {
        // Use GitHub's device/OAuth endpoint to get the installation ID from the code
        const resp = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code,
          }),
        });

        if (!resp.ok) {
          const err = await resp.text();
          throw new OAuthError('github', `OAuth code exchange failed: ${err}`);
        }

        const data = (await resp.json()) as {
          access_token?: string;
          token_type?: string;
          scope?: string;
          error?: string;
          error_description?: string;
          installation_id?: number;
        };

        if (data.error) {
          throw new OAuthError('github', data.error_description ?? data.error);
        }

        return {
          accessToken: data.access_token ?? '',
          scope: data.scope ?? '',
          expiresAt: new Date(Date.now() + 3600 * 1000),
          providerData: {
            installationId: data.installation_id,
            appId: config.appId,
          },
        };
      } catch (err) {
        if (err instanceof OAuthError) {throw err;}
        throw new OAuthError('github', `Code exchange error: ${String(err)}`);
      }
    },

    async refreshToken(_refreshToken) {
      // GitHub Apps don't use refresh tokens. Instead, regenerate an installation token
      // by signing a JWT with the private key.
      // The refresh token field stores the installationId as a string.
      const installationId = _refreshToken;

      try {
        const auth = createAppAuth({
          appId: config.appId,
          privateKey: config.privateKey,
        });

        const installationAuth = await auth({
          type: 'installation',
          installationId: Number(installationId),
        }) as { token: string; expiresAt: string };

        return {
          accessToken: installationAuth.token,
          scope: '',
          expiresAt: new Date(installationAuth.expiresAt),
          providerData: {
            installationId,
            appId: config.appId,
          },
        };
      } catch (err) {
        throw new TokenRefreshError(
          'github',
          `Failed to regenerate installation token: ${String(err)}`,
        );
      }
    },

    async getIdentity(accessToken) {
      try {
        const octokit = new Octokit({ auth: accessToken });
        const { data } = await octokit.rest.apps.getAuthenticated();
        if (!data) throw new OAuthError('github', 'Failed to fetch GitHub App identity: empty response');
        return {
          providerAccountId: String(data.id),
          displayName: data.name ?? (data as any).slug ?? 'GitHub App',
          avatarUrl: (data.owner as any)?.avatar_url,
          metadata: { slug: (data as any).slug },
        } satisfies ProviderIdentity;
      } catch (err) {
        throw new OAuthError('github', `Failed to fetch GitHub identity: ${String(err)}`);
      }
    },

    async afterAuthorize(tokens): Promise<PostAuthResult> {
      const installationId = tokens.providerData.installationId as number;
      if (!installationId) {
        return { metadata: {} };
      }

      try {
        const auth = createAppAuth({
          appId: config.appId,
          privateKey: config.privateKey,
        });

        const appAuth = await auth({ type: 'app' }) as { token: string };
        const octokit = new Octokit({ auth: `Bearer ${appAuth.token}` });

        const { data } = await octokit.rest.apps.listReposAccessibleToInstallation({
          installation_id: installationId,
          per_page: 100,
        });

        return {
          metadata: {
            installationId,
            repositoryCount: data.total_count,
            repositories: data.repositories.map((r) => ({
              id: r.id,
              fullName: r.full_name,
              private: r.private,
            })),
          },
        };
      } catch {
        // Non-critical — return without repo list
        return { metadata: { installationId } };
      }
    },
  };
}
