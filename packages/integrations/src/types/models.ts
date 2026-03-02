import type { AdapterCapability } from './adapter.js';

// ─── Universal Domain Models ──────────────────────────────────────────────────
// Adapters map provider-specific responses to these shapes.
// Consumers of the integration system never see GitHub-specific or Slack-specific types.

export interface IntegrationEvent<T = Record<string, unknown>> {
  readonly id: string;
  /** Adapter ID: 'github', 'slack', etc. */
  readonly provider: string;
  /** Original provider event type, e.g. 'pull_request.opened' */
  readonly providerEventType: string;
  /** Normalized domain: 'source-control', 'messaging', etc. */
  readonly domain: AdapterCapability;
  /** Normalized event type: 'pull_request.created' */
  readonly eventType: string;
  readonly timestamp: Date;
  /** Groups related events from the same fan-out chain. */
  readonly correlationId: string;
  /** Which connected account received this event. */
  readonly connectionId: string;
  /** Resolved from webhook config. */
  readonly projectId?: string;
  readonly actor?: ActorInfo;
  readonly data: T;
}

export interface Connection {
  id: string;
  organizationId: string;
  userId: string;
  provider: string;
  providerAccountId: string;
  status: ConnectionStatus;
  scopes: string[];
  metadata: Record<string, unknown>;
  tokenExpiresAt?: Date;
  lastRefreshedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type ConnectionStatus = 'active' | 'expired' | 'revoked' | 'error';

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
  state: 'pending' | 'success' | 'failure' | 'error';
  targetUrl?: string;
  description?: string;
  context: string;
}

// ─── Messaging ────────────────────────────────────────────────────────────────

export interface Channel {
  id: string;
  name: string;
  isPrivate: boolean;
}

export interface MessagePayload {
  text: string;
  threadId?: string;
}

export interface MessageResult {
  messageId: string;
  channelId: string;
  timestamp: string;
}

export interface MessageBlock {
  type: 'section' | 'divider' | 'actions' | 'context';
  [key: string]: unknown;
}

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

// ─── Shared ───────────────────────────────────────────────────────────────────

export interface ActorInfo {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface Paginated<T> {
  items: T[];
  hasMore: boolean;
  cursor?: string;
}

export interface PaginationOpts {
  cursor?: string;
  limit?: number;
}

// ─── App Store ──────────────────────────────────────────────────────────────────────────────

export interface StoreApp {
  id: string;
  name: string;
  bundleId: string;
  platform: 'ios' | 'android';
  status: string;
  storeUrl?: string;
  iconUrl?: string;
  primaryLocale?: string;
  categories?: string[];
}

export interface StoreBuild {
  id: string;
  appId: string;
  version: string;
  buildNumber: string;
  platform: 'ios' | 'android';
  status: StoreBuildStatus;
  uploadedAt: Date;
  expiresAt?: Date;
  size?: number;
  minOsVersion?: string;
  buildType?: 'ipa' | 'aab' | 'apk' | 'xcarchive';
  hasArtifacts: boolean;
}

export type StoreBuildStatus =
  | 'processing'
  | 'valid'
  | 'invalid'
  | 'expired';

// ── Build Artifacts ──────────────────────────────────────────────────────────

export interface StoreArtifact {
  id: string;
  buildId: string;
  appId: string;
  type: StoreArtifactType;
  fileName: string;
  size?: number;
  contentType?: string;
  downloadable: boolean;
  createdAt: Date;
}

export type StoreArtifactType =
  | 'ipa'
  | 'dsym'
  | 'bitcode_compilation_log'
  | 'app_clip'
  | 'apk'
  | 'aab'
  | 'universal_apk'
  | 'split_apk'
  | 'proguard_mapping'
  | 'native_debug_symbols'
  | 'other';

// ── Releases ────────────────────────────────────────────────────────────────

export interface StoreRelease {
  id: string;
  appId: string;
  version: string;
  status: StoreReleaseStatus;
  track: string;
  rolloutPercentage?: number;
  releaseNotes?: LocalizedText[];
  createdAt: Date;
  updatedAt: Date;
  reviewSubmittedAt?: Date;
  reviewCompletedAt?: Date;
  releasedAt?: Date;
  buildIds?: string[];
  versionCodes?: string[];
}

export type StoreReleaseStatus =
  | 'draft'
  | 'in_review'
  | 'pending_release'
  | 'rolling_out'
  | 'completed'
  | 'halted'
  | 'rejected'
  | 'superseded';

export interface LocalizedText {
  language: string;
  text: string;
}

// ── Versions ─────────────────────────────────────────────────────────────────

export interface StoreVersion {
  id: string;
  appId: string;
  versionString: string;
  state: string;
  platform: 'ios' | 'android';
  createdAt: Date;
}

// ── Tracks ───────────────────────────────────────────────────────────────────

export interface StoreTrack {
  id: string;
  appId: string;
  name: string;
  type: TrackType;
  releases: TrackRelease[];
}

export type TrackType =
  | 'production'
  | 'beta'
  | 'alpha'
  | 'internal'
  | 'custom';

export interface TrackRelease {
  version: string;
  versionCodes: string[];
  status: StoreReleaseStatus;
  rolloutPercentage?: number;
  releaseNotes?: LocalizedText[];
}

export interface TrackUpdateRequest {
  releases?: TrackReleaseInput[];
  rolloutPercentage?: number;
  halt?: boolean;
  resume?: boolean;
  completeRollout?: boolean;
}

export interface TrackReleaseInput {
  versionCodes: string[];
  rolloutPercentage?: number;
  releaseNotes?: LocalizedText[];
  status?: 'draft' | 'completed' | 'halted';
}

// ── Reviews & Ratings ────────────────────────────────────────────────────────

export interface StoreReview {
  id: string;
  appId: string;
  author: string;
  rating: number;
  title?: string;
  body: string;
  language: string;
  territory?: string;
  appVersion?: string;
  device?: string;
  reply?: StoreReviewReply;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoreReviewReply {
  body: string;
  updatedAt: Date;
}

export interface StoreRating {
  id: string;
  appId: string;
  rating: number;
  territory?: string;
  appVersion?: string;
  createdAt: Date;
}

export interface RatingSummary {
  appId: string;
  averageRating: number;
  totalRatings: number;
  histogram: {
    oneStar: number;
    twoStar: number;
    threeStar: number;
    fourStar: number;
    fiveStar: number;
  };
  currentVersionAverage?: number;
  currentVersionTotal?: number;
  periodStart?: Date;
  periodEnd?: Date;
}

// ── Beta Testing ─────────────────────────────────────────────────────────────

export interface BetaGroup {
  id: string;
  name: string;
  appId: string;
  isInternal: boolean;
  testerCount: number;
  testerLimit?: number;
  publicLinkEnabled?: boolean;
  publicLink?: string;
  activeBuildId?: string;
  createdAt?: Date;
}

export interface BetaTester {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  status: 'accepted' | 'pending' | 'expired' | 'not_invited';
  sessionCount?: number;
  crashCount?: number;
  installedVersion?: string;
  installedBuildNumber?: string;
  lastActivityAt?: Date;
}

export interface BetaTesterInput {
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface CreateBetaGroupInput {
  name: string;
  isInternal: boolean;
  publicLinkEnabled?: boolean;
  testerLimit?: number;
}

// ── Vitals ───────────────────────────────────────────────────────────────────

export interface VitalsSummary {
  appId: string;
  platform: 'ios' | 'android';
  period: { start: Date; end: Date };
  metrics: {
    crashRate: VitalIndicator;
    anrRate?: VitalIndicator;
    launchTime: VitalIndicator;
    renderTime?: VitalIndicator;
    batteryUsage?: VitalIndicator;
    memoryUsage?: VitalIndicator;
    diskWrites?: VitalIndicator;
  };
}

export interface VitalIndicator {
  value: number;
  unit: string;
  threshold?: number;
  status: 'good' | 'needs_attention' | 'critical';
  trend: 'improving' | 'stable' | 'degrading';
  percentile?: number;
}

export type VitalMetricType =
  | 'crash_rate'
  | 'anr_rate'
  | 'excessive_wakeups'
  | 'stuck_background_worker'
  | 'launch_time'
  | 'render_time'
  | 'permission_denial_rate'
  | 'battery_drain'
  | 'memory_usage'
  | 'disk_usage'
  | 'hang_rate'
  | 'scroll_hitch_rate'
  | 'disk_writes';

export interface VitalMetric {
  metric: VitalMetricType;
  appId: string;
  platform: 'ios' | 'android';
  dataPoints: VitalDataPoint[];
  peerComparison?: {
    percentile: number;
    peerValue: number;
  };
}

export interface VitalDataPoint {
  timestamp: Date;
  value: number;
  dimensions?: Record<string, string>;
}

export interface CrashCluster {
  id: string;
  appId: string;
  platform: 'ios' | 'android';
  title: string;
  exceptionType: string;
  affectedUsers: number;
  eventCount: number;
  affectedVersions: string[];
  lastOccurrence: Date;
  stackTrace?: string;
  resolved: boolean;
}

export interface AnrCluster {
  id: string;
  appId: string;
  title: string;
  affectedUsers: number;
  eventCount: number;
  affectedVersions: string[];
  lastOccurrence: Date;
  stackTrace?: string;
  resolved: boolean;
}

// ── Filter / Query Options ────────────────────────────────────────────────────

export interface BuildListOpts extends PaginationOpts {
  status?: StoreBuildStatus;
  version?: string;
  minBuildNumber?: string;
  maxBuildNumber?: string;
}

export interface ReleaseListOpts extends PaginationOpts {
  track?: string;
  status?: StoreReleaseStatus;
}

export interface ReviewListOpts extends PaginationOpts {
  minRating?: number;
  maxRating?: number;
  territory?: string;
  appVersion?: string;
  sortBy?: 'date' | 'rating' | 'helpfulness';
  sortOrder?: 'asc' | 'desc';
}

export interface RatingSummaryOpts {
  territory?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface RatingListOpts extends PaginationOpts {
  territory?: string;
  appVersion?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface VitalsQueryOpts {
  startDate?: Date;
  endDate?: Date;
  version?: string;
  granularity?: 'daily' | 'hourly';
  deviceType?: string;
  osVersion?: string;
}

export interface CrashQueryOpts extends PaginationOpts {
  version?: string;
  startDate?: Date;
  endDate?: Date;
  includeResolved?: boolean;
  sortBy?: 'event_count' | 'affected_users' | 'last_occurrence';
}

// ── Publishing ────────────────────────────────────────────────────────────────

export interface SubmitForReviewRequest {
  versionId: string;
  releaseNotes?: LocalizedText[];
  phasedRelease?: boolean;
  autoRelease?: boolean;
  earliestReleaseDate?: Date;
}

export interface ReleaseToTrackRequest {
  track: string;
  buildId: string;
  rolloutPercentage?: number;
  releaseNotes?: LocalizedText[];
  managedPublishing?: boolean;
}

export interface RolloutUpdateRequest {
  rolloutPercentage?: number;
  pause?: boolean;
  resume?: boolean;
  completeRollout?: boolean;
}

export interface PublishResult {
  success: boolean;
  status: StoreReleaseStatus;
  message?: string;
  releaseId: string;
}

export interface CommitListOpts extends PaginationOpts {
  branch?: string;
  since?: Date;
  until?: Date;
}

export interface IssueFilters extends PaginationOpts {
  status?: string;
  assigneeId?: string;
  projectId?: string;
  labels?: string[];
}
