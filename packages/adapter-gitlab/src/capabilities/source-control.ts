import { CapabilityError } from '@apollo-deploy/integrations';
import type { SourceControlCapability, TokenSet, Repository, Branch, PullRequest, Commit } from '@apollo-deploy/integrations';
import type { GitlabAdapterConfig } from '../types.js';

function glFetch(base: string, token: string, path: string, init?: RequestInit) {
  return fetch(`${base}/api/v4${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
}

function mapRepo(p: Record<string, unknown>): Repository {
  return {
    id: String(p['id']),
    name: p['name'] as string,
    fullName: p['path_with_namespace'] as string,
    private: p['visibility'] === 'private',
    defaultBranch: (p['default_branch'] as string) ?? 'main',
    url: p['web_url'] as string,
  };
}

export function createGitlabSourceControl(config: GitlabAdapterConfig): SourceControlCapability {
  const base = config.instanceUrl?.replace(/\/$/, '') ?? 'https://gitlab.com';

  return {
    async listRepositories(tokens: TokenSet, _opts?) {
      const resp = await glFetch(base, tokens.accessToken, '/projects?membership=true&per_page=50');
      if (!resp.ok) throw new CapabilityError('gitlab', 'listRepositories failed');
      const items = await resp.json() as Array<Record<string, unknown>>;
      return { items: items.map(mapRepo), hasMore: false };
    },

    async getRepository(tokens: TokenSet, repoId: string): Promise<Repository> {
      const encoded = encodeURIComponent(repoId);
      const resp = await glFetch(base, tokens.accessToken, `/projects/${encoded}`);
      if (!resp.ok) throw new CapabilityError('gitlab', `getRepository failed: ${resp.status}`);
      return mapRepo(await resp.json() as Record<string, unknown>);
    },

    async listBranches(tokens: TokenSet, repoId: string, _opts?) {
      const encoded = encodeURIComponent(repoId);
      const resp = await glFetch(base, tokens.accessToken, `/projects/${encoded}/repository/branches?per_page=50`);
      if (!resp.ok) throw new CapabilityError('gitlab', 'listBranches failed');
      const items = await resp.json() as Array<Record<string, unknown>>;
      return {
        items: items.map((b): Branch => {
          const commit = b['commit'] as Record<string, unknown>;
          return { name: b['name'] as string, sha: commit?.['id'] as string, protected: b['protected'] as boolean };
        }),
        hasMore: false,
      };
    },

    async getPullRequest(tokens: TokenSet, repoId: string, prNumber: number): Promise<PullRequest> {
      const encoded = encodeURIComponent(repoId);
      const resp = await glFetch(base, tokens.accessToken, `/projects/${encoded}/merge_requests/${prNumber}`);
      if (!resp.ok) throw new CapabilityError('gitlab', `getPullRequest failed: ${resp.status}`);
      const mr = await resp.json() as Record<string, unknown>;
      const author = mr['author'] as Record<string, unknown> | undefined;
      return {
        id: String(mr['id']),
        number: mr['iid'] as number,
        title: mr['title'] as string,
        state: mr['state'] as string,
        author: {
          id: String(author?.['id'] ?? ''),
          name: (author?.['name'] as string) ?? (author?.['username'] as string) ?? '',
          avatarUrl: author?.['avatar_url'] as string | undefined,
        },
        url: mr['web_url'] as string,
        sourceBranch: mr['source_branch'] as string,
        targetBranch: mr['target_branch'] as string,
      };
    },

    async createCommitStatus(tokens: TokenSet, repoId: string, sha: string, input) {
      const encoded = encodeURIComponent(repoId);
      const resp = await glFetch(base, tokens.accessToken, `/projects/${encoded}/statuses/${sha}`, {
        method: 'POST',
        body: JSON.stringify({
          state: input.state === 'success' ? 'success' : input.state === 'failure' ? 'failed' : input.state,
          name: input.context,
          description: input.description,
          target_url: input.targetUrl,
        }),
      });
      if (!resp.ok) throw new CapabilityError('gitlab', `createCommitStatus failed: ${resp.status}`);
    },

    async listCommits(tokens: TokenSet, repoId: string, _opts?) {
      const encoded = encodeURIComponent(repoId);
      const resp = await glFetch(base, tokens.accessToken, `/projects/${encoded}/repository/commits?per_page=30`);
      if (!resp.ok) throw new CapabilityError('gitlab', 'listCommits failed');
      const items = await resp.json() as Array<Record<string, unknown>>;
      return {
        items: items.map((c): Commit => ({
          sha: c['id'] as string,
          message: c['message'] as string,
          author: { id: (c['author_email'] as string) ?? '', name: (c['author_name'] as string) ?? '' },
          timestamp: new Date(c['authored_date'] as string),
          url: (c['web_url'] as string) ?? '',
        })),
        hasMore: false,
      };
    },
  };
}
