import type { TokenSet } from '../oauth.js';
import type { Paginated, PaginationOpts } from '../models/index.js';
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
  BinaryFileType,
  UploadBinaryOpts,
  UploadBinaryResult,
  InternalSharingArtifact,
  AppRecoveryAction,
  CreateAppRecoveryRequest,
  AppRecoveryTargetingRequest,
  AppRecoveryListOpts,
  PhasedRelease,
  CreatePhasedReleaseRequest,
  UpdatePhasedReleaseRequest,
  ReleaseRequest,
  GeneratedArtifactsResult,
  GeneratedArtifactsListOpts,
  BuildDeliverablesResult,
} from '../models/index.js';

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

  // ═══════════════════════════════════════════════════════════════════
  // 9. BINARY UPLOADS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Upload a binary artifact (AAB, APK, or IPA) to the store or internal
   * distribution channel.
   *
   * **File type detection** — resolved in order:
   *   1. `opts.fileType` explicit override
   *   2. `file.type` MIME (`application/vnd.android.package-archive` → `apk`)
   *   3. Filename extension of a `File` object (`.aab`, `.apk`, `.ipa`)
   *
   * **Channels:**
   * - `'store'` (default): Play Store Edit (AAB/APK) or App Store Connect (IPA).
   *   Returns `{ channel: 'store', fileType, build: StoreBuild }`.
   * - `'internal-sharing'`: Google Play Internal App Sharing — returns an instant
   *   shareable download URL. Apple throws `CapabilityError` for this channel.
   *   Returns `{ channel: 'internal-sharing', fileType, artifact: InternalSharingArtifact }`.
   *
   * **Provider matrix:**
   * | fileType | channel            | Google Play    | Apple  |
   * |----------|--------------------|----------------|--------|
   * | `aab`    | `store`            | ✓ edits API    | ✗      |
   * | `apk`    | `store`            | ✓ edits API    | ✗      |
   * | `ipa`    | `store`            | ✗              | ✓ note |
   * | `aab`    | `internal-sharing` | ✓ IAS API      | ✗      |
   * | `apk`    | `internal-sharing` | ✓ IAS API      | ✗      |
   *
   * _Apple IPA note_: App Store Connect has no REST binary-upload endpoint.
   * The method throws `CapabilityError` with the exact `xcrun altool` CLI command.
   */
  uploadBinary(
    tokens: TokenSet,
    appId: string,
    file: Blob,
    opts?: UploadBinaryOpts,
  ): Promise<UploadBinaryResult>;

  // ═══════════════════════════════════════════════════════════════════
  // 10. APP RECOVERY (Google Play only)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * List app recovery actions for a package and optional version code.
   * Google Play only — Apple throws CapabilityError.
   */
  listAppRecoveryActions(
    tokens: TokenSet,
    appId: string,
    opts?: AppRecoveryListOpts,
  ): Promise<Paginated<AppRecoveryAction>>;

  /**
   * Create a new app recovery action in DRAFT status.
   * Google Play only — Apple throws CapabilityError.
   */
  createAppRecoveryAction(
    tokens: TokenSet,
    appId: string,
    request: CreateAppRecoveryRequest,
  ): Promise<AppRecoveryAction>;

  /**
   * Deploy a DRAFT recovery action so it begins reaching affected users.
   * Google Play only — Apple throws CapabilityError.
   */
  deployAppRecoveryAction(
    tokens: TokenSet,
    appId: string,
    recoveryId: string,
  ): Promise<AppRecoveryAction>;

  /**
   * Cancel an active or draft app recovery action.
   * Google Play only — Apple throws CapabilityError.
   */
  cancelAppRecoveryAction(
    tokens: TokenSet,
    appId: string,
    recoveryId: string,
  ): Promise<AppRecoveryAction>;

  /**
   * Incrementally expand the targeting of an existing recovery action.
   * Google Play only — Apple throws CapabilityError.
   */
  addAppRecoveryTargeting(
    tokens: TokenSet,
    appId: string,
    recoveryId: string,
    targeting: AppRecoveryTargetingRequest,
  ): Promise<AppRecoveryAction>;

  // ═══════════════════════════════════════════════════════════════════
  // 11. PHASED RELEASES
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Enable phased (staged) release for an app version.
   *
   * Apple: Creates an appStoreVersionPhasedRelease in INACTIVE state.
   *        The 7-day schedule starts automatically when the version goes live.
   * Google Play: Sets a staged rollout on the track release with the
   *              specified `rolloutPercentage` (defaults to 1%).
   */
  createPhasedRelease(
    tokens: TokenSet,
    appId: string,
    request: CreatePhasedReleaseRequest,
  ): Promise<PhasedRelease>;

  /**
   * Get the current phased release state for a version.
   *
   * Apple: Reads the appStoreVersionPhasedRelease sub-resource.
   * Google Play: Reads the track release's userFraction and status.
   */
  getPhasedRelease(
    tokens: TokenSet,
    appId: string,
    versionId: string,
  ): Promise<PhasedRelease>;

  /**
   * Update a phased release — pause, resume, complete, or change rollout %.
   *
   * Apple: PATCHes phasedReleaseState (PAUSED, ACTIVE, COMPLETE).
   * Google Play: Updates userFraction, halts, resumes, or completes
   *              the staged rollout.
   */
  updatePhasedRelease(
    tokens: TokenSet,
    appId: string,
    phasedReleaseId: string,
    update: UpdatePhasedReleaseRequest,
  ): Promise<PhasedRelease>;

  /**
   * Cancel a planned phased release that has not started.
   *
   * Apple: DELETEs the phased release resource. Only works for INACTIVE releases.
   * Google Play: Halts the staged rollout on the track.
   */
  deletePhasedRelease(
    tokens: TokenSet,
    appId: string,
    phasedReleaseId: string,
  ): Promise<void>;

  // ═══════════════════════════════════════════════════════════════════
  // 12. MANUAL RELEASE REQUESTS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Manually release an approved version to the store.
   *
   * Apple: Triggers release for a "Pending Developer Release" version.
   *        This action is irreversible.
   * Google Play: Commits the production track release with status 'completed'.
   */
  createReleaseRequest(
    tokens: TokenSet,
    appId: string,
    versionId: string,
  ): Promise<ReleaseRequest>;

  // ═════════════════════════════════════════════════════════════════
  // 13. GENERATED ARTIFACTS / BUILD DELIVERABLES
  // ═════════════════════════════════════════════════════════════════

  /**
   * List generated artifacts for a given version code / build.
   *
   * Google Play: Calls `generatedapks.list` to return all APKs generated from
   *   an AAB upload (split, standalone, universal, asset pack slices, recovery),
   *   grouped by signing key.
   * Apple: Returns build deliverables (app thinning variants, dSYMs) from
   *   the Build Bundles API.
   */
  listGeneratedArtifacts(
    tokens: TokenSet,
    appId: string,
    opts: GeneratedArtifactsListOpts,
  ): Promise<GeneratedArtifactsResult>;

  /**
   * Download a generated artifact by its download ID.
   *
   * Google Play: Calls `generatedapks.download` to retrieve the signed APK binary.
   *   Returns a `Response` object with the binary stream.
   * Apple: Downloads a build deliverable by ID.
   *   Returns a `Response` object with the binary stream.
   */
  downloadGeneratedArtifact(
    tokens: TokenSet,
    appId: string,
    versionCode: string,
    downloadId: string,
  ): Promise<Response>;

  /**
   * List build deliverables — a normalized list of downloadable artifacts.
   *
   * Higher-level convenience that returns a flat list of platform-specific
   * deliverables.
   *
   * Apple: App thinning size info, dSYMs, bitcode logs via Build Bundles API.
   * Google Play: Flattened generated artifact list from generatedapks.list.
   */
  listBuildDeliverables(
    tokens: TokenSet,
    appId: string,
    buildId: string,
  ): Promise<BuildDeliverablesResult>;
}
