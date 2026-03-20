import type { PaginationOpts } from "./shared.js";

// ─── App Store ──────────────────────────────────────────────────────────────────────────────

export interface StoreApp {
  id: string;
  name: string;
  bundleId: string;
  platform: "ios" | "android";
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
  platform: "ios" | "android";
  status: StoreBuildStatus;
  uploadedAt: Date;
  expiresAt?: Date;
  size?: number;
  minOsVersion?: string;
  buildType?: "ipa" | "aab" | "apk" | "xcarchive";
  hasArtifacts: boolean;
}

export type StoreBuildStatus = "processing" | "valid" | "invalid" | "expired";

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
  | "ipa"
  | "dsym"
  | "bitcode_compilation_log"
  | "app_clip"
  | "apk"
  | "aab"
  | "universal_apk"
  | "split_apk"
  | "standalone_apk"
  | "asset_pack_slice"
  | "recovery_apk"
  | "proguard_mapping"
  | "native_debug_symbols"
  | "app_thinning_variant"
  | "other";

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
  | "draft"
  | "in_review"
  | "pending_release"
  | "rolling_out"
  | "completed"
  | "halted"
  | "rejected"
  | "superseded";

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
  platform: "ios" | "android";
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

export type TrackType = "production" | "beta" | "alpha" | "internal" | "custom";

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
  status?: "draft" | "completed" | "halted";
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
  status: "accepted" | "pending" | "expired" | "not_invited";
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
  platform: "ios" | "android";
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
  status: "good" | "needs_attention" | "critical";
  trend: "improving" | "stable" | "degrading";
  percentile?: number;
}

export type VitalMetricType =
  | "crash_rate"
  | "anr_rate"
  | "excessive_wakeups"
  | "stuck_background_worker"
  | "launch_time"
  | "render_time"
  | "permission_denial_rate"
  | "battery_drain"
  | "memory_usage"
  | "disk_usage"
  | "hang_rate"
  | "scroll_hitch_rate"
  | "disk_writes";

export interface VitalMetric {
  metric: VitalMetricType;
  appId: string;
  platform: "ios" | "android";
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
  platform: "ios" | "android";
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
  sortBy?: "date" | "rating" | "helpfulness";
  sortOrder?: "asc" | "desc";
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
  granularity?: "daily" | "hourly";
  deviceType?: string;
  osVersion?: string;
}

export interface CrashQueryOpts extends PaginationOpts {
  version?: string;
  startDate?: Date;
  endDate?: Date;
  includeResolved?: boolean;
  sortBy?: "event_count" | "affected_users" | "last_occurrence";
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

// ── Binary Uploads ────────────────────────────────────────────────────────────

export type BinaryFileType = "aab" | "apk" | "ipa";

export interface UploadBinaryOpts {
  /**
   * Explicit file type override. When omitted the implementation infers from
   * `file.type` (MIME) or — for a `File` object — its filename extension
   * (.aab, .apk, .ipa). Provide this explicitly when passing a plain `Blob`
   * without a name.
   */
  fileType?: BinaryFileType;
  /**
   * Distribution channel.
   * - `'store'` (default): Play Store Edit (AAB/APK) or App Store Connect (IPA).
   * - `'internal-sharing'`: Google Play Internal App Sharing — returns an instant
   *   download URL. Apple throws `CapabilityError` for this channel.
   */
  channel?: "store" | "internal-sharing";
  /**
   * Device Tier Config ID for generating APK deliverables from an uploaded AAB.
   * Pass `"LATEST"` to use the most recently uploaded DTC.
   * Google Play, `channel: 'store'` only — ignored otherwise.
   */
  deviceTierConfigId?: string;
  /**
   * Whether to commit the Google Play Edit immediately after uploading.
   * Defaults to `true`. Set to `false` to batch additional edits before committing.
   * Google Play, `channel: 'store'` only — ignored otherwise.
   */
  commitEdit?: boolean;

  // ── Apple-specific (IPA uploads via Build Uploads REST API) ──

  /**
   * CFBundleShortVersionString (marketing version, e.g. "1.2.0").
   * Required for Apple IPA uploads. The adapter will throw if not provided.
   */
  version?: string;
  /**
   * CFBundleVersion (build number, e.g. "42").
   * Required for Apple IPA uploads. The adapter will throw if not provided.
   */
  buildNumber?: string;
  /**
   * Apple platform target. Defaults to `'IOS'`.
   * Only used by the Apple adapter.
   */
  applePlatform?: "IOS" | "MAC_OS" | "TV_OS" | "VISION_OS";
}

/**
 * Artifact returned from Google Play Internal App Sharing upload.
 */
export interface InternalSharingArtifact {
  /** Unique download URL that can be distributed to testers. */
  downloadUrl: string;
  /** SHA-256 certificate fingerprint of the signing certificate. */
  certificateFingerprint?: string;
  type: "apk" | "aab";
}

export type UploadBinaryResult =
  | { channel: "store"; fileType: BinaryFileType; build: StoreBuild }
  | {
      channel: "internal-sharing";
      fileType: "apk" | "aab";
      artifact: InternalSharingArtifact;
    };

// ── App Recovery (Google Play) ────────────────────────────────────────────────

export type AppRecoveryStatus =
  | "DRAFT"
  | "ACTIVE_RECOVERING"
  | "ACTIVE_WAITING"
  | "COMPLETE"
  | "CANCELLED"
  | "RECOVERY_STATUS_UNSPECIFIED";

export interface AppRecoveryAction {
  /** Unique recovery action ID. */
  appRecoveryId: string;
  appId: string;
  status: AppRecoveryStatus;
  targeting?: AppRecoveryTargeting;
  /** Remediation measures applied to affected users. */
  remediationMeasures?: {
    type: string;
    payload?: Record<string, unknown>;
  }[];
  createTime?: Date;
  deployTime?: Date;
  cancelTime?: Date;
  lastUpdateTime?: Date;
}

export interface AppRecoveryTargeting {
  /** Explicit list of version codes targeted by this recovery. */
  versionList?: { versionCodes: string[] };
  /** Inclusive range of version codes targeted by this recovery. */
  versionRange?: {
    versionCodeLowerBound: string;
    versionCodeUpperBound?: string;
  };
  /** Whether this recovery targets all users regardless of version. */
  allUsers?: boolean;
  /** Android SDK versions (API levels) that are targeted. */
  androidSdkVersions?: string[];
  /** Regional include / exclude filtering. */
  regions?: {
    includeList?: string[];
    excludeList?: string[];
  };
}

export interface CreateAppRecoveryRequest {
  /** Version codes targeted for recovery (or use versionRange / allUsers). */
  versionCodes?: string[];
  /** Inclusive version code range instead of an explicit list. */
  versionRange?: { lowerBound: string; upperBound?: string };
  /** Target all installed versions. */
  allUsers?: boolean;
  /** Type of remediation applied when the recovery triggers. */
  remediationType: "REMOTE_IN_APP_UPDATE" | "FORCE_CRASH";
}

export interface AppRecoveryTargetingRequest {
  /** Additional version codes to include in the recovery targeting. */
  versionCodes?: string[];
  /** Regional targeting updates. */
  regions?: {
    includeList?: string[];
    excludeList?: string[];
  };
  /** Android SDK version targeting. */
  androidSdkVersions?: string[];
}

export interface AppRecoveryListOpts extends PaginationOpts {
  /** Filter recovery actions that target this specific version code. */
  versionCode?: string;
}

// ── Phased Releases ───────────────────────────────────────────────────────────

/**
 * Normalized phased release state.
 * Apple: Maps directly to PhasedReleaseState enum.
 * Google: Maps from staged rollout status (inProgress → active, halted → paused, etc.).
 */
export type PhasedReleaseState = "inactive" | "active" | "paused" | "complete";

/**
 * A phased (staged) release of an app version.
 *
 * Apple: An `appStoreVersionPhasedRelease` sub-resource that rolls out an
 * update over 7 days (1%→2%→5%→10%→20%→50%→100%).
 *
 * Google Play: A staged rollout with a manually controlled `userFraction` on a
 * track release.
 */
export interface PhasedRelease {
  id: string;
  versionId: string;
  state: PhasedReleaseState;
  /** Apple: Current day in the 7-day schedule (0–7). Google Play: undefined. */
  currentDayNumber?: number;
  /** When the phased release started rolling out to users. */
  startDate?: Date;
  /** Apple: Total days the release has been paused. Google Play: undefined. */
  totalPauseDuration?: number;
  /**
   * Approximate rollout percentage (0–100).
   * Apple: Derived from the 7-day schedule. Google: From `userFraction × 100`.
   */
  rolloutPercentage?: number;
}

export interface CreatePhasedReleaseRequest {
  /**
   * App Store Version ID (Apple) or release ID in `track:versionCode` format (Google Play).
   */
  versionId: string;
  /**
   * Google Play only: initial rollout percentage (0–100).
   * Apple ignores this — uses a fixed 7-day schedule.
   * Defaults to 1% on Google Play.
   */
  rolloutPercentage?: number;
}

export interface UpdatePhasedReleaseRequest {
  /**
   * Transition to a new state:
   * - `'active'` → resume a paused release
   * - `'paused'` → pause an active release
   * - `'complete'` → immediately release to 100% of users
   */
  state?: PhasedReleaseState;
  /**
   * Google Play only: update the staged rollout fraction (0–100).
   * Apple ignores this — uses a fixed 7-day schedule.
   */
  rolloutPercentage?: number;
}

// ── Manual Release Requests ───────────────────────────────────────────────────

/**
 * Result of a manual release request.
 *
 * Apple: Triggers release for a version in "Pending Developer Release" state.
 *        Irreversible once created.
 * Google Play: Commits a production release with status `completed`.
 */
export interface ReleaseRequest {
  id: string;
  versionId: string;
  requestedAt: Date;
}

// ── Generated Artifacts (Google Play) / Build Deliverables (Apple) ────────────

/**
 * A generated artifact entry.
 *
 * Google Play: When an AAB is uploaded, Google generates split, standalone,
 * universal, asset-pack-slice, and recovery APKs (via the generatedapks API).
 *
 * Apple: Build deliverables — app thinning variants, dSYMs, bitcode logs.
 */

export type GeneratedArtifactType =
  | "split"
  | "standalone"
  | "universal"
  | "asset_pack_slice"
  | "recovery";

export interface GeneratedArtifact {
  /** Download ID used to retrieve the binary (Google: generatedapks.download, Apple: deliverable URL). */
  downloadId: string;
  type: GeneratedArtifactType;
  /** Variant ID (split & standalone artifacts). */
  variantId?: number;
  /** Module name (split artifacts, asset pack slices, recovery modules). */
  moduleName?: string;
  /** Split ID (split artifacts). Empty for base module main split. */
  splitId?: string;
  /** Slice ID (asset pack slices). */
  sliceId?: string;
  /** Asset module version (asset pack slices). */
  assetVersion?: string;
  /** Recovery action ID (recovery modules). */
  recoveryId?: string;
  /** Recovery status (recovery modules). */
  recoveryStatus?: string;
}

export interface GeneratedArtifactsPerSigningKey {
  /** SHA-256 hash of the signing public key certificate (Google Play) or code-signing identity (Apple). */
  certificateSha256Hash: string;
  generatedSplitApks: GeneratedArtifact[];
  generatedStandaloneApks: GeneratedArtifact[];
  generatedUniversalApk?: GeneratedArtifact;
  generatedAssetPackSlices: GeneratedArtifact[];
  generatedRecoveryModules: GeneratedArtifact[];
  targetingInfo?: GeneratedArtifactTargetingInfo;
}

export interface GeneratedArtifactTargetingInfo {
  packageName: string;
  variants: GeneratedArtifactVariant[];
  assetSliceSets: GeneratedArtifactAssetSliceSet[];
}

export interface GeneratedArtifactVariant {
  variantNumber: number;
  targeting?: {
    sdkVersion?: { min?: number };
    abi?: string[];
    screenDensity?: string[];
  };
  modules: GeneratedArtifactModule[];
}

export interface GeneratedArtifactModule {
  name: string;
  moduleType?: "UNKNOWN_MODULE_TYPE" | "FEATURE_MODULE";
  deliveryType?:
    | "UNKNOWN_DELIVERY_TYPE"
    | "INSTALL_TIME"
    | "ON_DEMAND"
    | "FAST_FOLLOW";
  artifacts: GeneratedArtifactDescription[];
}

export interface GeneratedArtifactDescription {
  path: string;
  splitId?: string;
  isMasterSplit?: boolean;
  /** Fused module names (standalone artifacts). */
  fusedModuleNames?: string[];
}

export interface GeneratedArtifactAssetSliceSet {
  moduleName: string;
  deliveryType?:
    | "UNKNOWN_DELIVERY_TYPE"
    | "INSTALL_TIME"
    | "ON_DEMAND"
    | "FAST_FOLLOW";
  slices: GeneratedArtifactDescription[];
}

export interface GeneratedArtifactsResult {
  /** Package name or app ID. */
  appId: string;
  /** Version code (Google Play) or build ID (Apple). */
  versionCode: string;
  /** Generated artifacts grouped by signing key. */
  signingKeys: GeneratedArtifactsPerSigningKey[];
}

/**
 * Apple Build Deliverable — represents an app thinning variant or
 * downloadable asset from App Store Connect.
 *
 * Apple doesn't have the same "generated APK" concept. The equivalent is
 * build bundles which contain app thinning size information and downloadable
 * dSYMs/build deliverables.
 */
export interface BuildDeliverable {
  id: string;
  buildId: string;
  /** Deliverable type. */
  type:
    | "app_thinning_variant"
    | "dsym"
    | "bitcode_compilation_log"
    | "app_clip";
  /** Variant name / device model for app thinning. */
  variant?: string;
  /** Compressed file size in bytes. */
  compressedSize?: number;
  /** Uncompressed (install) size in bytes. */
  uncompressedSize?: number;
  /** Download URL if available. */
  downloadUrl?: string;
  /** Whether this deliverable is downloadable. */
  downloadable: boolean;
}

export interface BuildDeliverablesResult {
  appId: string;
  buildId: string;
  deliverables: BuildDeliverable[];
}

/** Options for listing generated artifacts / build deliverables. */
export interface GeneratedArtifactsListOpts {
  /** Google Play: version code. Apple: build ID. */
  versionCode: string;
}
