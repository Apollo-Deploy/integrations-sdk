import type { ActorInfo, PaginationOpts } from "./shared.js";

// ─── Source Control ───────────────────────────────────────────────────────────

export interface Repository {
  id: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  url: string;
}

export interface Branch {
  name: string;
  sha: string;
  protected: boolean;
}

export interface PullRequest {
  id: string;
  number: number;
  title: string;
  state: string;
  author: ActorInfo;
  url: string;
  sourceBranch: string;
  targetBranch: string;
}

export interface Commit {
  sha: string;
  message: string;
  author: ActorInfo;
  timestamp: Date;
  url: string;
}

export interface CommitStatusInput {
  state: "pending" | "success" | "failure" | "error";
  targetUrl?: string;
  description?: string;
  context: string;
}

export interface CommitListOpts extends PaginationOpts {
  branch?: string;
  since?: Date;
  until?: Date;
}
