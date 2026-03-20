import type {
  CreateIssueInput,
  Issue,
  IssueComment,
  IssueFilters,
  Paginated,
  ProjectRef,
  UpdateIssueInput,
} from "../models/index.js";
import type { TokenSet } from "../oauth.js";

/**
 * Issue-tracking capability.
 * Present on adapters that declare 'issue-tracking' in their capabilities.
 *
 * All methods receive tokens as a parameter — adapters are stateless.
 */
export interface IssueTrackingCapability {
  listIssues(
    tokens: TokenSet,
    filters?: IssueFilters,
  ): Promise<Paginated<Issue>>;
  getIssue(tokens: TokenSet, issueId: string): Promise<Issue>;
  createIssue(tokens: TokenSet, input: CreateIssueInput): Promise<Issue>;
  updateIssue(
    tokens: TokenSet,
    issueId: string,
    input: UpdateIssueInput,
  ): Promise<Issue>;
  addComment(
    tokens: TokenSet,
    issueId: string,
    body: string,
  ): Promise<IssueComment>;
  listProjects(tokens: TokenSet): Promise<ProjectRef[]>;
}
