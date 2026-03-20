import { CapabilityError } from "@apollo-deploy/integrations";
import type {
  IssueTrackingCapability,
  TokenSet,
} from "@apollo-deploy/integrations";
import type {
  Issue,
  IssueComment,
  IssueFilters,
  ProjectRef,
} from "@apollo-deploy/integrations";
import type { GitlabAdapterConfig } from "../types.js";

// eslint-disable-next-line max-params -- required parameters for this utility function
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

/**
 * issueId format: "projectPath:iid", e.g. "namespace/project:42"
 * This encodes both the project path and the issue IID that GitLab requires.
 */
function parseIssueId(issueId: string): { projectPath: string; iid: string } {
  const sep = issueId.lastIndexOf(":");
  if (sep === -1)
    throw new Error(
      `Invalid issueId: "${issueId}". Expected "projectPath:iid"`,
    );
  return { projectPath: issueId.slice(0, sep), iid: issueId.slice(sep + 1) };
}

function mapGitlabIssue(
  i: Record<string, unknown>,
  projectPath?: string,
): Issue {
  const assignees = i.assignees as Record<string, unknown>[] | undefined;
  const assignee = assignees?.[0];
  return {
    id: String(i.id),
    key: `${projectPath ?? ""}#${String(i.iid)}`,
    title: i.title as string,
    description:
      (i.description as string | null | undefined) != null &&
      (i.description as string) !== ""
        ? (i.description as string)
        : undefined,
    status: i.state as string,
    assignee:
      assignee != null
        ? {
            id:
              (assignee.id as number | string | undefined) != null
                ? String(assignee.id as number | string)
                : "",
            name:
              (assignee.name as string | undefined) ??
              (assignee.username as string | undefined) ??
              "",
            avatarUrl: assignee.avatar_url as string | undefined,
          }
        : undefined,
    url: i.web_url as string,
    labels: (i.labels as string[] | undefined) ?? [],
  };
}

export function createGitlabIssueTracking(
  config: GitlabAdapterConfig,
): IssueTrackingCapability {
  const base = config.instanceUrl?.replace(/\/$/, "") ?? "https://gitlab.com";

  return {
    async listProjects(tokens: TokenSet): Promise<ProjectRef[]> {
      const resp = await glFetch(
        base,
        tokens.accessToken,
        "/projects?membership=true&per_page=50",
      );
      const items = (await resp.json()) as Record<string, unknown>[];
      return items.map((p) => ({
        id: String(p.id),
        name: p.name as string,
        key: p.path_with_namespace as string,
      }));
    },

    async listIssues(tokens: TokenSet, filters?: IssueFilters) {
      const projectPath = filters?.projectId;
      if (projectPath != null && projectPath === "") {
        throw new Error("projectId cannot be empty");
      }
      const url =
        projectPath != null
          ? `/projects/${encodeURIComponent(projectPath)}/issues?per_page=50`
          : "/issues?scope=assigned_to_me&per_page=50";
      const resp = await glFetch(base, tokens.accessToken, url);
      const items = (await resp.json()) as Record<string, unknown>[];
      return {
        items: items.map((i) => mapGitlabIssue(i, projectPath)),
        hasMore: false,
      };
    },

    async getIssue(tokens: TokenSet, issueId: string): Promise<Issue> {
      const { projectPath, iid } = parseIssueId(issueId);
      const resp = await glFetch(
        base,
        tokens.accessToken,
        `/projects/${encodeURIComponent(projectPath)}/issues/${iid}`,
      );
      return mapGitlabIssue(
        (await resp.json()) as Record<string, unknown>,
        projectPath,
      );
    },

    async createIssue(tokens: TokenSet, input) {
      const resp = await glFetch(
        base,
        tokens.accessToken,
        `/projects/${encodeURIComponent(input.projectId)}/issues`,
        {
          method: "POST",
          body: JSON.stringify({
            title: input.title,
            description: input.description,
            labels: input.labels?.join(","),
          }),
        },
      );
      return mapGitlabIssue(
        (await resp.json()) as Record<string, unknown>,
        input.projectId,
      );
    },

    async updateIssue(tokens: TokenSet, issueId: string, input) {
      const { projectPath, iid } = parseIssueId(issueId);
      const resp = await glFetch(
        base,
        tokens.accessToken,
        `/projects/${encodeURIComponent(projectPath)}/issues/${iid}`,
        {
          method: "PUT",
          body: JSON.stringify({
            ...(input.title != null ? { title: input.title } : {}),
            ...(input.description !== undefined
              ? { description: input.description }
              : {}),
            ...(input.status != null
              ? { state_event: input.status === "closed" ? "close" : "reopen" }
              : {}),
            ...(input.labels != null ? { labels: input.labels.join(",") } : {}),
          }),
        },
      );
      return mapGitlabIssue(
        (await resp.json()) as Record<string, unknown>,
        projectPath,
      );
    },

    async addComment(
      tokens: TokenSet,
      issueId: string,
      body: string,
    ): Promise<IssueComment> {
      const { projectPath, iid } = parseIssueId(issueId);
      const resp = await glFetch(
        base,
        tokens.accessToken,
        `/projects/${encodeURIComponent(projectPath)}/issues/${iid}/notes`,
        {
          method: "POST",
          body: JSON.stringify({ body }),
        },
      );
      const note = (await resp.json()) as Record<string, unknown>;
      const author = note.author as Record<string, unknown> | undefined;
      return {
        id: String(note.id),
        body: note.body as string,
        author: {
          id:
            (author?.id as number | string | undefined) != null
              ? String(author?.id as number | string)
              : "",
          name:
            (author?.name as string | undefined) ??
            (author?.username as string | undefined) ??
            "",
          avatarUrl: author?.avatar_url as string | undefined,
        },
        createdAt: new Date(note.created_at as string),
      };
    },
  };
}
