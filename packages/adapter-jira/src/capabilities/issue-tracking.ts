/**
 * Jira issue-tracking capability.
 * Uses Jira REST API v3 via direct fetch (no vendor SDK dependency on jira.js at runtime).
 * cloudId is sourced from connection providerData.
 */
import type {
  IssueTrackingCapability,
  TokenSet,
  CreateIssueInput,
  UpdateIssueInput,
} from "@apollo-deploy/integrations";
import { CapabilityError } from "@apollo-deploy/integrations";
import type { JiraAdapterConfig } from "../types.js";

export function createJiraIssueTracking(
  _config: JiraAdapterConfig,
): IssueTrackingCapability {
  function baseUrl(cloudId: string): string {
    return `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3`;
  }

  function headers(accessToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  }

  function cloudIdFromTokens(tokens: TokenSet): string {
    const id = tokens.providerData.cloudId;
    if (id == null || (typeof id === "string" && id === "")) {
      throw new CapabilityError(
        "jira",
        "cloudId missing from providerData — re-authorise",
        false,
      );
    }
    return id as string;
  }

  async function apiGet<T>(url: string, token: string): Promise<T> {
    const resp = await fetch(url, { headers: headers(token) });
    if (!resp.ok) {
      const err = await resp.text();
      throw new CapabilityError(
        "jira",
        `GET ${url} failed ${String(resp.status)}: ${err}`,
        resp.status === 429 || resp.status >= 500,
      );
    }
    return resp.json() as Promise<T>;
  }

  return {
    async listIssues(tokens, filters) {
      const cloudId = cloudIdFromTokens(tokens);
      const jql =
        filters?.projectId != null
          ? `project = "${filters.projectId}"`
          : "ORDER BY created DESC";
      const data = await apiGet<{
        issues: unknown[];
        total: number;
        maxResults: number;
      }>(
        `${baseUrl(cloudId)}/search?jql=${encodeURIComponent(jql)}&maxResults=${String(filters?.limit ?? 50)}`,
        tokens.accessToken,
      );
      return {
        items: data.issues.map(mapIssue),
        hasMore: data.issues.length < data.total,
      };
    },

    async getIssue(tokens, issueId) {
      const cloudId = cloudIdFromTokens(tokens);
      const data = await apiGet<unknown>(
        `${baseUrl(cloudId)}/issue/${issueId}`,
        tokens.accessToken,
      );
      return mapIssue(data);
    },

    async createIssue(tokens, input: CreateIssueInput) {
      const cloudId = cloudIdFromTokens(tokens);
      const resp = await fetch(`${baseUrl(cloudId)}/issue`, {
        method: "POST",
        headers: headers(tokens.accessToken),
        body: JSON.stringify({
          fields: {
            project: { key: input.projectId },
            summary: input.title,
            description:
              input.description != null && input.description !== ""
                ? {
                    type: "doc",
                    version: 1,
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: input.description }],
                      },
                    ],
                  }
                : undefined,
            issuetype: { name: "Story" },
          },
        }),
      });
      if (!resp.ok) {
        const err = await resp.text();
        throw new CapabilityError(
          "jira",
          `createIssue failed ${String(resp.status)}: ${err}`,
          resp.status === 429 || resp.status >= 500,
        );
      }
      const created = (await resp.json()) as { key: string; id: string };
      return this.getIssue(tokens, created.key);
    },

    async updateIssue(tokens, issueId, input: UpdateIssueInput) {
      const cloudId = cloudIdFromTokens(tokens);
      const fields: Record<string, unknown> = {};
      if (input.title != null) {
        fields.summary = input.title;
      }
      if (input.status != null) {
        fields.status = { name: input.status };
      }
      const resp = await fetch(`${baseUrl(cloudId)}/issue/${issueId}`, {
        method: "PUT",
        headers: headers(tokens.accessToken),
        body: JSON.stringify({ fields }),
      });
      if (!resp.ok && resp.status !== 204) {
        throw new CapabilityError(
          "jira",
          `updateIssue failed ${String(resp.status)}`,
          resp.status === 429 || resp.status >= 500,
        );
      }
      return this.getIssue(tokens, issueId);
    },

    async addComment(tokens, issueId, body) {
      const cloudId = cloudIdFromTokens(tokens);
      const resp = await fetch(`${baseUrl(cloudId)}/issue/${issueId}/comment`, {
        method: "POST",
        headers: headers(tokens.accessToken),
        body: JSON.stringify({
          body: {
            type: "doc",
            version: 1,
            content: [
              { type: "paragraph", content: [{ type: "text", text: body }] },
            ],
          },
        }),
      });
      if (!resp.ok) {
        throw new CapabilityError(
          "jira",
          `addComment failed ${String(resp.status)}`,
          resp.status === 429 || resp.status >= 500,
        );
      }
      const data = (await resp.json()) as Record<string, unknown>;
      const author = data.author as Record<string, unknown> | undefined;
      return {
        id: data.id as string,
        body,
        author: {
          id: (author?.accountId as string | undefined) ?? "",
          name: (author?.displayName as string | undefined) ?? "",
        },
        createdAt: new Date(data.created as string),
      };
    },

    async listProjects(tokens) {
      const cloudId = cloudIdFromTokens(tokens);
      const data = await apiGet<{ values: unknown[] }>(
        `${baseUrl(cloudId)}/project/search`,
        tokens.accessToken,
      );
      return data.values.map((p) => {
        const proj = p as Record<string, unknown>;
        return {
          id: proj.id as string,
          key: proj.key as string,
          name: proj.name as string,
        };
      });
    },
  };
}

function mapIssue(raw: unknown): {
  id: string;
  key: string;
  title: string;
  description: string | undefined;
  status: string;
  priority: string | undefined;
  assignee: { id: string; name: string } | undefined;
  url: string;
  labels: string[];
} {
  const r = raw as Record<string, unknown>;
  const fields = (r.fields as Record<string, unknown> | undefined) ?? {};
  const assignee = fields.assignee as Record<string, unknown> | undefined;
  return {
    id: r.id as string,
    key: r.key as string,
    title: (fields.summary as string | undefined) ?? "",
    description: (
      fields.description as
        | { content?: { content?: { text?: string }[] }[] }
        | undefined
    )?.content?.[0]?.content?.[0]?.text,
    status: (fields.status as Record<string, unknown>).name as string,
    priority: (fields.priority as Record<string, unknown> | undefined)?.name as
      | string
      | undefined,
    assignee:
      assignee != null
        ? {
            id: (assignee.accountId as string | undefined) ?? "",
            name: (assignee.displayName as string | undefined) ?? "",
          }
        : undefined,
    url: "",
    labels: (fields.labels as string[] | undefined) ?? [],
  };
}
