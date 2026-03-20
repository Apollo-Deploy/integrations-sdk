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

// ─── Changed Files ────────────────────────────────────────────────────────────

export type ChangedFileStatus =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "unchanged"
  | "unknown";

export interface ChangedFile {
  filename: string;
  status: ChangedFileStatus;
  additions: number;
  deletions: number;
  changes: number;
  /** Unified diff patch, if provided by the service. */
  patch?: string;
  /** Previous filename when status is "renamed". */
  previousFilename?: string;
}

export interface ChangedFilesOpts extends PaginationOpts {
  /** Filter to files under a given path prefix. */
  path?: string;
}

// ─── Code Scanning ───────────────────────────────────────────────────────────

export type CodeScanSeverity =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "warning"
  | "note"
  | "error"
  | "unknown";

export type CodeScanState = "open" | "dismissed" | "fixed" | "unknown";

export interface CodeScanLocation {
  path: string;
  startLine: number;
  endLine?: number;
  startColumn?: number;
  endColumn?: number;
}

export interface CodeScanAlert {
  id: string;
  number: number;
  state: CodeScanState;
  severity: CodeScanSeverity;
  /** Human-readable rule/check name. */
  rule: string;
  /** Rule description. */
  description: string;
  /** Tool that produced this alert (e.g. "CodeQL", "Semgrep"). */
  tool: string;
  location: CodeScanLocation;
  url: string;
  createdAt: Date;
  dismissedAt?: Date;
  /** Who dismissed the alert, if applicable. */
  dismissedBy?: ActorInfo;
  dismissedReason?: string;
}

export interface CodeScanAlertsOpts extends PaginationOpts {
  /** Filter by state. Defaults to "open". */
  state?: CodeScanState | "all";
  /** Filter by severity. */
  severity?: CodeScanSeverity;
  /** Filter to a specific ref (branch/tag/SHA). */
  ref?: string;
}

// ─── Commit Status (read model) ───────────────────────────────────────────────

export type CommitStatusState =
  | "pending"
  | "success"
  | "failure"
  | "error"
  | "unknown";

export interface CommitStatus {
  id: string;
  state: CommitStatusState;
  context: string;
  description?: string;
  targetUrl?: string;
  createdAt: Date;
  creator?: ActorInfo;
}

export interface CommitStatusesOpts extends PaginationOpts {
  /** Filter to a specific context/check name. */
  context?: string;
}

// ─── Release Window Comparison ───────────────────────────────────────────────

/**
 * One end of a release window — a tag, branch, or commit SHA.
 */
export interface ReleaseWindowRef {
  /** The ref as supplied (tag name, branch name, or SHA). */
  ref: string;
  /** Resolved commit SHA, if returned by the service. */
  sha?: string;
  /** Timestamp of the ref's commit, if resolvable. */
  timestamp?: Date;
}

/**
 * Result of comparing two release windows (base → head).
 */
export interface ReleaseWindowComparison {
  base: ReleaseWindowRef;
  head: ReleaseWindowRef;
  /** Relationship between base and head. */
  status: "ahead" | "behind" | "diverged" | "identical";
  /** How many commits head is ahead of base. */
  aheadBy: number;
  /** How many commits head is behind base (>0 only when diverged/behind). */
  behindBy: number;
  /** Common ancestor SHA. */
  mergeBaseSha?: string;
  /** Commits reachable from head but not base, most-recent first. */
  commits: Commit[];
  /** Files that differ between base and head. */
  changedFiles: ChangedFile[];
  totalAdditions: number;
  totalDeletions: number;
  /** Merged PRs/MRs whose merge commit falls inside the window (if requested). */
  mergedPullRequests: PullRequest[];
  /** Link to the comparison view on the service. */
  url?: string;
}

export interface CompareReleaseWindowsOpts {
  /** Include unified diff patches in the changed-file results. Default: false. */
  includeDiffs?: boolean;
  /**
   * Fetch merged pull requests whose merge commit falls in the window.
   * Default: false.
   */
  includePullRequests?: boolean;
  /** Restrict changed files to those under this path prefix. */
  path?: string;
}
