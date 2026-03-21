import type {
  Branch,
  ChangedFile,
  ChangedFilesOpts,
  CodeScanAlert,
  CodeScanAlertsOpts,
  Commit,
  CommitListOpts,
  CommitStatus,
  CommitStatusInput,
  CommitStatusesOpts,
  GetChangedFilesOpts,
  Paginated,
  PaginationOpts,
  PullRequest,
  Repository,
} from "../models/index.js";
import type { TokenSet } from "../oauth.js";

/**
 * Source-control capability.
 * Present on adapters that declare 'source-control' in their capabilities.
 *
 * All methods receive tokens as a parameter — adapters are stateless.
 */
export interface SourceControlCapability {
  listRepositories(
    tokens: TokenSet,
    opts?: PaginationOpts,
  ): Promise<Paginated<Repository>>;
  getRepository(tokens: TokenSet, repoId: string): Promise<Repository>;
  listBranches(
    tokens: TokenSet,
    repoId: string,
    opts?: PaginationOpts,
  ): Promise<Paginated<Branch>>;
  getPullRequest(
    tokens: TokenSet,
    repoId: string,
    prNumber: number,
  ): Promise<PullRequest>;
  createCommitStatus(
    tokens: TokenSet,
    repoId: string,
    sha: string,
    status: CommitStatusInput,
  ): Promise<void>;
  listCommits(
    tokens: TokenSet,
    repoId: string,
    opts?: CommitListOpts,
  ): Promise<Paginated<Commit>>;

  // ── Changed Files ──────────────────────────────────────────────────────────

  /**
   * List files changed in a pull request / merge request.
   */
  listPullRequestFiles(
    tokens: TokenSet,
    repoId: string,
    prNumber: number,
    opts?: ChangedFilesOpts,
  ): Promise<Paginated<ChangedFile>>;

  /**
   * List files changed in a specific commit.
   */
  listCommitFiles(
    tokens: TokenSet,
    repoId: string,
    sha: string,
    opts?: ChangedFilesOpts,
  ): Promise<Paginated<ChangedFile>>;

  // ── Code Scanning ──────────────────────────────────────────────────────────

  /**
   * List code-scanning / SAST alerts for a repository.
   * Throws CapabilityError with `retryable: false` if the service doesn't
   * support code scanning.
   */
  listCodeScanAlerts(
    tokens: TokenSet,
    repoId: string,
    opts?: CodeScanAlertsOpts,
  ): Promise<Paginated<CodeScanAlert>>;

  /**
   * Get a single code-scanning alert by its number.
   * Throws CapabilityError with `retryable: false` if unsupported.
   */
  getCodeScanAlert(
    tokens: TokenSet,
    repoId: string,
    alertNumber: number,
  ): Promise<CodeScanAlert>;

  // ── Commit Statuses (read) ─────────────────────────────────────────────────

  /**
   * List combined commit statuses for a given SHA.
   * Returns an empty page for services that don't support commit statuses.
   */
  listCommitStatuses(
    tokens: TokenSet,
    repoId: string,
    sha: string,
    opts?: CommitStatusesOpts,
  ): Promise<Paginated<CommitStatus>>;

  // ── Changed Files Between Refs ────────────────────────────────────────────

  /**
   * List files changed between two refs (tags, branches, or SHAs).
   *
   * Maps to:
   * - GitHub:  GET /repos/{owner}/{repo}/compare/{base}...{head}
   * - GitLab:  GET /projects/{id}/repository/compare?from={base}&to={head}
   */
  getChangedFiles(
    tokens: TokenSet,
    repoId: string,
    base: string,
    head: string,
    opts?: GetChangedFilesOpts,
  ): Promise<ChangedFile[]>;
}
