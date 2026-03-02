import { CapabilityError } from '@apollo-deploy/integrations';
import type { IssueTrackingCapability, TokenSet } from '@apollo-deploy/integrations';
import type { Issue, IssueComment, IssueFilters, ProjectRef } from '@apollo-deploy/integrations';
import type { GitlabAdapterConfig } from '../types.js';

function glFetch(base: string, token: string, path: string, init?: RequestInit) {
  return fetch(`${base}/api/v4${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
}

/**
 * issueId format: "projectPath:iid", e.g. "namespace/project:42"
 * This encodes both the project path and the issue IID that GitLab requires.
 */
function parseIssueId(issueId: string): { projectPath: string; iid: string } {
  const sep = issueId.lastIndexOf(':');
  if (sep === -1) throw new Error(`Invalid issueId: "${issueId}". Expected "projectPath:iid"`);
  return { projectPath: issueId.slice(0, sep), iid: issueId.slice(sep + 1) };
}

function mapGitlabIssue(i: Record<string, unknown>, projectPath?: string): Issue {
  const assignees = i['assignees'] as Array<Record<string, unknown>> | undefined;
  const assignee = assignees?.[0];
  return {
    id: String(i['id']),
    key: `${projectPath ?? ''}#${i['iid']}`,
    title: i['title'] as string,
    description: (i['description'] as string) || undefined,
    status: i['state'] as string,
    assignee: assignee
      ? { id: String(assignee['id']), name: (assignee['name'] as string) ?? (assignee['username'] as string) ?? '', avatarUrl: assignee['avatar_url'] as string | undefined }
      : undefined,
    url: i['web_url'] as string,
    labels: (i['labels'] as string[]) ?? [],
  };
}

export function createGitlabIssueTracking(config: GitlabAdapterConfig): IssueTrackingCapability {
  const base = config.instanceUrl?.replace(/\/$/, '') ?? 'https://gitlab.com';

  return {
    async listProjects(tokens: TokenSet): Promise<ProjectRef[]> {
      const resp = await glFetch(base, tokens.accessToken, '/projects?membership=true&per_page=50');
      if (!resp.ok) throw new CapabilityError('gitlab', 'listProjects failed');
      const items = await resp.json() as Array<Record<string, unknown>>;
      return items.map((p) => ({ id: String(p['id']), name: p['name'] as string, key: p['path_with_namespace'] as string }));
    },

    async listIssues(tokens: TokenSet, filters?: IssueFilters) {
      const projectPath = filters?.projectId;
      const url = projectPath
        ? `/projects/${encodeURIComponent(projectPath)}/issues?per_page=50`
        : '/issues?scope=assigned_to_me&per_page=50';
      const resp = await glFetch(base, tokens.accessToken, url);
      if (!resp.ok) throw new CapabilityError('gitlab', 'listIssues failed');
      const items = await resp.json() as Array<Record<string, unknown>>;
      return { items: items.map((i) => mapGitlabIssue(i, projectPath)), hasMore: false };
    },

    async getIssue(tokens: TokenSet, issueId: string): Promise<Issue> {
      const { projectPath, iid } = parseIssueId(issueId);
      const resp = await glFetch(base, tokens.accessToken, `/projects/${encodeURIComponent(projectPath)}/issues/${iid}`);
      if (!resp.ok) throw new CapabilityError('gitlab', `getIssue failed: ${resp.status}`);
      return mapGitlabIssue(await resp.json() as Record<string, unknown>, projectPath);
    },

    async createIssue(tokens: TokenSet, input) {
      const resp = await glFetch(base, tokens.accessToken, `/projects/${encodeURIComponent(input.projectId)}/issues`, {
        method: 'POST',
        body: JSON.stringify({ title: input.title, description: input.description, labels: input.labels?.join(',') }),
      });
      if (!resp.ok) throw new CapabilityError('gitlab', `createIssue failed: ${resp.status}`);
      return mapGitlabIssue(await resp.json() as Record<string, unknown>, input.projectId);
    },

    async updateIssue(tokens: TokenSet, issueId: string, input) {
      const { projectPath, iid } = parseIssueId(issueId);
      const resp = await glFetch(base, tokens.accessToken, `/projects/${encodeURIComponent(projectPath)}/issues/${iid}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...(input.title ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.status ? { state_event: input.status === 'closed' ? 'close' : 'reopen' } : {}),
          ...(input.labels ? { labels: input.labels.join(',') } : {}),
        }),
      });
      if (!resp.ok) throw new CapabilityError('gitlab', `updateIssue failed: ${resp.status}`);
      return mapGitlabIssue(await resp.json() as Record<string, unknown>, projectPath);
    },

    async addComment(tokens: TokenSet, issueId: string, body: string): Promise<IssueComment> {
      const { projectPath, iid } = parseIssueId(issueId);
      const resp = await glFetch(base, tokens.accessToken, `/projects/${encodeURIComponent(projectPath)}/issues/${iid}/notes`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
      if (!resp.ok) throw new CapabilityError('gitlab', `addComment failed: ${resp.status}`);
      const note = await resp.json() as Record<string, unknown>;
      const author = note['author'] as Record<string, unknown> | undefined;
      return {
        id: String(note['id']),
        body: note['body'] as string,
        author: {
          id: String(author?.['id'] ?? ''),
          name: (author?.['name'] as string) ?? (author?.['username'] as string) ?? '',
          avatarUrl: author?.['avatar_url'] as string | undefined,
        },
        createdAt: new Date(note['created_at'] as string),
      };
    },
  };
}
