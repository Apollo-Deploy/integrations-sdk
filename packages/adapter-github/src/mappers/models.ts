/**
 * GitHub API response → normalized models.
 */
import type {
  Repository,
  Branch,
  PullRequest,
  Commit,
  ActorInfo,
} from '@apollo-deploy/integrations';

export function mapRepository(r: Record<string, unknown>): Repository {
  return {
    id: String(r['id']),
    name: r['name'] as string,
    fullName: r['full_name'] as string,
    defaultBranch: (r['default_branch'] as string) ?? 'main',
    private: Boolean(r['private']),
    url: r['html_url'] as string,
  };
}

export function mapBranch(b: Record<string, unknown>): Branch {
  return {
    name: b['name'] as string,
    sha: ((b['commit'] as any)?.sha as string) ?? '',
    protected: Boolean(b['protected']),
  };
}

export function mapPullRequest(pr: Record<string, unknown>): PullRequest {
  const user = pr['user'] as Record<string, unknown>;
  const actor: ActorInfo = {
    id: String(user?.['id'] ?? ''),
    name: String(user?.['login'] ?? ''),
    avatarUrl: user?.['avatar_url'] as string | undefined,
  };

  return {
    id: String(pr['id']),
    number: Number(pr['number']),
    title: pr['title'] as string,
    state: pr['state'] as string,
    author: actor,
    url: pr['html_url'] as string,
    sourceBranch: (pr['head'] as any)?.ref as string,
    targetBranch: (pr['base'] as any)?.ref as string,
  };
}

export function mapCommit(c: Record<string, unknown>): Commit {
  const authorInfo = (c['commit'] as any)?.author as Record<string, unknown> | undefined;
  const actor: ActorInfo = {
    id: ((c['author'] as any)?.login as string) ?? authorInfo?.['email'] as string ?? '',
    name: (authorInfo?.['name'] as string) ?? '',
    avatarUrl: (c['author'] as any)?.avatar_url as string | undefined,
  };

  return {
    sha: c['sha'] as string,
    message: (c['commit'] as any)?.message as string ?? '',
    author: actor,
    timestamp: new Date((c['commit'] as any)?.author?.date as string ?? Date.now()),
    url: c['html_url'] as string,
  };
}
