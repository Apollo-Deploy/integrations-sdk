import type { TokenSet } from '../oauth.js';
import type { Paginated, PaginationOpts } from '../models.js';
import type {
  StoreApp,
  StoreBuild,
  StoreRelease,
  StoreVersion,
  StoreReview,
  StoreReviewReply,
  StoreRating,
  RatingSummary,
  StoreArtifact,
  StoreTrack,
  BetaGroup,
  BetaTester,
  BetaTesterInput,
  CreateBetaGroupInput,
  PublishResult,
  VitalsSummary,
  VitalMetric,
  VitalMetricType,
  CrashCluster,
  AnrCluster,
  BuildListOpts,
  ReleaseListOpts,
  ReviewListOpts,
  RatingSummaryOpts,
  RatingListOpts,
  VitalsQueryOpts,
  CrashQueryOpts,
  TrackUpdateRequest,
  SubmitForReviewRequest,
  ReleaseToTrackRequest,
  RolloutUpdateRequest,
} from '../models.js';

export interface AppStoreCapability {
  // ═══════════════════════════════════════════════════════════════════
  // 1. APP MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════

  listApps(tokens: TokenSet): Promise<Paginated<StoreApp>>;
  getApp(tokens: TokenSet, appId: string): Promise<StoreApp>;

  // ═══════════════════════════════════════════════════════════════════
  // 2. BUILD & ARTIFACT MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════

  listBuilds(tokens: TokenSet, appId: string, opts?: BuildListOpts): Promise<Paginated<StoreBuild>>;
  getBuild(tokens: TokenSet, appId: string, buildId: string): Promise<StoreBuild>;

  /**
   * List downloadable artifacts for a build.
   * Apple: dSYMs, bitcode compilation logs.
   * Google: Generated APKs from AAB, ProGuard mapping files, native debug symbols.
   */
  listBuildArtifacts(tokens: TokenSet, appId: string, buildId: string): Promise<StoreArtifact[]>;

  /**
   * Get a signed download URL for a specific artifact.
   * URLs are short-lived (typically 10–60 minutes).
   */
  getArtifactDownloadUrl(
    tokens: TokenSet,
    appId: string,
    buildId: string,
    artifactId: string,
  ): Promise<{ url: string; expiresAt: Date }>;

  // ═══════════════════════════════════════════════════════════════════
  // 3. RELEASE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════

  listReleases(tokens: TokenSet, appId: string, opts?: ReleaseListOpts): Promise<Paginated<StoreRelease>>;
  getRelease(tokens: TokenSet, appId: string, releaseId: string): Promise<StoreRelease>;

  // ═══════════════════════════════════════════════════════════════════
  // 4. VERSION / TRACK MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════

  listTracks(tokens: TokenSet, appId: string): Promise<StoreTrack[]>;
  getTrack(tokens: TokenSet, appId: string, trackId: string): Promise<StoreTrack>;
  updateTrack(tokens: TokenSet, appId: string, trackId: string, update: TrackUpdateRequest): Promise<StoreTrack>;
  listVersions(tokens: TokenSet, appId: string): Promise<StoreVersion[]>;
  getVersion(tokens: TokenSet, appId: string, versionId: string): Promise<StoreVersion>;

  // ═══════════════════════════════════════════════════════════════════
  // 5. PUBLISHING
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Submit a version/release for store review.
   * Apple: Submits App Store Version for App Review.
   * Google: Commits the edit.
   */
  submitForReview(tokens: TokenSet, appId: string, request: SubmitForReviewRequest): Promise<PublishResult>;

  /**
   * Release a reviewed/approved version to users.
   * Supports staged rollout — specify rolloutPercentage (0–100).
   */
  releaseToTrack(tokens: TokenSet, appId: string, request: ReleaseToTrackRequest): Promise<PublishResult>;

  /**
   * Update an in-progress staged rollout.
   * Apple: Adjust phased release state (pause, resume, complete).
   * Google: Change rollout fraction on an active release.
   */
  updateRollout(tokens: TokenSet, appId: string, releaseId: string, update: RolloutUpdateRequest): Promise<StoreRelease>;

  /**
   * Halt a release — pull it from distribution.
   * Apple: "Remove This Version from Sale".
   * Google: Halt the rollout on the specified track.
   */
  haltRelease(tokens: TokenSet, appId: string, releaseId: string, reason?: string): Promise<StoreRelease>;

  // ═══════════════════════════════════════════════════════════════════
  // 6. REVIEWS & RATINGS
  // ═══════════════════════════════════════════════════════════════════

  listReviews(tokens: TokenSet, appId: string, opts?: ReviewListOpts): Promise<Paginated<StoreReview>>;
  getReview(tokens: TokenSet, appId: string, reviewId: string): Promise<StoreReview>;
  replyToReview(tokens: TokenSet, appId: string, reviewId: string, body: string): Promise<StoreReviewReply>;

  /**
   * Delete a developer reply to a review.
   * NOTE: Google Play does not support deleting replies — throws AdapterError.
   */
  deleteReviewReply(tokens: TokenSet, appId: string, reviewId: string): Promise<void>;
  getRatingSummary(tokens: TokenSet, appId: string, opts?: RatingSummaryOpts): Promise<RatingSummary>;
  listRatings(tokens: TokenSet, appId: string, opts?: RatingListOpts): Promise<Paginated<StoreRating>>;

  // ═══════════════════════════════════════════════════════════════════
  // 7. BETA TESTING / TESTERS
  // ═══════════════════════════════════════════════════════════════════

  listBetaGroups(tokens: TokenSet, appId: string): Promise<BetaGroup[]>;
  getBetaGroup(tokens: TokenSet, appId: string, groupId: string): Promise<BetaGroup>;
  createBetaGroup(tokens: TokenSet, appId: string, input: CreateBetaGroupInput): Promise<BetaGroup>;
  deleteBetaGroup(tokens: TokenSet, appId: string, groupId: string): Promise<void>;
  listBetaTesters(tokens: TokenSet, appId: string, groupId: string, opts?: PaginationOpts): Promise<Paginated<BetaTester>>;
  addBetaTesters(tokens: TokenSet, groupId: string, testers: BetaTesterInput[]): Promise<void>;
  removeBetaTesters(tokens: TokenSet, groupId: string, testerIds: string[]): Promise<void>;

  /**
   * Enable a build for a beta group.
   * Apple: Add build to TestFlight beta group.
   * Google: Assign version codes to testing track.
   */
  assignBuildToBetaGroup(tokens: TokenSet, appId: string, groupId: string, buildId: string): Promise<void>;
  removeBuildFromBetaGroup(tokens: TokenSet, appId: string, groupId: string, buildId: string): Promise<void>;

  // ═══════════════════════════════════════════════════════════════════
  // 8. APP VITALS / QUALITY METRICS
  // ═══════════════════════════════════════════════════════════════════

  getVitalsSummary(tokens: TokenSet, appId: string, opts?: VitalsQueryOpts): Promise<VitalsSummary>;
  getVitalMetric(tokens: TokenSet, appId: string, metric: VitalMetricType, opts?: VitalsQueryOpts): Promise<VitalMetric>;

  /**
   * List crash clusters.
   * Apple: Diagnostic signatures. Google: Error clusters from Play Vitals.
   */
  listCrashClusters(tokens: TokenSet, appId: string, opts?: CrashQueryOpts): Promise<Paginated<CrashCluster>>;
  getCrashCluster(tokens: TokenSet, appId: string, clusterId: string): Promise<CrashCluster>;

  /**
   * List ANR clusters (Android-only).
   * Apple: Always returns empty array — ANR is an Android-specific concept.
   */
  listAnrClusters(tokens: TokenSet, appId: string, opts?: CrashQueryOpts): Promise<Paginated<AnrCluster>>;
}
