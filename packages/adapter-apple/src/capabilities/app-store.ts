import type {
  AppStoreCapability,
  TokenSet,
  StoreArtifact,
  StoreTrack,
  VitalMetricType,
  AnrCluster,
} from '@apollo-deploy/integrations';
import { CapabilityError } from '@apollo-deploy/integrations';
import {
  mapAppleApp,
  mapAppleBuild,
  mapAppleRelease,
  mapAppleVersion,
  mapAppleReview,
  mapAppleBetaGroup,
  mapAppleBetaTester,
  mapAppleArtifact,
  mapAppleCrashCluster,
  mapAppleVitalsMetric,
} from '../mappers/models.js';
import { generateAppleJWT } from '../oauth.js';
import type { AppleAdapterConfig } from '../types.js';

const BASE_URL = 'https://api.appstoreconnect.apple.com/v1';

export function createAppleAppStore(config: AppleAdapterConfig): AppStoreCapability {

  async function appleRequest<T = any>(
    tokens: TokenSet,
    path: string,
    init?: RequestInit,
  ): Promise<T> {
    let accessToken = tokens.accessToken;

    // Regenerate if expired or within 60s of expiry
    if (tokens.expiresAt && tokens.expiresAt.getTime() - Date.now() < 60_000) {
      accessToken = generateAppleJWT(config);
    }

    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(init?.headers as Record<string, string> | undefined),
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new CapabilityError('apple', `Apple API ${res.status}: ${body}`, res.status === 429);
    }

    if (res.status === 204) return null as T;
    return res.json() as Promise<T>;
  }

  function extractCursor(nextUrl?: string): string | undefined {
    if (!nextUrl) return undefined;
    try {
      const url = new URL(nextUrl);
      return url.searchParams.get('cursor') ?? undefined;
    } catch {
      return undefined;
    }
  }

  const capability: AppStoreCapability = {
    // ── 1. App Management ──────────────────────────────────────────

    async listApps(tokens) {
      const data = await appleRequest(tokens, '/apps?limit=200');
      return {
        items: data.data.map(mapAppleApp),
        hasMore: !!data.links?.next,
        cursor: extractCursor(data.links?.next),
      };
    },

    async getApp(tokens, appId) {
      const data = await appleRequest(tokens, `/apps/${appId}`);
      return mapAppleApp(data.data);
    },

    // ── 2. Builds & Artifacts ──────────────────────────────────────

    async listBuilds(tokens, appId, opts) {
      const params = new URLSearchParams({
        'filter[app]': appId,
        limit: String(opts?.limit ?? 20),
      });
      if (opts?.cursor) params.set('cursor', opts.cursor);
      if (opts?.status) params.set('filter[processingState]', opts.status.toUpperCase());
      if (opts?.version) params.set('filter[version]', opts.version);

      const data = await appleRequest(tokens, `/builds?${params}`);
      return {
        items: data.data.map(mapAppleBuild),
        hasMore: !!data.links?.next,
        cursor: extractCursor(data.links?.next),
      };
    },

    async getBuild(tokens, _appId, buildId) {
      const data = await appleRequest(tokens, `/builds/${buildId}`);
      return mapAppleBuild(data.data);
    },

    async listBuildArtifacts(tokens, _appId, buildId) {
      // Step 1: Get build bundles associated with this build
      const bundleData = await appleRequest(
        tokens,
        `/builds/${buildId}?include=buildBundles`,
      );

      const artifacts: StoreArtifact[] = [];
      const bundles = (bundleData.included ?? []).filter(
        (r: any) => r.type === 'buildBundles',
      );

      for (const bundle of bundles) {
        // Step 2: Fetch dSYMs for each bundle
        try {
          const dsyms = await appleRequest(tokens, `/buildBundles/${bundle.id}/dSYMs`);
          for (const dsym of dsyms.data ?? []) {
            artifacts.push(mapAppleArtifact(buildId, dsym, 'dsym'));
          }
        } catch {
          // dSYMs may not be available yet
        }
      }

      return artifacts;
    },

    async getArtifactDownloadUrl(tokens, _appId, _buildId, artifactId) {
      const data = await appleRequest(tokens, `/buildBundleFileSizes/${artifactId}`);
      return {
        url: data.data?.attributes?.downloadUrl as string ?? '',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };
    },

    // ── 3. Releases ────────────────────────────────────────────────

    async listReleases(tokens, appId, opts) {
      const params = new URLSearchParams({
        'filter[app]': appId,
        limit: String(opts?.limit ?? 20),
      });
      if (opts?.cursor) params.set('cursor', opts.cursor);
      if (opts?.status) {
        const appleState = mapReleaseStatusToAppleState(opts.status);
        if (appleState) params.set('filter[appStoreState]', appleState);
      }

      const data = await appleRequest(tokens, `/appStoreVersions?${params}`);
      return {
        items: data.data.map(mapAppleRelease),
        hasMore: !!data.links?.next,
        cursor: extractCursor(data.links?.next),
      };
    },

    async getRelease(tokens, _appId, releaseId) {
      const data = await appleRequest(
        tokens,
        `/appStoreVersions/${releaseId}?include=appStoreVersionPhasedRelease`,
      );
      return mapAppleRelease(data.data);
    },

    // ── 4. Tracks & Versions ───────────────────────────────────────

    async listTracks(tokens, appId) {
      const [versions, betaData] = await Promise.all([
        appleRequest(tokens, `/appStoreVersions?filter[app]=${appId}&limit=1&sort=-createdDate`),
        appleRequest(tokens, `/preReleaseVersions?filter[app]=${appId}&limit=1`).catch(() => ({ data: [] })),
      ]);

      const tracks: StoreTrack[] = [
        {
          id: 'app_store',
          appId,
          name: 'App Store',
          type: 'production',
          releases: (versions.data ?? []).map((v: any) => ({
            version: v.attributes.versionString,
            versionCodes: [v.id],
            status: mapAppleReleaseStatus(v.attributes.appStoreState) as any,
            releaseNotes: [],
          })),
        },
        {
          id: 'testflight',
          appId,
          name: 'TestFlight',
          type: 'beta',
          releases: (betaData.data ?? []).map((v: any) => ({
            version: v.attributes.version,
            versionCodes: [v.id],
            status: 'draft' as const,
            releaseNotes: [],
          })),
        },
      ];

      return tracks;
    },

    async getTrack(tokens, appId, trackId) {
      const tracks = await capability.listTracks(tokens, appId);
      const match = tracks.find((t) => t.id === trackId);
      if (!match) throw new CapabilityError('apple', `Track ${trackId} not found`, false);
      return match;
    },

    async updateTrack(tokens, appId, trackId, update) {
      if (trackId === 'app_store') {
        const versions = await appleRequest(
          tokens,
          `/appStoreVersions?filter[app]=${appId}&limit=1&sort=-createdDate`,
        );
        const versionId = versions.data[0]?.id as string | undefined;
        if (!versionId) throw new CapabilityError('apple', 'No App Store Version found', false);

        // Get the phased release ID if needed
        const withPhased = await appleRequest(
          tokens,
          `/appStoreVersions/${versionId}?include=appStoreVersionPhasedRelease`,
        );
        const phasedReleaseId = withPhased.included?.[0]?.id as string | undefined;

        if (update.completeRollout && phasedReleaseId) {
          await appleRequest(tokens, `/appStoreVersionPhasedReleases/${phasedReleaseId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              data: {
                type: 'appStoreVersionPhasedReleases',
                id: phasedReleaseId,
                attributes: { phasedReleaseState: 'COMPLETE' },
              },
            }),
          });
        } else if (update.halt && phasedReleaseId) {
          await appleRequest(tokens, `/appStoreVersionPhasedReleases/${phasedReleaseId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              data: {
                type: 'appStoreVersionPhasedReleases',
                id: phasedReleaseId,
                attributes: { phasedReleaseState: 'PAUSED' },
              },
            }),
          });
        } else if (update.resume && phasedReleaseId) {
          await appleRequest(tokens, `/appStoreVersionPhasedReleases/${phasedReleaseId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              data: {
                type: 'appStoreVersionPhasedReleases',
                id: phasedReleaseId,
                attributes: { phasedReleaseState: 'ACTIVE' },
              },
            }),
          });
        }
      }

      return capability.getTrack(tokens, appId, trackId);
    },

    async listVersions(tokens, appId) {
      const params = new URLSearchParams({ 'filter[app]': appId });
      const data = await appleRequest(tokens, `/appStoreVersions?${params}`);
      return data.data.map(mapAppleVersion);
    },

    async getVersion(tokens, _appId, versionId) {
      const data = await appleRequest(tokens, `/appStoreVersions/${versionId}`);
      return mapAppleVersion(data.data);
    },

    // ── 5. Publishing ──────────────────────────────────────────────

    async submitForReview(tokens, _appId, request) {
      await appleRequest(tokens, '/appStoreVersionSubmissions', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'appStoreVersionSubmissions',
            relationships: {
              appStoreVersion: {
                data: { type: 'appStoreVersions', id: request.versionId },
              },
            },
          },
        }),
      });

      if (request.phasedRelease) {
        await appleRequest(tokens, '/appStoreVersionPhasedReleases', {
          method: 'POST',
          body: JSON.stringify({
            data: {
              type: 'appStoreVersionPhasedReleases',
              attributes: { phasedReleaseState: 'INACTIVE' },
              relationships: {
                appStoreVersion: {
                  data: { type: 'appStoreVersions', id: request.versionId },
                },
              },
            },
          }),
        }).catch(() => {
          // May already exist; non-fatal
        });
      }

      return {
        success: true,
        status: 'in_review' as const,
        message: 'Submitted for App Review',
        releaseId: request.versionId,
      };
    },

    async releaseToTrack(tokens, _appId, request) {
      // Release a version that is PENDING_DEVELOPER_RELEASE
      await appleRequest(tokens, `/appStoreVersions/${request.buildId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          data: {
            type: 'appStoreVersions',
            id: request.buildId,
            attributes: { releaseType: 'MANUAL' },
          },
        }),
      });

      return {
        success: true,
        status: 'completed' as const,
        message: 'Released to App Store',
        releaseId: request.buildId,
      };
    },

    async updateRollout(tokens, _appId, releaseId, update) {
      const versionData = await appleRequest(
        tokens,
        `/appStoreVersions/${releaseId}?include=appStoreVersionPhasedRelease`,
      );
      const phasedRelease = (versionData.included ?? []).find(
        (r: any) => r.type === 'appStoreVersionPhasedReleases',
      );

      if (!phasedRelease) {
        throw new CapabilityError('apple', 'No phased release found for this version', false);
      }

      let newState: string;
      if (update.completeRollout) newState = 'COMPLETE';
      else if (update.pause) newState = 'PAUSED';
      else if (update.resume) newState = 'ACTIVE';
      else throw new CapabilityError('apple', 'Must specify completeRollout, pause, or resume', false);

      await appleRequest(
        tokens,
        `/appStoreVersionPhasedReleases/${phasedRelease.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            data: {
              type: 'appStoreVersionPhasedReleases',
              id: phasedRelease.id,
              attributes: { phasedReleaseState: newState },
            },
          }),
        },
      );

      return capability.getRelease(tokens, '', releaseId);
    },

    async haltRelease(tokens, appId, releaseId, _reason) {
      return capability.updateRollout(tokens, appId, releaseId, { pause: true });
    },

    // ── 6. Reviews & Ratings ───────────────────────────────────────

    async listReviews(tokens, appId, opts) {
      const params = new URLSearchParams({ limit: String(opts?.limit ?? 20) });
      if (opts?.cursor) params.set('cursor', opts.cursor);

      if (opts?.sortBy === 'rating') {
        params.set('sort', opts.sortOrder === 'asc' ? 'rating' : '-rating');
      } else {
        params.set('sort', opts?.sortOrder === 'asc' ? 'createdDate' : '-createdDate');
      }

      params.set('include', 'response');

      if (opts?.territory) params.set('filter[territory]', opts.territory);
      if (opts?.appVersion) params.set('filter[version]', opts.appVersion);

      const data = await appleRequest(tokens, `/apps/${appId}/customerReviews?${params}`);

      const responseMap = new Map<string, any>();
      for (const inc of data.included ?? []) {
        if (inc.type === 'customerReviewResponses') {
          const reviewId = inc.relationships?.review?.data?.id;
          if (reviewId) responseMap.set(reviewId, inc);
        }
      }

      return {
        items: data.data.map((r: any) => mapAppleReview(r, responseMap.get(r.id))),
        hasMore: !!data.links?.next,
        cursor: extractCursor(data.links?.next),
      };
    },

    async getReview(tokens, _appId, reviewId) {
      const data = await appleRequest(
        tokens,
        `/customerReviews/${reviewId}?include=response`,
      );
      const response = (data.included ?? []).find(
        (r: any) => r.type === 'customerReviewResponses',
      );
      return mapAppleReview(data.data, response);
    },

    async replyToReview(tokens, _appId, reviewId, body) {
      const result = await appleRequest(tokens, '/customerReviewResponses', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'customerReviewResponses',
            attributes: { responseBody: body },
            relationships: {
              review: { data: { type: 'customerReviews', id: reviewId } },
            },
          },
        }),
      });

      return {
        body: result?.data?.attributes?.responseBody ?? body,
        updatedAt: new Date(),
      };
    },

    async deleteReviewReply(tokens, _appId, reviewId) {
      const review = await appleRequest(
        tokens,
        `/customerReviews/${reviewId}?include=response`,
      );
      const responseId = (review.included ?? []).find(
        (r: any) => r.type === 'customerReviewResponses',
      )?.id as string | undefined;

      if (!responseId) throw new CapabilityError('apple', 'No developer reply found for this review', false);

      await appleRequest(tokens, `/customerReviewResponses/${responseId}`, {
        method: 'DELETE',
      });
    },

    async getRatingSummary(tokens, appId, _opts) {
      const reviews = await appleRequest(
        tokens,
        `/apps/${appId}/customerReviews?limit=200&sort=-createdDate`,
      );

      const histogram = { oneStar: 0, twoStar: 0, threeStar: 0, fourStar: 0, fiveStar: 0 };
      let total = 0;
      let sum = 0;

      for (const review of reviews.data ?? []) {
        const rating = review.attributes.rating as number;
        total++;
        sum += rating;
        if (rating === 1) histogram.oneStar++;
        else if (rating === 2) histogram.twoStar++;
        else if (rating === 3) histogram.threeStar++;
        else if (rating === 4) histogram.fourStar++;
        else if (rating === 5) histogram.fiveStar++;
      }

      return {
        appId,
        averageRating: total > 0 ? sum / total : 0,
        totalRatings: total,
        histogram,
      };
    },

    async listRatings(tokens, appId, opts) {
      // Apple doesn't expose star-only ratings via public API; derive from reviews
      const reviews = await capability.listReviews(tokens, appId, {
        limit: opts?.limit,
        cursor: opts?.cursor,
      });

      return {
        items: reviews.items.map((r) => ({
          id: r.id,
          appId: r.appId,
          rating: r.rating,
          territory: r.territory,
          appVersion: r.appVersion,
          createdAt: r.createdAt,
        })),
        hasMore: reviews.hasMore,
        cursor: reviews.cursor,
      };
    },

    // ── 7. Beta Testing ────────────────────────────────────────────

    async listBetaGroups(tokens, appId) {
      const params = new URLSearchParams({ 'filter[app]': appId });
      const data = await appleRequest(tokens, `/betaGroups?${params}`);
      return data.data.map(mapAppleBetaGroup);
    },

    async getBetaGroup(tokens, _appId, groupId) {
      const data = await appleRequest(
        tokens,
        `/betaGroups/${groupId}?include=betaTesters`,
      );
      return mapAppleBetaGroup(data.data);
    },

    async createBetaGroup(tokens, appId, input) {
      const result = await appleRequest(tokens, '/betaGroups', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'betaGroups',
            attributes: {
              name: input.name,
              isInternalGroup: input.isInternal,
              hasAccessToAllBuilds: false,
              publicLinkEnabled: input.publicLinkEnabled ?? false,
              publicLinkLimit: input.testerLimit,
            },
            relationships: {
              app: { data: { type: 'apps', id: appId } },
            },
          },
        }),
      });
      return mapAppleBetaGroup(result.data);
    },

    async deleteBetaGroup(tokens, _appId, groupId) {
      await appleRequest(tokens, `/betaGroups/${groupId}`, { method: 'DELETE' });
    },

    async listBetaTesters(tokens, _appId, groupId, opts) {
      const params = new URLSearchParams({ limit: String(opts?.limit ?? 20) });
      if (opts?.cursor) params.set('cursor', opts.cursor);

      const data = await appleRequest(
        tokens,
        `/betaGroups/${groupId}/betaTesters?${params}`,
      );
      return {
        items: data.data.map(mapAppleBetaTester),
        hasMore: !!data.links?.next,
        cursor: extractCursor(data.links?.next),
      };
    },

    async addBetaTesters(tokens, groupId, testers) {
      for (const tester of testers) {
        await appleRequest(tokens, '/betaTesters', {
          method: 'POST',
          body: JSON.stringify({
            data: {
              type: 'betaTesters',
              attributes: {
                email: tester.email,
                firstName: tester.firstName,
                lastName: tester.lastName,
              },
              relationships: {
                betaGroups: { data: [{ type: 'betaGroups', id: groupId }] },
              },
            },
          }),
        });
      }
    },

    async removeBetaTesters(tokens, groupId, testerIds) {
      await appleRequest(
        tokens,
        `/betaGroups/${groupId}/relationships/betaTesters`,
        {
          method: 'DELETE',
          body: JSON.stringify({
            data: testerIds.map((id) => ({ type: 'betaTesters', id })),
          }),
        },
      );
    },

    async assignBuildToBetaGroup(tokens, _appId, groupId, buildId) {
      await appleRequest(tokens, `/betaGroups/${groupId}/relationships/builds`, {
        method: 'POST',
        body: JSON.stringify({ data: [{ type: 'builds', id: buildId }] }),
      });
    },

    async removeBuildFromBetaGroup(tokens, _appId, groupId, buildId) {
      await appleRequest(tokens, `/betaGroups/${groupId}/relationships/builds`, {
        method: 'DELETE',
        body: JSON.stringify({ data: [{ type: 'builds', id: buildId }] }),
      });
    },

    // ── 8. Vitals ──────────────────────────────────────────────────

    async getVitalsSummary(tokens, appId, opts) {
      const params = new URLSearchParams({ 'filter[platform]': 'IOS' });
      if (opts?.version) params.set('filter[version]', opts.version);

      const [perfData, _crashData, _hangData] = await Promise.all([
        appleRequest(tokens, `/apps/${appId}/perfPowerMetrics?${params}`).catch(() => null),
        appleRequest(tokens, `/apps/${appId}/diagnosticSignatures?filter[diagnosticType]=CRASH&limit=1`).catch(() => null),
        appleRequest(tokens, `/apps/${appId}/diagnosticSignatures?filter[diagnosticType]=HANG&limit=1`).catch(() => null),
      ]);

      const period = {
        start: opts?.startDate ?? new Date(Date.now() - 28 * 86400000),
        end: opts?.endDate ?? new Date(),
      };

      return {
        appId,
        platform: 'ios' as const,
        period,
        metrics: {
          crashRate: extractApplePerfMetric(perfData, 'CRASH_RATE'),
          launchTime: extractApplePerfMetric(perfData, 'LAUNCH'),
          memoryUsage: extractApplePerfMetric(perfData, 'MEMORY'),
          diskWrites: extractApplePerfMetric(perfData, 'DISK_WRITES'),
        },
      };
    },

    async getVitalMetric(tokens, appId, metric, opts) {
      const appleMetricType = mapVitalMetricToApple(metric);
      const params = new URLSearchParams({
        'filter[metricType]': appleMetricType,
        'filter[platform]': 'IOS',
      });
      if (opts?.version) params.set('filter[version]', opts.version);

      const data = await appleRequest(tokens, `/apps/${appId}/perfPowerMetrics?${params}`);
      return mapAppleVitalsMetric(appId, metric, data);
    },

    async listCrashClusters(tokens, appId, opts) {
      const params = new URLSearchParams({
        'filter[diagnosticType]': 'CRASH',
        limit: String(opts?.limit ?? 20),
      });
      if (opts?.cursor) params.set('cursor', opts.cursor);
      if (opts?.version) params.set('filter[version]', opts.version);

      const data = await appleRequest(
        tokens,
        `/apps/${appId}/diagnosticSignatures?${params}`,
      );

      return {
        items: (data.data ?? []).map((s: any) => mapAppleCrashCluster(appId, s)),
        hasMore: !!data.links?.next,
        cursor: extractCursor(data.links?.next),
      };
    },

    async getCrashCluster(tokens, _appId, clusterId) {
      const [signature, logs] = await Promise.all([
        appleRequest(tokens, `/diagnosticSignatures/${clusterId}`),
        appleRequest(tokens, `/diagnosticSignatures/${clusterId}/logs`).catch(() => ({ data: [] })),
      ]);

      const cluster = mapAppleCrashCluster('', signature.data);
      cluster.stackTrace = logs.data?.[0]?.attributes?.diagnosticLog as string | undefined;
      return cluster;
    },

    async listAnrClusters() {
      // ANR is Android-only. Apple equivalent is "hangs" — use listCrashClusters with HANG type.
      return { items: [] as AnrCluster[], hasMore: false };
    },
  };

  return capability;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function mapReleaseStatusToAppleState(status: string): string | undefined {
  const map: Record<string, string> = {
    draft: 'PREPARE_FOR_SUBMISSION',
    in_review: 'IN_REVIEW',
    pending_release: 'PENDING_DEVELOPER_RELEASE',
    completed: 'READY_FOR_SALE',
    rejected: 'REJECTED',
  };
  return map[status];
}

function mapAppleReleaseStatus(state: string): string {
  switch (state) {
    case 'PREPARE_FOR_SUBMISSION': return 'draft';
    case 'WAITING_FOR_REVIEW':
    case 'IN_REVIEW': return 'in_review';
    case 'PENDING_DEVELOPER_RELEASE': return 'pending_release';
    case 'READY_FOR_SALE': return 'completed';
    case 'REJECTED': return 'rejected';
    default: return 'draft';
  }
}

function mapVitalMetricToApple(metric: VitalMetricType): string {
  const map: Record<string, string> = {
    crash_rate: 'CRASH_RATE',
    launch_time: 'LAUNCH',
    hang_rate: 'HANG',
    memory_usage: 'MEMORY',
    disk_usage: 'DISK',
    disk_writes: 'DISK_WRITES',
    battery_drain: 'BATTERY',
    scroll_hitch_rate: 'SCROLL_HITCH',
  };
  return map[metric] ?? metric.toUpperCase().replace(/_/g, '_');
}

function extractApplePerfMetric(data: any, key: string): any {
  if (!data?.data) {
    return { value: 0, unit: '%', status: 'good' as const, trend: 'stable' as const };
  }
  const match = (data.data ?? []).find(
    (d: any) => d.attributes?.metricType === key || d.type?.includes(key.toLowerCase()),
  );
  const value = match?.attributes?.value ?? 0;
  return {
    value: Number(value),
    unit: match?.attributes?.unit ?? '%',
    status: 'good' as const,
    trend: 'stable' as const,
  };
}
