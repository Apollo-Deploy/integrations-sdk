import type { ActorInfo, PaginationOpts } from './shared.js';

// ─── Issue Tracking ───────────────────────────────────────────────────────────

export interface Issue {
  id: string;
  key: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  assignee?: ActorInfo;
  url: string;
  labels: string[];
}

export interface CreateIssueInput {
  projectId: string;
  title: string;
  description?: string;
  priority?: string;
  assigneeId?: string;
  labels?: string[];
}

export interface UpdateIssueInput {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  assigneeId?: string;
  labels?: string[];
}

export interface IssueComment {
  id: string;
  body: string;
  author: ActorInfo;
  createdAt: Date;
}

export interface ProjectRef {
  id: string;
  key: string;
  name: string;
}

export interface IssueFilters extends PaginationOpts {
  status?: string;
  assigneeId?: string;
  projectId?: string;
  labels?: string[];
}
