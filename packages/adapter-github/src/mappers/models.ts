/**
 * GitHub API response → normalized models.
 */
import type {
  Repository,
  Branch,
  PullRequest,
  Commit,
  ActorInfo,
} from "@apollo-deploy/integrations";

export function mapRepository(r: Record<string, unknown>): Repository {
  return {
    id: String(r.id),
    name: r.name as string,
    fullName: r.full_name as string,
    defaultBranch: (r.default_branch as string | undefined) ?? "main",
    private: Boolean(r.private),
    url: r.html_url as string,
  };
}

export function mapBranch(b: Record<string, unknown>): Branch {
  const commit = b.commit as Record<string, unknown> | undefined;
  return {
    name: b.name as string,
    sha: (commit?.sha as string | undefined) ?? "",
    protected: Boolean(b.protected),
  };
}

export function mapPullRequest(pr: Record<string, unknown>): PullRequest {
  const user = pr.user as Record<string, unknown> | undefined;
  const actor: ActorInfo = {
    id: user != null ? String(user.id) : "",
    name: user != null ? ((user.login as string | undefined) ?? "") : "",
    avatarUrl: user?.avatar_url as string | undefined,
  };

  const head = pr.head as Record<string, unknown> | undefined;
  const base = pr.base as Record<string, unknown> | undefined;
  return {
    id: String(pr.id),
    number: Number(pr.number),
    title: pr.title as string,
    state: pr.state as string,
    author: actor,
    url: pr.html_url as string,
    sourceBranch: head?.ref as string,
    targetBranch: base?.ref as string,
  };
}

export function mapCommit(c: Record<string, unknown>): Commit {
  const commitObj = c.commit as Record<string, unknown> | undefined;
  const authorInfo = commitObj?.author as Record<string, unknown> | undefined;
  const ghAuthor = c.author as Record<string, unknown> | undefined;
  const actor: ActorInfo = {
    id:
      (ghAuthor?.login as string | undefined) ??
      (authorInfo?.email as string | undefined) ??
      "",
    name: (authorInfo?.name as string | undefined) ?? "",
    avatarUrl: ghAuthor?.avatar_url as string | undefined,
  };

  return {
    sha: c.sha as string,
    message: (commitObj?.message as string | undefined) ?? "",
    author: actor,
    timestamp: new Date(
      (authorInfo?.date as string | undefined) ?? String(Date.now()),
    ),
    url: c.html_url as string,
  };
}
