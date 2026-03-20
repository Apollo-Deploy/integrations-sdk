import { CapabilityError } from "@apollo-deploy/integrations";
import type {
  SourceControlCapability,
  TokenSet,
  Repository,
  Branch,
  PullRequest,
  Commit,
} from "@apollo-deploy/integrations";
import type { GitlabAdapterConfig } from "../types.js";

// eslint-disable-next-line max-params -- implements interface; method signature is contractual
async function glFetch(
  base: string,
  token: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const resp = await fetch(`${base}/api/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...((init?.headers as Record<string, string> | undefined) ?? {}),
    },
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new CapabilityError(
      "gitlab",
      `GitLab API ${String(resp.status)}: ${body}`,
      resp.status === 429 || resp.status >= 500,
    );
  }
  return resp;
}

function mapRepo(p: Record<string, unknown>): Repository {
  return {
    id: String(p.id),
    name: p.name as string,
    fullName: p.path_with_namespace as string,
    private: p.visibility === "private",
    defaultBranch: (p.default_branch as string | undefined) ?? "main",
    url: p.web_url as string,
  };
}

export function createGitlabSourceControl(
  config: GitlabAdapterConfig,
): SourceControlCapability {
  const base = config.instanceUrl?.replace(/\/$/, "") ?? "https://gitlab.com";

  return {
    async listRepositories(tokens: TokenSet, _opts?) {
      const resp = await glFetch(
        base,
        tokens.accessToken,
        "/projects?membership=true&per_page=50",
      );
      const items = (await resp.json()) as Record<string, unknown>[];
      return { items: items.map(mapRepo), hasMore: false };
    },

    async getRepository(tokens: TokenSet, repoId: string): Promise<Repository> {
      const encoded = encodeURIComponent(repoId);
      const resp = await glFetch(
        base,
        tokens.accessToken,
        `/projects/${encoded}`,
      );
      return mapRepo((await resp.json()) as Record<string, unknown>);
    },

    async listBranches(tokens: TokenSet, repoId: string, _opts?) {
      const encoded = encodeURIComponent(repoId);
      const resp = await glFetch(
        base,
        tokens.accessToken,
        `/projects/${encoded}/repository/branches?per_page=50`,
      );
      const items = (await resp.json()) as Record<string, unknown>[];
      return {
        items: items.map((b): Branch => {
          const commit2 = b.commit as Record<string, unknown>;
          return {
            name: b.name as string,
            sha: commit2.id as string,
            protected: b.protected as boolean,
          };
        }),
        hasMore: false,
      };
    },

    async getPullRequest(
      tokens: TokenSet,
      repoId: string,
      prNumber: number,
    ): Promise<PullRequest> {
      const encoded = encodeURIComponent(repoId);
      const resp = await glFetch(
        base,
        tokens.accessToken,
        `/projects/${encoded}/merge_requests/${String(prNumber)}`,
      );
      const mr = (await resp.json()) as Record<string, unknown>;
      const author = mr.author as Record<string, unknown> | undefined;
      return {
        id: String(mr.id),
        number: mr.iid as number,
        title: mr.title as string,
        state: mr.state as string,
        author: {
          id: author?.id != null ? String(author.id as number | string) : "",
          name:
            (author?.name as string | undefined) ??
            (author?.username as string | undefined) ??
            "",
          avatarUrl: author?.avatar_url as string | undefined,
        },
        url: mr.web_url as string,
        sourceBranch: mr.source_branch as string,
        targetBranch: mr.target_branch as string,
      };
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async createCommitStatus(
      tokens: TokenSet,
      repoId: string,
      sha: string,
      input,
    ) {
      const encoded = encodeURIComponent(repoId);
      await glFetch(
        base,
        tokens.accessToken,
        `/projects/${encoded}/statuses/${sha}`,
        {
          method: "POST",
          body: JSON.stringify({
            state:
              input.state === "success"
                ? "success"
                : input.state === "failure"
                  ? "failed"
                  : input.state,
            name: input.context,
            description: input.description,
            target_url: input.targetUrl,
          }),
        },
      );
    },

    async listCommits(tokens: TokenSet, repoId: string, _opts?) {
      const encoded = encodeURIComponent(repoId);
      const resp = await glFetch(
        base,
        tokens.accessToken,
        `/projects/${encoded}/repository/commits?per_page=30`,
      );
      const items = (await resp.json()) as Record<string, unknown>[];
      return {
        items: items.map(
          (c): Commit => ({
            sha: c.id as string,
            message: c.message as string,
            author: {
              id: (c.author_email as string | undefined) ?? "",
              name: (c.author_name as string | undefined) ?? "",
            },
            timestamp: new Date(c.authored_date as string),
            url: (c.web_url as string | undefined) ?? "",
          }),
        ),
        hasMore: false,
      };
    },
  };
}
