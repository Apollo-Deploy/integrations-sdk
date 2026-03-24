/**
 * @apollo-deploy/integrations
 *
 * Core adapter-based integration hub — public API surface.
 *
 * Adapter packages depend on this. API modules consume this.
 * No provider-specific code lives here.
 */

// ── Hub ───────────────────────────────────────────────────────────────────────
export { IntegrationHub } from "./hub.js";
export type {
  HubConfig,
  AdapterInfo,
  WebhookRequest,
  WebhookResponse,
  WebhookHandlerOptions,
  WebhookRouter,
  EventHandler,
  EventContext,
} from "./hub.js";

// ── Factory Helper ────────────────────────────────────────────────────────────
export { defineAdapter } from "./define-adapter.js";
export type {
  AdapterDefinition,
  AdapterFactory,
  AdapterDefinitionInfo,
} from "./define-adapter.js";

// ── Errors ────────────────────────────────────────────────────────────────────
export {
  AdapterError,
  OAuthError,
  WebhookError,
  CapabilityError,
  TokenRefreshError,
  UnknownAdapterError,
} from "./errors.js";

// ── Adapter Interface & Types ─────────────────────────────────────────────────
export type {
  IntegrationAdapter,
  AdapterCapability,
  AdapterContext,
  AdapterMetadata,
  AdapterAuthConfig,
  AuthType,
  ClientAuthConfig,
  ConfigField,
  CredentialInputField,
  TokenMetadata,
  Logger,
} from "./types/adapter.js";

// ── OAuth Types ───────────────────────────────────────────────────────────────
export type {
  OAuthHandler,
  AuthorizationParams,
  CodeExchangeParams,
  TokenSet,
  ProviderIdentity,
  PostAuthResult,
} from "./types/oauth.js";

// ── OAuth Factory ─────────────────────────────────────────────────────────────
export { createOAuthHandler, ClientSecretPost } from "./oauth.js";
export type {
  StandardOAuthOptions,
  AuthorizationServer,
  Client,
  ClientAuth,
  TokenEndpointResponse,
} from "./oauth.js";

// ── Webhook Types ─────────────────────────────────────────────────────────────
export type {
  WebhookHandler,
  VerifyParams,
  ParseParams,
  SynchronousResponse,
} from "./types/webhook.js";

// ── Domain Models ─────────────────────────────────────────────────────────────
export type {
  IntegrationEvent,
  Connection,
  ConnectionStatus,
  Repository,
  Branch,
  PullRequest,
  Commit,
  CommitStatusInput,
  CommitListOpts,
  ChangedFile,
  ChangedFileStatus,
  ChangedFilesOpts,
  CodeScanAlert,
  CodeScanSeverity,
  CodeScanState,
  CodeScanLocation,
  CodeScanAlertsOpts,
  CommitStatus,
  CommitStatusState,
  CommitStatusesOpts,
  GetChangedFilesOpts,
  Channel,
  MessagePayload,
  MessageResult,
  MessageBlock,
  Issue,
  CreateIssueInput,
  UpdateIssueInput,
  IssueComment,
  IssueFilters,
  ProjectRef,
  ActorInfo,
  Paginated,
  PaginationOpts,
  // App Store models
  StoreApp,
  StoreBuild,
  StoreBuildStatus,
  StoreArtifact,
  StoreArtifactType,
  StoreRelease,
  StoreReleaseStatus,
  LocalizedText,
  StoreVersion,
  StoreTrack,
  TrackType,
  TrackRelease,
  TrackUpdateRequest,
  TrackReleaseInput,
  StoreReview,
  StoreReviewReply,
  StoreRating,
  RatingSummary,
  BetaGroup,
  BetaTester,
  BetaTesterInput,
  CreateBetaGroupInput,
  VitalsSummary,
  VitalIndicator,
  VitalMetricType,
  VitalMetric,
  VitalDataPoint,
  CrashCluster,
  AnrCluster,
  BuildListOpts,
  ReleaseListOpts,
  ReviewListOpts,
  RatingSummaryOpts,
  RatingListOpts,
  VitalsQueryOpts,
  CrashQueryOpts,
  SubmitForReviewRequest,
  ReleaseToTrackRequest,
  RolloutUpdateRequest,
  PublishResult,
  // Binary upload
  BinaryFileType,
  UploadBinaryOpts,
  UploadBinaryResult,
  InternalSharingArtifact,
  // App recovery
  AppRecoveryStatus,
  AppRecoveryAction,
  AppRecoveryTargeting,
  CreateAppRecoveryRequest,
  AppRecoveryTargetingRequest,
  AppRecoveryListOpts,
  // Phased releases
  PhasedReleaseState,
  PhasedRelease,
  CreatePhasedReleaseRequest,
  UpdatePhasedReleaseRequest,
  // Manual release requests
  ReleaseRequest,
  // Generated Artifacts / Build Deliverables
  GeneratedArtifactType,
  GeneratedArtifact,
  GeneratedArtifactsPerSigningKey,
  GeneratedArtifactTargetingInfo,
  GeneratedArtifactVariant,
  GeneratedArtifactModule,
  GeneratedArtifactDescription,
  GeneratedArtifactAssetSliceSet,
  GeneratedArtifactsResult,
  BuildDeliverable,
  BuildDeliverablesResult,
  GeneratedArtifactsListOpts,
  // Install / active user stats
  InstallStats,
  InstallStatsOpts,
  // Monitoring models
  MonitoringOrganization,
  MonitoringProject,
  MonitoringIssue,
  MonitoringIssueListOpts,
  MonitoringUpdateIssueInput,
  BulkUpdateIssuesInput,
  MonitoringEvent,
  MonitoringEventListOpts,
  MonitoringEventEntry,
  MonitoringEventError,
  MonitoringHttpRequest,
  StackFrame,
  ExceptionValue,
  MonitoringRelease,
  MonitoringCreateReleaseInput,
  MonitoringReleaseListOpts,
  MonitoringDeploy,
  CreateDeployInput,
  MonitoringCommitRef,
  WebVitalsData,
  WebVitalMetric,
  MonitoringVitalsQueryOpts,
  MetricSeries,
  MetricQueryOpts,
  MetricAggregate,
  MonitoringLogEntry,
  LogLevel,
  LogQueryOpts,
  MonitoringReplay,
  ReplayListOpts,
  MonitoringAlertRule,
  MonitoringAlertIncident,
  AlertRuleListOpts,
  AlertTrigger,
  AlertAction,
  AlertStatus,
  AlertRuleType,
  AlertThresholdType,
  MonitoringCron,
  CronStatus,
  MonitoringTeam,
  MonitoringMember,
  MonitoringTagKey,
  MonitoringTagValue,
  MonitoringTag,
  MonitoringUser,
  MonitoringActor,
  MonitoringUserFeedback,
  CreateUserFeedbackInput,
  PerformanceTransaction,
  PerformanceSpan,
  TransactionStatus,
  IssuePriority,
  IssueStatus,
  MonitoringEnvironment,
  MonitoringPlatform,
  // Release window comparison
  ReleaseWindowRef,
  ReleaseWindowComparison,
  CompareReleaseWindowsOpts,
} from "./types/models/index.js";

// ── Capability Interfaces ────────────────────────────────────────────────────────
export type { SourceControlCapability } from "./types/capabilities/source-control.js";
export type { MessagingCapability } from "./types/capabilities/messaging.js";
export type { IssueTrackingCapability } from "./types/capabilities/issue-tracking.js";
export type { AppStoreCapability } from "./types/capabilities/app-store.js";
export type { MonitoringCapability } from "./types/capabilities/monitoring.js";

// ── Crypto ────────────────────────────────────────────────────────────────────
export {
  DecryptError,
  CryptoConfigError,
  encryptGCM,
  decryptGCM,
  zeroize,
  deriveDataKey,
  createCryptoProvider,
  getRootKeyFromEnv,
  createCryptoProviderFromEnv,
} from "./crypto.js";
export type {
  EncryptedEnvelope,
  CryptoProvider,
  EncryptionContext,
} from "./crypto.js";
