/**
 * MonitoringCapability — observability & error-monitoring operations.
 * Provider-agnostic interface implemented by Sentry, Datadog, Rollbar, New Relic, Bugsnag, etc.
 *
 * Provider-specific extensions (e.g. Sentry DSN keys, debug files, ingestion stats)
 * live in the adapter package as a sub-interface (e.g. SentryMonitoringCapability).
 *
 * Organized by domain:
 *   1. Organizations & Projects
 *   2. Issues (error groups)
 *   3. Events (individual occurrences)
 *   4. Releases & Deploys
 *   5. Performance & Web Vitals
 *   6. Metrics
 *   7. Logs
 *   8. Replays (optional — not all providers support session replay)
 *   9. Alerts
 *   10. Crons
 *   11. Team & Member management
 *   12. Tags
 *   13. User Feedback
 */

import type { TokenSet } from "../oauth.js";
import type { Paginated } from "../models/index.js";
import type {
  MonitoringOrganization,
  MonitoringProject,
  MonitoringIssue,
  MonitoringIssueListOpts,
  MonitoringUpdateIssueInput,
  BulkUpdateIssuesInput,
  MonitoringEvent,
  MonitoringEventListOpts,
  MonitoringRelease,
  MonitoringCreateReleaseInput,
  MonitoringDeploy,
  CreateDeployInput,
  MonitoringReleaseListOpts,
  WebVitalsData,
  MonitoringVitalsQueryOpts,
  MetricSeries,
  MetricQueryOpts,
  MonitoringLogEntry,
  LogQueryOpts,
  MonitoringReplay,
  ReplayListOpts,
  MonitoringAlertRule,
  MonitoringAlertIncident,
  AlertRuleListOpts,
  MonitoringCron,
  MonitoringTeam,
  MonitoringMember,
  MonitoringTagKey,
  MonitoringTagValue,
  MonitoringUserFeedback,
  CreateUserFeedbackInput,
} from "../models/monitoring.js";

export interface MonitoringCapability {
  // ═══════════════════════════════════════════════════════════════════
  // 1. ORGANIZATIONS & PROJECTS
  // ═══════════════════════════════════════════════════════════════════

  /** List all organizations the authenticated user belongs to. */
  listOrganizations(
    tokens: TokenSet,
  ): Promise<Paginated<MonitoringOrganization>>;

  /** Get a single organization by slug. */
  getOrganization(
    tokens: TokenSet,
    orgSlug: string,
  ): Promise<MonitoringOrganization>;

  /** List projects within an organization. */
  listProjects(
    tokens: TokenSet,
    orgSlug: string,
  ): Promise<Paginated<MonitoringProject>>;

  /** Get a single project. */
  getProject(
    tokens: TokenSet,
    orgSlug: string,
    projectSlug: string,
  ): Promise<MonitoringProject>;

  // ═══════════════════════════════════════════════════════════════════
  // 2. ISSUES (ERROR GROUPS)
  // ═══════════════════════════════════════════════════════════════════

  /** List issues (error groups) matching a query. */
  listIssues(
    tokens: TokenSet,
    orgSlug: string,
    opts?: MonitoringIssueListOpts,
  ): Promise<Paginated<MonitoringIssue>>;

  /** Get a single issue by ID. */
  getIssue(
    tokens: TokenSet,
    orgSlug: string,
    issueId: string,
  ): Promise<MonitoringIssue>;

  /** Update an issue — status, assignment, priority. */
  updateIssue(
    tokens: TokenSet,
    orgSlug: string,
    issueId: string,
    input: MonitoringUpdateIssueInput,
  ): Promise<MonitoringIssue>;

  /** Delete (permanently remove) an issue. */
  deleteIssue(
    tokens: TokenSet,
    orgSlug: string,
    issueId: string,
  ): Promise<void>;

  /** Bulk update multiple issues matching a query or list of IDs. */
  bulkUpdateIssues(
    tokens: TokenSet,
    orgSlug: string,
    input: BulkUpdateIssuesInput,
  ): Promise<void>;

  /** Bulk delete issues matching a query or list of IDs. */
  bulkDeleteIssues(
    tokens: TokenSet,
    orgSlug: string,
    issueIds: string[],
  ): Promise<void>;

  // ═══════════════════════════════════════════════════════════════════
  // 3. EVENTS (INDIVIDUAL OCCURRENCES)
  // ═══════════════════════════════════════════════════════════════════

  /** List events for a specific issue. */
  listIssueEvents(
    tokens: TokenSet,
    orgSlug: string,
    issueId: string,
    opts?: MonitoringEventListOpts,
  ): Promise<Paginated<MonitoringEvent>>;

  /** Get the latest event for an issue. */
  getLatestIssueEvent(
    tokens: TokenSet,
    orgSlug: string,
    issueId: string,
  ): Promise<MonitoringEvent>;

  /** Get a specific event by ID within a project. */
  getEvent(
    tokens: TokenSet,
    orgSlug: string,
    projectSlug: string,
    eventId: string,
  ): Promise<MonitoringEvent>;

  /** List all events for a project (raw event stream). */
  listProjectEvents(
    tokens: TokenSet,
    orgSlug: string,
    projectSlug: string,
    opts?: MonitoringEventListOpts,
  ): Promise<Paginated<MonitoringEvent>>;

  // ═══════════════════════════════════════════════════════════════════
  // 4. RELEASES & DEPLOYS
  // ═══════════════════════════════════════════════════════════════════

  /** List releases for an organization. */
  listReleases(
    tokens: TokenSet,
    orgSlug: string,
    opts?: MonitoringReleaseListOpts,
  ): Promise<Paginated<MonitoringRelease>>;

  /** Get a single release by version string. */
  getRelease(
    tokens: TokenSet,
    orgSlug: string,
    version: string,
  ): Promise<MonitoringRelease>;

  /** Create a new release (attach commits, source maps ref). */
  createRelease(
    tokens: TokenSet,
    orgSlug: string,
    input: MonitoringCreateReleaseInput,
  ): Promise<MonitoringRelease>;

  /** Update an existing release (e.g. set dateReleased). */
  updateRelease(
    tokens: TokenSet,
    orgSlug: string,
    version: string,
    input: Partial<MonitoringCreateReleaseInput>,
  ): Promise<MonitoringRelease>;

  /** Delete a release. Only succeeds if no events are attached. */
  deleteRelease(
    tokens: TokenSet,
    orgSlug: string,
    version: string,
  ): Promise<void>;

  /** List deploy records for a release. */
  listDeploys(
    tokens: TokenSet,
    orgSlug: string,
    version: string,
  ): Promise<MonitoringDeploy[]>;

  /** Create a deploy record for a release. */
  createDeploy(
    tokens: TokenSet,
    orgSlug: string,
    version: string,
    input: CreateDeployInput,
  ): Promise<MonitoringDeploy>;

  // ═══════════════════════════════════════════════════════════════════
  // 5. PERFORMANCE & WEB VITALS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Query web vitals data (LCP, FID, CLS, FCP, TTFB, INP) for transactions.
   * Returns per-transaction aggregated vitals using the Discover/EAP API.
   */
  getWebVitals(
    tokens: TokenSet,
    orgSlug: string,
    opts: MonitoringVitalsQueryOpts,
  ): Promise<WebVitalsData>;

  /**
   * Get performance score breakdown per transaction.
   * Returns scores 0–100 for LCP, FID, CLS, FCP, TTFB grouped by page.
   */
  getPerformanceScores(
    tokens: TokenSet,
    orgSlug: string,
    opts: MonitoringVitalsQueryOpts,
  ): Promise<WebVitalsData>;

  // ═══════════════════════════════════════════════════════════════════
  // 6. METRICS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Query a custom or built-in metric time series.
   */
  queryMetrics(
    tokens: TokenSet,
    orgSlug: string,
    opts: MetricQueryOpts,
  ): Promise<MetricSeries[]>;

  /** List available metric names/keys for an organization. */
  listMetrics(
    tokens: TokenSet,
    orgSlug: string,
    opts?: { project?: string; query?: string },
  ): Promise<
    {
      key: string;
      name: string;
      type: string;
      unit: string;
      operations: string[];
    }[]
  >;

  // ═══════════════════════════════════════════════════════════════════
  // 7. LOGS (STRUCTURED LOGS)
  // ═══════════════════════════════════════════════════════════════════

  /** Query structured logs (Sentry Logs / EAP Logs). */
  queryLogs(
    tokens: TokenSet,
    orgSlug: string,
    opts: LogQueryOpts,
  ): Promise<Paginated<MonitoringLogEntry>>;

  // ═══════════════════════════════════════════════════════════════════
  // 8. REPLAYS (OPTIONAL — not all providers support session replay)
  // ═══════════════════════════════════════════════════════════════════

  /** List Session Replays for a project. */
  listReplays?(
    tokens: TokenSet,
    orgSlug: string,
    opts?: ReplayListOpts,
  ): Promise<Paginated<MonitoringReplay>>;

  /** Get a single replay by ID. */
  getReplay?(
    tokens: TokenSet,
    orgSlug: string,
    replayId: string,
  ): Promise<MonitoringReplay>;

  /** Get the count of errors that occurred during a replay. */
  getReplayErrorCount?(
    tokens: TokenSet,
    orgSlug: string,
    replayId: string,
  ): Promise<number>;

  // ═══════════════════════════════════════════════════════════════════
  // 9. ALERTS
  // ═══════════════════════════════════════════════════════════════════

  /** List alert rules for a project. */
  listAlertRules(
    tokens: TokenSet,
    orgSlug: string,
    opts?: AlertRuleListOpts,
  ): Promise<Paginated<MonitoringAlertRule>>;

  /** Get a single alert rule by ID. */
  getAlertRule(
    tokens: TokenSet,
    orgSlug: string,
    ruleId: string,
  ): Promise<MonitoringAlertRule>;

  /** List active alert incidents. */
  listAlertIncidents(
    tokens: TokenSet,
    orgSlug: string,
    opts?: { project?: string; status?: "open" | "closed" },
  ): Promise<Paginated<MonitoringAlertIncident>>;

  /** Get a single alert incident by identifier. */
  getAlertIncident(
    tokens: TokenSet,
    orgSlug: string,
    incidentId: string,
  ): Promise<MonitoringAlertIncident>;

  // ═══════════════════════════════════════════════════════════════════
  // 10. CRON MONITORS
  // ═══════════════════════════════════════════════════════════════════

  /** List all cron monitors for a project. */
  listCrons(
    tokens: TokenSet,
    orgSlug: string,
    projectSlug: string,
  ): Promise<Paginated<MonitoringCron>>;

  /** Get a single cron monitor by slug. */
  getCron(
    tokens: TokenSet,
    orgSlug: string,
    projectSlug: string,
    cronSlug: string,
  ): Promise<MonitoringCron>;

  // ═══════════════════════════════════════════════════════════════════
  // 11. TEAM & MEMBER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════

  /** List teams in an organization. */
  listTeams(
    tokens: TokenSet,
    orgSlug: string,
  ): Promise<Paginated<MonitoringTeam>>;

  /** List members of an organization. */
  listMembers(
    tokens: TokenSet,
    orgSlug: string,
  ): Promise<Paginated<MonitoringMember>>;

  // ═══════════════════════════════════════════════════════════════════
  // 12. TAGS
  // ═══════════════════════════════════════════════════════════════════

  /** List tag keys for a project. */
  listTagKeys(
    tokens: TokenSet,
    orgSlug: string,
    projectSlug: string,
  ): Promise<MonitoringTagKey[]>;

  /** List values for a specific tag key. */
  listTagValues(
    tokens: TokenSet,
    orgSlug: string,
    projectSlug: string,
    tagKey: string,
  ): Promise<Paginated<MonitoringTagValue>>;

  // ═══════════════════════════════════════════════════════════════════
  // 13. USER FEEDBACK
  // ═══════════════════════════════════════════════════════════════════

  /** List user feedback reports for a project. */
  listUserFeedback(
    tokens: TokenSet,
    orgSlug: string,
    projectSlug: string,
  ): Promise<Paginated<MonitoringUserFeedback>>;

  /** Submit user feedback for an event. */
  createUserFeedback(
    tokens: TokenSet,
    orgSlug: string,
    projectSlug: string,
    input: CreateUserFeedbackInput,
  ): Promise<MonitoringUserFeedback>;
}
