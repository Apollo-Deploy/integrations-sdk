/**
 * GitHub source-control capability implementation.
 * Uses @octokit/rest as the HTTP client.
 */

import { Octokit } from '@octokit/rest';
import type { SourceControlCapability } from '@apollo-deploy/integrations';
import type { TokenSet, PaginationOpts, CommitListOpts, CommitStatusInput } from '@apollo-deploy/integrations';
import { mapRepository, mapBranch, mapPullRequest, mapCommit } from '../mappers/models.js';
import { mapGithubError } from '../mappers/errors.js';
import type { GithubAdapterConfig } from '../types.js';

export function createGithubSourceControl(_config: GithubAdapterConfig): SourceControlCapability {
  function client(tokens: TokenSet) {
    return new Octokit({ auth: tokens.accessToken });
  }

  function parseRepoId(repoId: string): { owner: string; repo: string } {
    const [owner, repo] = repoId.split('/');
    if (!owner || !repo) {
      throw new Error(`Invalid GitHub repoId '${repoId}'. Expected 'owner/repo'.`);
    }
    return { owner, repo };
  }

  return {
    async listRepositories(tokens, opts?: PaginationOpts) {
      try {
        const octokit = client(tokens);
        const perPage = opts?.limit ?? 30;
        const page = opts?.cursor ? Number(opts.cursor) : 1;

        const { data } = await octokit.rest.repos.listForAuthenticatedUser({
          per_page: perPage,
          page,
          sort: 'updated',
        });

        return {
          items: data.map((r) => mapRepository(r as unknown as Record<string, unknown>)),
          hasMore: data.length === perPage,
          cursor: data.length === perPage ? String(page + 1) : undefined,
        };
      } catch (err) {
        throw mapGithubError(err);
      }
    },

    async getRepository(tokens, repoId) {
      try {
        const { owner, repo } = parseRepoId(repoId);
        const octokit = client(tokens);
        const { data } = await octokit.rest.repos.get({ owner, repo });
        return mapRepository(data as unknown as Record<string, unknown>);
      } catch (err) {
        throw mapGithubError(err);
      }
    },

    async listBranches(tokens, repoId, opts?: PaginationOpts) {
      try {
        const { owner, repo } = parseRepoId(repoId);
        const octokit = client(tokens);
        const perPage = opts?.limit ?? 30;
        const page = opts?.cursor ? Number(opts.cursor) : 1;

        const { data } = await octokit.rest.repos.listBranches({
          owner,
          repo,
          per_page: perPage,
          page,
        });

        return {
          items: data.map((b) => mapBranch(b as unknown as Record<string, unknown>)),
          hasMore: data.length === perPage,
          cursor: data.length === perPage ? String(page + 1) : undefined,
        };
      } catch (err) {
        throw mapGithubError(err);
      }
    },

    async getPullRequest(tokens, repoId, prNumber) {
      try {
        const { owner, repo } = parseRepoId(repoId);
        const octokit = client(tokens);
        const { data } = await octokit.rest.pulls.get({ owner, repo, pull_number: prNumber });
        return mapPullRequest(data as unknown as Record<string, unknown>);
      } catch (err) {
        throw mapGithubError(err);
      }
    },

    async createCommitStatus(tokens, repoId, sha, status: CommitStatusInput) {
      try {
        const { owner, repo } = parseRepoId(repoId);
        const octokit = client(tokens);
        await octokit.rest.repos.createCommitStatus({
          owner,
          repo,
          sha,
          state: status.state,
          target_url: status.targetUrl,
          description: status.description,
          context: status.context,
        });
      } catch (err) {
        throw mapGithubError(err);
      }
    },

    async listCommits(tokens, repoId, opts?: CommitListOpts) {
      try {
        const { owner, repo } = parseRepoId(repoId);
        const octokit = client(tokens);
        const perPage = opts?.limit ?? 30;
        const page = opts?.cursor ? Number(opts.cursor) : 1;

        const { data } = await octokit.rest.repos.listCommits({
          owner,
          repo,
          sha: opts?.branch,
          since: opts?.since?.toISOString(),
          until: opts?.until?.toISOString(),
          per_page: perPage,
          page,
        });

        return {
          items: data.map((c) => mapCommit(c as unknown as Record<string, unknown>)),
          hasMore: data.length === perPage,
          cursor: data.length === perPage ? String(page + 1) : undefined,
        };
      } catch (err) {
        throw mapGithubError(err);
      }
    },
  };
}
