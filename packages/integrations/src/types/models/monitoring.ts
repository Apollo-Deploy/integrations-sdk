/**
 * Monitoring domain models — provider-agnostic shapes for errors, vitals, logs,
 * replays, releases, alerts, and performance data.
 *
 * Implemented by Sentry, Datadog, Rollbar, New Relic, Bugsnag, etc.
 * Provider-specific extensions live in their respective adapter packages.
 */

// ─── Shared ───────────────────────────────────────────────────────────────────

export type MonitoringEnvironment = string; // e.g. 'production', 'staging'
export type MonitoringPlatform = string; // e.g. 'javascript', 'python', 'react-native'

// ─── Organizations & Projects ─────────────────────────────────────────────────

export interface MonitoringOrganization {
  id: string;
  slug: string;
  name: string;
  dateCreated: Date;
  features: string[];
  status: "active" | "pending_deletion" | "deletion_in_progress";
}

export interface MonitoringProject {
  id: string;
  slug: string;
  name: string;
  platform: MonitoringPlatform;
  dateCreated: Date;
  firstEvent?: Date;
  hasAccess: boolean;
  isMember: boolean;
  isBookmarked: boolean;
  status: "active" | "disabled" | "pending_deletion";
  features: string[];
  environments: string[];
  /** Client credential URL (e.g. DSN). Available on providers that expose per-project SDK credentials. */
  dsn?: string;
}

// ─── Issues (Error Groups) ────────────────────────────────────────────────────

export type IssueStatus =
  | "resolved"
  | "unresolved"
  | "ignored"
  | "reprocessing";
export type IssuePriority = "critical" | "high" | "medium" | "low";

export interface MonitoringIssue {
  id: string;
  /** Short human-readable identifier (e.g. PROJECT-123). Not all providers expose this. */
  shortId?: string;
  title: string;
  culprit?: string;
  type: "error" | "performance" | "feedback" | "uptime" | (string & {});
  status: IssueStatus;
  priority: IssuePriority;
  platform: MonitoringPlatform;
  project: Pick<MonitoringProject, "id" | "slug" | "name">;
  count: string; // total event count (string for cross-provider compatibility)
  userCount: number;
  firstSeen: Date;
  lastSeen: Date;
  isSubscribed: boolean;
  isBookmarked: boolean;
  isUnhandled: boolean;
  assignee?: MonitoringActor;
  tags: MonitoringTag[];
  /** Permalink to the issue detail page. */
  permalink: string;
  metadata: Record<string, unknown>;
}

export interface MonitoringIssueListOpts {
  projectSlug?: string;
  environment?: string;
  query?: string; // Sentry issue search syntax, e.g. 'is:unresolved'
  sort?: "date" | "new" | "priority" | "freq" | "user";
  limit?: number;
  cursor?: string;
}

export interface MonitoringUpdateIssueInput {
  status?: IssueStatus;
  assignee?: string; // username or email
  priority?: IssuePriority;
  isBookmarked?: boolean;
  isSubscribed?: boolean;
  hasSeen?: boolean;
}

export interface BulkUpdateIssuesInput extends MonitoringUpdateIssueInput {
  /** List of issue IDs to update. Empty = apply to all matching `query`. */
  ids?: string[];
  query?: string;
  environment?: string;
}

// ─── Events (Individual Error Occurrences) ───────────────────────────────────

export interface MonitoringHttpRequest {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  data?: unknown;
  queryString?: [string, string][] | Record<string, string>;
  cookies?: [string, string][] | Record<string, string>;
  env?: Record<string, string>;
}

export interface MonitoringEvent {
  id: string;
  eventId: string;
  message: string;
  title: string;
  type: "error" | "default" | "transaction" | (string & {});
  platform: MonitoringPlatform;
  timestamp: Date;
  dateCreated: Date;
  project: Pick<MonitoringProject, "id" | "slug" | "name">;
  release?: string;
  environment?: string;
  tags: MonitoringTag[];
  user?: MonitoringUser;
  request?: MonitoringHttpRequest;
  contexts: Record<string, Record<string, unknown>>;
  entries: MonitoringEventEntry[];
  errors: MonitoringEventError[];
  sdk?: { name: string; version: string };
  groupId?: string; // the parent issue ID
  groupingConfig?: Record<string, unknown>;
}

export interface MonitoringEventEntry {
  type:
    | "exception"
    | "message"
    | "request"
    | "breadcrumbs"
    | "stacktrace"
    | "template"
    | "spans";
  data: Record<string, unknown>;
}

export interface MonitoringEventError {
  type: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface MonitoringEventListOpts {
  environment?: string;
  query?: string;
  limit?: number;
  cursor?: string;
  full?: boolean; // include full event data
}

// ─── Stack Traces & Exceptions ───────────────────────────────────────────────

export interface StackFrame {
  filename: string;
  function: string;
  module?: string;
  lineNo?: number;
  colNo?: number;
  absPath?: string;
  context?: [number, string][];
  vars?: Record<string, unknown>;
  inApp: boolean;
}

export interface ExceptionValue {
  type: string;
  value: string;
  module?: string;
  mechanism?: {
    type: string;
    handled?: boolean;
    data?: Record<string, unknown>;
  };
  stacktrace?: { frames: StackFrame[] };
}

// ─── Tags & Users ────────────────────────────────────────────────────────────

export interface MonitoringTag {
  key: string;
  value: string;
}

export interface MonitoringTagKey {
  key: string;
  name: string;
  uniqueValues: number;
  canDelete: boolean;
  isBuiltin: boolean;
}

export interface MonitoringTagValue {
  value: string;
  count: number;
  lastSeen: Date;
  firstSeen: Date;
}

export interface MonitoringUser {
  id?: string;
  email?: string;
  username?: string;
  ipAddress?: string;
  name?: string;
  data?: Record<string, unknown>;
}

export interface MonitoringActor {
  type: "user" | "team";
  id: string;
  name: string;
  email?: string;
}

// ─── Releases ────────────────────────────────────────────────────────────────

export interface MonitoringRelease {
  version: string;
  shortVersion: string;
  dateCreated: Date;
  dateReleased?: Date;
  firstEvent?: Date;
  lastEvent?: Date;
  newGroups: number;
  commitCount: number;
  deployCount: number;
  adoptionStages?: Record<string, { stage: string }>;
  projects: Pick<MonitoringProject, "id" | "slug" | "name">[];
  authors: { name: string; email: string }[];
  lastCommit?: MonitoringCommitRef;
  /** Optional version metadata. Structure may vary by provider. */
  versionInfo?: {
    package: string;
    version: {
      raw: string;
      major: number;
      minor: number;
      patch: number;
      pre: string;
    };
    buildCode?: string;
    description: string;
  };
}

export interface MonitoringCreateReleaseInput {
  version: string;
  projects: string[]; // project slugs
  refs?: { repository: string; commit: string; previousCommit?: string }[];
  url?: string;
  dateReleased?: string; // ISO 8601
  commits?: MonitoringCommitRef[];
}

export interface MonitoringCommitRef {
  id: string;
  message?: string;
  timestamp?: Date;
  author?: { name: string; email: string };
  repository?: string;
}

export interface MonitoringDeploy {
  id: string;
  environment: string;
  dateStarted?: Date;
  dateFinished?: Date;
  url?: string;
  name?: string;
}

export interface CreateDeployInput {
  environment: string;
  url?: string;
  name?: string;
  dateStarted?: string; // ISO 8601
  dateFinished?: string; // ISO 8601
}

export interface MonitoringReleaseListOpts {
  projectSlug?: string;
  environment?: string;
  query?: string;
  limit?: number;
  cursor?: string;
  summaryStatsPeriod?: string; // e.g. '14d'
}

// ─── Performance / Transactions ───────────────────────────────────────────────

export interface PerformanceTransaction {
  id: string;
  transaction: string; // route/endpoint name
  project: string;
  environment?: string;
  timestamp: Date;
  duration: number; // ms
  status: TransactionStatus;
  tags: MonitoringTag[];
  measurements?: Record<string, { value: number; unit: string }>;
  breakdowns?: Record<string, { duration: number }>;
  spans?: PerformanceSpan[];
}

export type TransactionStatus =
  | "ok"
  | "cancelled"
  | "unknown"
  | "invalid_argument"
  | "deadline_exceeded"
  | "not_found"
  | "already_exists"
  | "permission_denied"
  | "resource_exhausted"
  | "failed_precondition"
  | "aborted"
  | "out_of_range"
  | "unimplemented"
  | "internal_error"
  | "unavailable"
  | "data_loss"
  | "unauthenticated";

export interface PerformanceSpan {
  spanId: string;
  parentSpanId?: string;
  traceId: string;
  op: string;
  description?: string;
  startTimestamp: Date;
  timestamp: Date;
  duration: number;
  status?: TransactionStatus;
  data?: Record<string, unknown>;
  tags?: Record<string, string>;
}

// ─── Web Vitals ───────────────────────────────────────────────────────────────

export type WebVitalMetric =
  | "lcp"
  | "fid"
  | "cls"
  | "fcp"
  | "ttfb"
  | "inp"
  | "p75_lcp"
  | "p75_fid"
  | "p75_cls";

export interface WebVitalsData {
  project: string;
  environment?: string;
  period: string;
  data: {
    transaction: string;
    lcp?: number;
    fcp?: number;
    cls?: number;
    fid?: number;
    ttfb?: number;
    inp?: number;
    /** User misery score (0–1). */
    userMisery?: number;
    /** App performance score (0–100). */
    performanceScore?: number;
    tpm: number; // transactions per minute
    failureRate: number;
    p50?: number;
    p75?: number;
    p95?: number;
    p99?: number;
  }[];
}

export interface MonitoringVitalsQueryOpts {
  project?: string;
  environment?: string;
  transaction?: string;
  statsPeriod?: string; // e.g. '14d', '24h'
  start?: string; // ISO 8601
  end?: string; // ISO 8601
  limit?: number;
  cursor?: string;
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

export type MetricAggregate =
  | "sum"
  | "count"
  | "avg"
  | "min"
  | "max"
  | "p50"
  | "p75"
  | "p90"
  | "p95"
  | "p99";

export interface MetricSeries {
  group: Record<string, string>; // tag filters applied
  by: Record<string, string>; // group-by dimensions
  series: Record<string, [number, number | null][]>;
}

export interface MetricQueryOpts {
  project?: string;
  environment?: string;
  /** Metric identifier. Sentry: MRI e.g. 'd:custom/page_load@ms'. Datadog: 'system.cpu.user'. Rollbar: metric name. */
  metric: string;
  aggregate: MetricAggregate;
  groupBy?: string[]; // tag keys to group by
  query?: string; // filter expression
  statsPeriod?: string;
  start?: string;
  end?: string;
  interval?: string; // e.g. '1h', '5m'
}

// ─── Logs (Structured Logs) ─────────────────────────────────────────────────

export type LogLevel =
  | "trace"
  | "debug"
  | "info"
  | "warning"
  | "error"
  | "fatal";

export interface MonitoringLogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  environment?: string;
  release?: string;
  tags: MonitoringTag[];
  attributes: Record<string, string | number | boolean>;
  traceId?: string;
  spanId?: string;
  /** The SDK that sent the log. */
  sdk?: { name: string; version: string };
  project: Pick<MonitoringProject, "id" | "slug" | "name">;
}

export interface LogQueryOpts {
  project?: string;
  environment?: string;
  query?: string; // log search expression
  level?: LogLevel;
  statsPeriod?: string;
  start?: string;
  end?: string;
  limit?: number;
  cursor?: string;
}

// ─── Replays ──────────────────────────────────────────────────────────────────

export interface MonitoringReplay {
  id: string;
  replayId: string;
  projectId: string;
  environment?: string;
  timestamp: Date;
  startedAt: Date;
  finishedAt: Date;
  duration: number; // seconds
  countUrls: number;
  countSegments: number;
  countErrors: number;
  countDeadClicks: number;
  countRageClicks: number;
  platform: MonitoringPlatform;
  sdk: { name: string; version: string };
  user: MonitoringUser;
  tags: MonitoringTag[];
  urls: string[];
  releases: string[];
  os?: { name: string; version: string };
  browser?: { name: string; version: string };
  device?: { name: string; brand?: string; model?: string; family: string };
  /** Permalink to replay player. */
  url?: string;
}

export interface ReplayListOpts {
  project?: string;
  environment?: string;
  statsPeriod?: string;
  start?: string;
  end?: string;
  query?: string;
  sort?: "-startedAt" | "startedAt" | "-duration" | "duration";
  limit?: number;
  cursor?: string;
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export type AlertRuleType =
  | "error"
  | "performance"
  | "metric"
  | "uptime"
  | "crash_rate";
export type AlertThresholdType = "above" | "below" | "above_or_below";
export type AlertStatus = "resolved" | "warning" | "critical";

export interface MonitoringAlertRule {
  id: string;
  name: string;
  type: AlertRuleType;
  status: AlertStatus;
  environment?: string;
  project: Pick<MonitoringProject, "id" | "slug" | "name">;
  aggregate: string; // e.g. 'count()' or 'p95(transaction.duration)'
  query: string; // additional filter
  timeWindow: number; // minutes
  threshold: number;
  thresholdType: AlertThresholdType;
  triggers: AlertTrigger[];
  actions: AlertAction[];
  dateCreated: Date;
  dateModified: Date;
  createdBy?: MonitoringActor;
}

export interface AlertTrigger {
  id: string;
  label: "critical" | "warning";
  alertThreshold: number;
  resolveThreshold?: number;
  thresholdType: AlertThresholdType;
}

export interface AlertAction {
  id: string;
  type:
    | "email"
    | "slack"
    | "pagerduty"
    | "webhook"
    | "opsgenie"
    | "jira"
    | "discord";
  targetType: "user" | "team" | "specific";
  targetIdentifier?: string;
}

export interface MonitoringAlertIncident {
  id: string;
  identifier: string;
  status: AlertStatus;
  type: AlertRuleType;
  title: string;
  dateStarted: Date;
  dateClosed?: Date;
  alertRule: Pick<MonitoringAlertRule, "id" | "name" | "type">;
  projects: string[];
}

export interface AlertRuleListOpts {
  project?: string;
  environment?: string;
  limit?: number;
  cursor?: string;
}

// ─── Crons (Check-ins) ───────────────────────────────────────────────────────

export type CronStatus = "ok" | "error" | "timeout" | "in_progress" | "missed";

export interface MonitoringCron {
  id: string;
  slug: string;
  name: string;
  status: CronStatus;
  isMuted: boolean;
  type: "cron_job";
  config: {
    checkinMargin?: number;
    maxRuntime?: number;
    timezone?: string;
    /** Cron expression or 'interval(X unit)'. */
    schedule: string;
    scheduleType: "crontab" | "interval";
  };
  environments: {
    name: string;
    status: CronStatus;
    lastCheckIn?: Date;
    nextCheckIn?: Date;
    isMuted: boolean;
  }[];
  dateCreated: Date;
}

// ─── User Feedback ────────────────────────────────────────────────────────────

export interface MonitoringUserFeedback {
  id: string;
  eventId: string;
  name: string;
  email: string;
  comments: string;
  timestamp: Date;
  issue?: Pick<MonitoringIssue, "id" | "title">;
}

export interface CreateUserFeedbackInput {
  eventId: string;
  name: string;
  email: string;
  comments: string;
}

// ─── Team & Member Management ─────────────────────────────────────────────────

export interface MonitoringTeam {
  id: string;
  slug: string;
  name: string;
  memberCount: number;
  dateCreated: Date;
  isMember: boolean;
}

export interface MonitoringMember {
  id: string;
  email: string;
  name: string;
  role: "owner" | "manager" | "admin" | "member" | "contributor";
  dateCreated: Date;
  expired: boolean;
  pending: boolean;
}
