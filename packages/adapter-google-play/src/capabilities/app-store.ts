import { CapabilityError } from '@apollo-deploy/integrations';
import type {
  AppStoreCapability,
  TokenSet,
  Paginated,
  PaginationOpts,
  StoreApp,
  StoreBuild,
  StoreRelease,
  StoreVersion,
  StoreReview,
  StoreReviewReply,
  StoreRating,
  RatingSummary,
  BetaGroup,
  BetaTester,
  BetaTesterInput,
  CreateBetaGroupInput,
  StoreArtifact,
  StoreTrack,
  TrackUpdateRequest,
  SubmitForReviewRequest,
  ReleaseToTrackRequest,
  RolloutUpdateRequest,
  PublishResult,
  VitalsSummary,
  VitalMetric,
  VitalMetricType,
  CrashCluster,
  AnrCluster,
  BuildListOpts,
  ReleaseListOpts,
  ReviewListOpts,
  RatingListOpts,
  RatingSummaryOpts,
  VitalsQueryOpts,
  CrashQueryOpts,
} from '@apollo-deploy/integrations';
import {
  mapGoogleApp,
  mapGoogleBuild,
  mapGoogleRelease,
  mapGoogleTrack,
  mapGoogleReview,
  mapGoogleBetaGroup,
  mapGoogleBetaTester,
  mapGoogleArtifact,
  mapGoogleRatingSummary,
  mapGoogleVitalMetric,
  mapGoogleCrashCluster,
  mapGoogleAnrCluster,
} from '../mappers/models.js';
import type { GooglePlayAdapterConfig } from '../types.js';

const BASE_URL = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const REPORTING_URL = 'https://playdeveloperreporting.googleapis.com/v1beta1';
const ALL_TRACKS = ['production', 'beta', 'alpha', 'internal'] as const;

export function createGooglePlayAppStore(_config: GooglePlayAdapterConfig): AppStoreCapability {

  async function gpRequest<T = any>(
    tokens: TokenSet,
    url: string,
    init?: RequestInit,
  ): Promise<T> {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
        ...(init?.headers as Record<string, string> | undefined),
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new CapabilityError(
        'google-play',
        `Google Play API ${res.status}: ${body}`,
        res.status === 429,
      );
    }

    if (res.status === 204) return null as T;
    return res.json() as Promise<T>;
  }

  /**
   * Wraps operations that require a Google Play Edit.
   * Commits on success, deletes (cleans up) on error unless `noCommit` is set.
   */
  async function withEdit<T>(
    tokens: TokenSet,
    packageName: string,
    fn: (editId: string) => Promise<T>,
    opts: { commit?: boolean } = {},
  ): Promise<T> {
    const edit = await gpRequest<{ id: string }>(
      tokens,
      `${BASE_URL}/applications/${packageName}/edits`,
      { method: 'POST' },
    );
    const editId = edit.id;
    try {
      const result = await fn(editId);
      if (opts.commit) {
        await gpRequest(
          tokens,
          `${BASE_URL}/applications/${packageName}/edits/${editId}:commit`,
          { method: 'POST' },
        );
      } else {
        // Read-only: clean up without committing
        await gpRequest(
          tokens,
          `${BASE_URL}/applications/${packageName}/edits/${editId}`,
          { method: 'DELETE' },
        ).catch(() => {});
      }
      return result;
    } catch (err) {
      // Always clean up on error to avoid leaking edits
      await gpRequest(
        tokens,
        `${BASE_URL}/applications/${packageName}/edits/${editId}`,
        { method: 'DELETE' },
      ).catch(() => {});
      throw err;
    }
  }

  function vitalsMetricSet(metric: VitalMetricType): string {
    switch (metric) {
      case 'crash_rate': return 'crashRateMetricSet';
      case 'anr_rate': return 'anrRateMetricSet';
      case 'launch_time': return 'slowStartRateMetricSet';
      case 'excessive_wakeups': return 'excessiveWakeupRateMetricSet';
      case 'stuck_background_worker': return 'stuckBackgroundWakelockRateMetricSet';
      default: return 'crashRateMetricSet';
    }
  }

  return {
    // ─── App Management ────────────────────────────────────────────────────

    async listApps(_tokens: TokenSet): Promise<Paginated<StoreApp>> {
      throw new CapabilityError(
        'google-play',
        'Google Play API does not support listing all apps. Store managed package names in connection metadata.',
        false,
      );
    },

    async getApp(tokens: TokenSet, packageName: string): Promise<StoreApp> {
      return withEdit(tokens, packageName, async () => mapGoogleApp(packageName, {}));
    },

    // ─── Build & Artifact Management ───────────────────────────────────────

    async listBuilds(
      tokens: TokenSet,
      packageName: string,
      _opts?: BuildListOpts,
    ): Promise<Paginated<StoreBuild>> {
      return withEdit(tokens, packageName, async (editId) => {
        const [bundles, apks] = await Promise.all([
          gpRequest(tokens, `${BASE_URL}/applications/${packageName}/edits/${editId}/bundles`),
          gpRequest(tokens, `${BASE_URL}/applications/${packageName}/edits/${editId}/apks`),
        ]);

        const items: StoreBuild[] = [
          ...(bundles?.bundles ?? []).map((b: any) => mapGoogleBuild(packageName, b, 'bundle')),
          ...(apks?.apks ?? []).map((a: any) => mapGoogleBuild(packageName, a, 'apk')),
        ];

        return { items, hasMore: false };
      });
    },

    async getBuild(
      tokens: TokenSet,
      packageName: string,
      buildId: string,
    ): Promise<StoreBuild> {
      return withEdit(tokens, packageName, async (editId) => {
        const [bundles, apks] = await Promise.all([
          gpRequest(tokens, `${BASE_URL}/applications/${packageName}/edits/${editId}/bundles`),
          gpRequest(tokens, `${BASE_URL}/applications/${packageName}/edits/${editId}/apks`),
        ]);

        const allBuilds = [
          ...(bundles?.bundles ?? []).map((b: any) => mapGoogleBuild(packageName, b, 'bundle')),
          ...(apks?.apks ?? []).map((a: any) => mapGoogleBuild(packageName, a, 'apk')),
        ];

        const match = allBuilds.find((b) => b.id === buildId);
        if (!match) {
          throw new CapabilityError('google-play', `Build ${buildId} not found`, false);
        }
        return match;
      });
    },

    async listBuildArtifacts(
      tokens: TokenSet,
      packageName: string,
      buildId: string,
    ): Promise<StoreArtifact[]> {
      return withEdit(tokens, packageName, async (editId) => {
        const [bundles, apks] = await Promise.all([
          gpRequest(tokens, `${BASE_URL}/applications/${packageName}/edits/${editId}/bundles`),
          gpRequest(tokens, `${BASE_URL}/applications/${packageName}/edits/${editId}/apks`),
        ]);

        const results: StoreArtifact[] = [];

        for (const b of (bundles?.bundles ?? [])) {
          if (String(b.versionCode) === buildId) {
            results.push(mapGoogleArtifact(packageName, buildId, b, 'aab'));
          }
        }
        for (const a of (apks?.apks ?? [])) {
          if (String(a.versionCode) === buildId) {
            results.push(mapGoogleArtifact(packageName, buildId, a, 'apk'));
          }
        }

        return results;
      });
    },

    async getArtifactDownloadUrl(
      _tokens: TokenSet,
      _appId: string,
      _buildId: string,
      _artifactId: string,
    ): Promise<{ url: string; expiresAt: Date }> {
      throw new CapabilityError('google-play', 'Google Play does not provide artifact download URLs via the API.', false);
    },

    // ─── Release Management ─────────────────────────────────────────────────

    async listReleases(
      tokens: TokenSet,
      packageName: string,
      opts?: ReleaseListOpts,
    ): Promise<Paginated<StoreRelease>> {
      const targetTracks = opts?.track ? [opts.track] : [...ALL_TRACKS];

      return withEdit(tokens, packageName, async (editId) => {
        const allReleases: StoreRelease[] = [];

        await Promise.allSettled(
          targetTracks.map(async (track) => {
            const data = await gpRequest(
              tokens,
              `${BASE_URL}/applications/${packageName}/edits/${editId}/tracks/${track}`,
            ).catch(() => null);
            if (!data) return;
            for (const release of data?.releases ?? []) {
              const mapped = mapGoogleRelease(packageName, track, release);
              if (!opts?.status || mapped.status === opts.status) {
                allReleases.push(mapped);
              }
            }
          }),
        );

        return { items: allReleases, hasMore: false };
      });
    },

    async getRelease(
      tokens: TokenSet,
      packageName: string,
      releaseId: string,
    ): Promise<StoreRelease> {
      const [track] = releaseId.split(':');
      const result = await this.listReleases(tokens, packageName, { track });
      const match = result.items.find((r) => r.id === releaseId);
      if (!match) {
        throw new CapabilityError('google-play', `Release ${releaseId} not found`, false);
      }
      return match;
    },

    // ─── Track / Version Management ─────────────────────────────────────────

    async listTracks(
      tokens: TokenSet,
      packageName: string,
    ): Promise<StoreTrack[]> {
      return withEdit(tokens, packageName, async (editId) => {
        const data = await gpRequest(
          tokens,
          `${BASE_URL}/applications/${packageName}/edits/${editId}/tracks`,
        );
        return (data?.tracks ?? []).map((t: any) => mapGoogleTrack(packageName, t));
      });
    },

    async getTrack(
      tokens: TokenSet,
      packageName: string,
      trackId: string,
    ): Promise<StoreTrack> {
      const trackName = trackId.includes(':') ? (trackId.split(':')[1] ?? trackId) : trackId;
      const data = await withEdit(tokens, packageName, async (editId) => {
        return gpRequest<any>(
          tokens,
          `${BASE_URL}/applications/${packageName}/edits/${editId}/tracks/${trackName}`,
        );
      });
      return mapGoogleTrack(packageName, data);
    },

    async updateTrack(
      tokens: TokenSet,
      packageName: string,
      trackId: string,
      update: TrackUpdateRequest,
    ): Promise<StoreTrack> {
      const trackName = trackId.includes(':') ? (trackId.split(':')[1] ?? trackId) : trackId;
      return withEdit(tokens, packageName, async (editId) => {
        // Fetch current track
        const current = await gpRequest<any>(
          tokens,
          `${BASE_URL}/applications/${packageName}/edits/${editId}/tracks/${trackName}`,
        );

        const releases = current.releases ?? [];

        // Apply rollout update
        if (update.rolloutPercentage !== undefined) {
          for (const r of releases) {
            if (r.status === 'inProgress') {
              r.userFraction = update.rolloutPercentage / 100;
            }
          }
        }
        if (update.halt) {
          for (const r of releases) r.status = 'halted';
        } else if (update.resume) {
          for (const r of releases) {
            if (r.status === 'halted') r.status = 'inProgress';
          }
        } else if (update.completeRollout) {
          for (const r of releases) {
            delete r.userFraction;
            r.status = 'completed';
          }
        }

        const updated = await gpRequest<any>(
          tokens,
          `${BASE_URL}/applications/${packageName}/edits/${editId}/tracks/${trackName}`,
          { method: 'PUT', body: JSON.stringify({ track: trackName, releases }) },
        );

        return mapGoogleTrack(packageName, updated);
      }, { commit: true });
    },

    async listVersions(
      tokens: TokenSet,
      packageName: string,
    ): Promise<StoreVersion[]> {
      const releases = await this.listReleases(tokens, packageName);
      return releases.items.map((r): StoreVersion => ({
        id: r.id,
        appId: packageName,
        versionString: r.version,
        state: r.status,
        platform: 'android',
        createdAt: r.createdAt,
      }));
    },

    async getVersion(
      tokens: TokenSet,
      packageName: string,
      versionId: string,
    ): Promise<StoreVersion> {
      const versions = await this.listVersions(tokens, packageName);
      const match = versions.find((v) => v.id === versionId);
      if (!match) {
        throw new CapabilityError('google-play', `Version ${versionId} not found`, false);
      }
      return match;
    },

    // ─── Publishing ─────────────────────────────────────────────────────────

    async submitForReview(
      tokens: TokenSet,
      packageName: string,
      _req: SubmitForReviewRequest,
    ): Promise<PublishResult> {
      // Google Play: move draft to completed (no track concept in submit)
      const targetTrack = 'production';
      return withEdit(tokens, packageName, async (editId) => {
        const current = await gpRequest<any>(
          tokens,
          `${BASE_URL}/applications/${packageName}/edits/${editId}/tracks/${targetTrack}`,
        ).catch(() => ({ releases: [] }));

        const releases = (current.releases ?? []).map((r: any) =>
          r.status === 'draft' ? { ...r, status: 'completed' } : r,
        );

        await gpRequest(
          tokens,
          `${BASE_URL}/applications/${packageName}/edits/${editId}/tracks/${targetTrack}`,
          { method: 'PUT', body: JSON.stringify({ track: targetTrack, releases }) },
        );

        return {
          success: true,
          releaseId: `${targetTrack}:submitted`,
          status: 'in_review',
        };
      }, { commit: true });
    },

    async releaseToTrack(
      tokens: TokenSet,
      packageName: string,
      req: ReleaseToTrackRequest,
    ): Promise<PublishResult> {
      return withEdit(tokens, packageName, async (editId) => {
        const userFraction =
          req.rolloutPercentage != null ? req.rolloutPercentage / 100 : undefined;

        const release: Record<string, any> = {
          name: req.buildId,
          status: userFraction != null && userFraction < 1 ? 'inProgress' : 'completed',
          versionCodes: [req.buildId],
        };

        if (userFraction != null) {
          release.userFraction = userFraction;
        }

        if (req.releaseNotes?.length) {
          release.releaseNotes = req.releaseNotes.map((n) => ({
            language: n.language,
            text: n.text,
          }));
        }

        await gpRequest(
          tokens,
          `${BASE_URL}/applications/${packageName}/edits/${editId}/tracks/${req.track}`,
          {
            method: 'PUT',
            body: JSON.stringify({ track: req.track, releases: [release] }),
          },
        );

        return {
          success: true,
          releaseId: `${req.track}:${req.buildId}`,
          status: release.status === 'inProgress' ? 'rolling_out' : 'completed',
        };
      }, { commit: true });
    },

    async updateRollout(
      tokens: TokenSet,
      packageName: string,
      releaseId: string,
      update: RolloutUpdateRequest,
    ): Promise<StoreRelease> {
      const [targetTrack] = releaseId.split(':');
      return withEdit(tokens, packageName, async (editId) => {
        const current = await gpRequest<any>(
          tokens,
          `${BASE_URL}/applications/${packageName}/edits/${editId}/tracks/${targetTrack}`,
        );

        const releases = (current.releases ?? []).map((r: any) => {
          if (r.status !== 'inProgress') return r;
          if (update.pause) return { ...r, status: 'halted' };
          if (update.resume) return { ...r, status: 'inProgress' };
          if (update.completeRollout) {
            const { userFraction: _dropped, ...rest } = r;
            return { ...rest, status: 'completed' };
          }
          if (update.rolloutPercentage != null) {
            return { ...r, userFraction: update.rolloutPercentage / 100 };
          }
          return r;
        });

        await gpRequest(
          tokens,
          `${BASE_URL}/applications/${packageName}/edits/${editId}/tracks/${targetTrack}`,
          { method: 'PUT', body: JSON.stringify({ track: targetTrack, releases }) },
        );

      const updatedRelease = releases.find((r: any) => r.versionCodes?.[0] != null) ?? releases[0];
      return mapGoogleRelease(packageName, targetTrack ?? 'production', updatedRelease ?? {});
      }, { commit: true });
    },

    async haltRelease(
      tokens: TokenSet,
      packageName: string,
      releaseId: string,
    ): Promise<StoreRelease> {
      return this.updateRollout(tokens, packageName, releaseId, { pause: true });
    },

    // ─── Reviews & Ratings ──────────────────────────────────────────────────

    async listReviews(
      tokens: TokenSet,
      packageName: string,
      opts?: ReviewListOpts,
    ): Promise<Paginated<StoreReview>> {
      const params = new URLSearchParams({ maxResults: String(opts?.limit ?? 20) });
      if (opts?.cursor) params.set('token', opts.cursor);

      const data = await gpRequest(
        tokens,
        `${BASE_URL}/applications/${packageName}/reviews?${params}`,
      );

      return {
        items: (data?.reviews ?? []).map(mapGoogleReview),
        hasMore: !!data?.tokenPagination?.nextPageToken,
        cursor: data?.tokenPagination?.nextPageToken,
      };
    },

    async getReview(
      tokens: TokenSet,
      packageName: string,
      reviewId: string,
    ): Promise<StoreReview> {
      const data = await gpRequest(
        tokens,
        `${BASE_URL}/applications/${packageName}/reviews/${reviewId}`,
      );
      return { ...mapGoogleReview(data), appId: packageName };
    },

    async replyToReview(
      tokens: TokenSet,
      packageName: string,
      reviewId: string,
      body: string,
    ): Promise<StoreReviewReply> {
      const data = await gpRequest<{ result: { replyText: string; lastEdited: { seconds: string } } }>(
        tokens,
        `${BASE_URL}/applications/${packageName}/reviews/${reviewId}:reply`,
        { method: 'POST', body: JSON.stringify({ replyText: body }) },
      );
      return {
        body: data.result?.replyText ?? body,
        updatedAt: data.result?.lastEdited?.seconds
          ? new Date(Number(data.result.lastEdited.seconds) * 1000)
          : new Date(),
      };
    },

    async deleteReviewReply(
      _tokens: TokenSet,
      _packageName: string,
      _reviewId: string,
    ): Promise<void> {
      throw new CapabilityError('google-play', 'Google Play API does not support deleting review replies.', false);
    },

    async getRatingSummary(
      tokens: TokenSet,
      packageName: string,
      _opts?: RatingSummaryOpts,
    ): Promise<RatingSummary> {
      const data = await gpRequest(
        tokens,
        `${BASE_URL}/applications/${packageName}/reviews?maxResults=1`,
      );
      // Google Play does not have a dedicated rating summary endpoint.
      // Uses aggregate from the reviews listing if available.
      return mapGoogleRatingSummary(packageName, data?.averageRating ? data : {});
    },

    async listRatings(
      tokens: TokenSet,
      packageName: string,
      opts?: RatingListOpts,
    ): Promise<Paginated<StoreRating>> {
      const reviewPage = await this.listReviews(tokens, packageName, {
        limit: opts?.limit ?? 50,
        cursor: opts?.cursor,
      });

      const ratings = reviewPage.items.map((r): StoreRating => ({
        id: r.id,
        appId: packageName,
        rating: r.rating,
        territory: r.territory,
        appVersion: r.appVersion,
        createdAt: r.createdAt,
      }));

      return { items: ratings, hasMore: reviewPage.hasMore, cursor: reviewPage.cursor };
    },

    // ─── Beta Testing ───────────────────────────────────────────────────────

    async listBetaGroups(
      _tokens: TokenSet,
      packageName: string,
    ): Promise<BetaGroup[]> {
      return ['internal', 'alpha', 'beta'].map((t) => mapGoogleBetaGroup(packageName, t));
    },

    async getBetaGroup(
      tokens: TokenSet,
      packageName: string,
      groupId: string,
    ): Promise<BetaGroup> {
      const groups = await this.listBetaGroups(tokens, packageName);
      const match = groups.find((g) => g.id === groupId);
      if (!match) {
        throw new CapabilityError('google-play', `Beta group ${groupId} not found`, false);
      }
      return match;
    },

    async createBetaGroup(
      _tokens: TokenSet,
      _packageName: string,
      _input: CreateBetaGroupInput,
    ): Promise<BetaGroup> {
      throw new CapabilityError('google-play', 'Google Play uses fixed tracks and does not support creating custom beta groups.', false);
    },

    async deleteBetaGroup(
      _tokens: TokenSet,
      _packageName: string,
      _groupId: string,
    ): Promise<void> {
      throw new CapabilityError('google-play', 'Google Play uses fixed tracks and does not support deleting beta groups.', false);
    },

    async listBetaTesters(
      tokens: TokenSet,
      packageName: string,
      groupId: string,
      _opts?: PaginationOpts,
    ): Promise<Paginated<BetaTester>> {
      // Correct URL: .../edits/{editId}/testers/{track}  (track is a path segment; requires an edit)
      const trackName = groupId.includes(':') ? (groupId.split(':')[1] ?? groupId) : groupId;
      const data = await withEdit(tokens, packageName, async (editId) =>
        gpRequest<any>(
          tokens,
          `${BASE_URL}/applications/${packageName}/edits/${editId}/testers/${encodeURIComponent(trackName)}`,
        ).catch(() => ({ googleGroups: [] })),
      );
      // Testers resource uses googleGroups (Google Group emails); individual email lists are unsupported
      const groups: string[] = data?.googleGroups ?? [];
      return { items: groups.map(mapGoogleBetaTester), hasMore: false };
    },

    async addBetaTesters(
      tokens: TokenSet,
      groupId: string,
      testers: BetaTesterInput[],
    ): Promise<void> {
      const parts = groupId.includes(':') ? groupId.split(':') : ['', groupId];
      const packageName = parts[0] ?? '';
      const trackName = parts[1] ?? groupId;

      await withEdit(tokens, packageName, async (editId) => {
        const testersUrl = `${BASE_URL}/applications/${packageName}/edits/${editId}/testers/${encodeURIComponent(trackName)}`;
        const current = await gpRequest<any>(tokens, testersUrl).catch(() => ({ googleGroups: [] }));
        const existing: string[] = current?.googleGroups ?? [];
        const merged = [...new Set([...existing, ...testers.map((t) => t.email)])];
        await gpRequest(tokens, testersUrl, {
          method: 'PUT',
          body: JSON.stringify({ googleGroups: merged }),
        });
      }, { commit: true });
    },

    async removeBetaTesters(
      tokens: TokenSet,
      groupId: string,
      testerIds: string[],
    ): Promise<void> {
      const parts = groupId.includes(':') ? groupId.split(':') : ['', groupId];
      const packageName = parts[0] ?? '';
      const trackName = parts[1] ?? groupId;

      await withEdit(tokens, packageName, async (editId) => {
        const testersUrl = `${BASE_URL}/applications/${packageName}/edits/${editId}/testers/${encodeURIComponent(trackName)}`;
        const current = await gpRequest<any>(tokens, testersUrl).catch(() => ({ googleGroups: [] }));
        const existing: string[] = current?.googleGroups ?? [];
        const filtered = existing.filter((e) => !testerIds.includes(e));
        await gpRequest(tokens, testersUrl, {
          method: 'PUT',
          body: JSON.stringify({ googleGroups: filtered }),
        });
      }, { commit: true });
    },

    async assignBuildToBetaGroup(
      tokens: TokenSet,
      packageName: string,
      groupId: string,
      buildId: string,
    ): Promise<void> {
      const trackName = groupId.includes(':') ? (groupId.split(':')[1] ?? groupId) : groupId;
      await this.releaseToTrack(tokens, packageName, {
        track: trackName,
        buildId,
      });
    },

    async removeBuildFromBetaGroup(
      _tokens: TokenSet,
      _packageName: string,
      _groupId: string,
      _buildId: string,
    ): Promise<void> {
      // Removing a specific version from a track requires promoting or clearing the track
      throw new CapabilityError('google-play', 'Removing a specific build from a Google Play track is not directly supported. Use releaseToTrack with a different version.', false);
    },

    // ─── App Vitals ─────────────────────────────────────────────────────────

    async getVitalsSummary(
      _tokens: TokenSet,
      packageName: string,
      _opts?: VitalsQueryOpts,
    ): Promise<VitalsSummary> {
      const period = {
        start: _opts?.startDate ?? new Date(Date.now() - 28 * 86400000),
        end: _opts?.endDate ?? new Date(),
      };

      return {
        appId: packageName,
        platform: 'android' as const,
        period,
        metrics: {
          crashRate: { value: 0, unit: '%', status: 'good' as const, trend: 'stable' as const },
          anrRate: { value: 0, unit: '%', status: 'good' as const, trend: 'stable' as const },
          launchTime: { value: 0, unit: 'ms', status: 'good' as const, trend: 'stable' as const },
        },
      };
    },

    async getVitalMetric(
      tokens: TokenSet,
      packageName: string,
      metric: VitalMetricType,
      opts?: VitalsQueryOpts,
    ): Promise<VitalMetric> {
      const metricSet = vitalsMetricSet(metric);
      const body: Record<string, any> = {
        dimensions: ['date'],
        metrics: [metric === 'crash_rate' ? 'userPerceivedCrashRate' : metric],
        timelineSpec: {
          aggregationPeriod: 'DAILY',
          startTime: opts?.startDate
            ? { year: opts.startDate.getFullYear(), month: opts.startDate.getMonth() + 1, day: opts.startDate.getDate() }
            : undefined,
          endTime: opts?.endDate
            ? { year: opts.endDate.getFullYear(), month: opts.endDate.getMonth() + 1, day: opts.endDate.getDate() }
            : undefined,
        },
      };

      const data = await gpRequest<any>(
        tokens,
        `${REPORTING_URL}/apps/${encodeURIComponent(packageName)}/${metricSet}:query`,
        { method: 'POST', body: JSON.stringify(body) },
      );

      return mapGoogleVitalMetric(packageName, metric, data);
    },

    async listCrashClusters(
      tokens: TokenSet,
      packageName: string,
      opts?: CrashQueryOpts,
    ): Promise<Paginated<CrashCluster>> {
      const params = new URLSearchParams();
      if (opts?.limit) params.set('pageSize', String(opts.limit));
      if (opts?.cursor) params.set('pageToken', opts.cursor);

      const data = await gpRequest<any>(
        tokens,
        `${REPORTING_URL}/apps/${encodeURIComponent(packageName)}/errorIssues?${params}&filter=errorType%3DCRASH`,
      );

      return {
        items: (data?.errorIssues ?? []).map((e: any) => mapGoogleCrashCluster(packageName, e)),
        hasMore: !!data?.nextPageToken,
        cursor: data?.nextPageToken,
      };
    },

    async getCrashCluster(
      tokens: TokenSet,
      packageName: string,
      clusterId: string,
    ): Promise<CrashCluster> {
      const data = await gpRequest<any>(
        tokens,
        `${REPORTING_URL}/apps/${encodeURIComponent(packageName)}/errorIssues/${clusterId}`,
      );
      return mapGoogleCrashCluster(packageName, data);
    },

    async listAnrClusters(
      tokens: TokenSet,
      packageName: string,
      opts?: CrashQueryOpts,
    ): Promise<Paginated<AnrCluster>> {
      const params = new URLSearchParams();
      if (opts?.limit) params.set('pageSize', String(opts.limit));
      if (opts?.cursor) params.set('pageToken', opts.cursor);

      const data = await gpRequest<any>(
        tokens,
        `${REPORTING_URL}/apps/${encodeURIComponent(packageName)}/errorIssues?${params}&filter=errorType%3DANR`,
      );

      return {
        items: (data?.errorIssues ?? []).map((e: any) => mapGoogleAnrCluster(packageName, e)),
        hasMore: !!data?.nextPageToken,
        cursor: data?.nextPageToken,
      };
    },
  };
}

