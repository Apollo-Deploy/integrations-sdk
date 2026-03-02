import type {
  Branch,
  Commit,
  CommitListOpts,
  CommitStatusInput,
  Paginated,
  PaginationOpts,
  PullRequest,
  Repository,
} from '../models.js';
import type { TokenSet } from '../oauth.js';

/**
 * Source-control capability.
 * Present on adapters that declare 'source-control' in their capabilities.
 *
 * All methods receive tokens as a parameter — adapters are stateless.
 */
export interface SourceControlCapability {
  listRepositories(tokens: TokenSet, opts?: PaginationOpts): Promise<Paginated<Repository>>;
  getRepository(tokens: TokenSet, repoId: string): Promise<Repository>;
  listBranches(tokens: TokenSet, repoId: string, opts?: PaginationOpts): Promise<Paginated<Branch>>;
  getPullRequest(tokens: TokenSet, repoId: string, prNumber: number): Promise<PullRequest>;
  createCommitStatus(tokens: TokenSet, repoId: string, sha: string, status: CommitStatusInput): Promise<void>;
  listCommits(tokens: TokenSet, repoId: string, opts?: CommitListOpts): Promise<Paginated<Commit>>;
}
