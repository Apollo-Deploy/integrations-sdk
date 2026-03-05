import type {
  AppStoreCapability,
  TokenSet,
  Paginated,
  StoreRelease,
  StoreTrack,
  StoreVersion,
  TrackUpdateRequest,
  SubmitForReviewRequest,
  ReleaseToTrackRequest,
  RolloutUpdateRequest,
  PublishResult,
  ReleaseListOpts,
} from '@apollo-deploy/integrations';
import { CapabilityError } from '@apollo-deploy/integrations';
import { mapGoogleRelease, mapGoogleTrack } from '../mappers/models.js';
import type { GooglePlayContext } from './_context.js';
import { BASE_URL, ALL_TRACKS } from './_context.js';

export function createGooglePlayReleases(
  ctx: GooglePlayContext,
): Pick<
  AppStoreCapability,
  | 'listReleases' | 'getRelease'
  | 'listTracks' | 'getTrack' | 'updateTrack'
  | 'listVersions' | 'getVersion'
  | 'submitForReview' | 'releaseToTrack' | 'updateRollout' | 'haltRelease'
> {
  const capability: ReturnType<typeof createGooglePlayReleases> = {
    // ── Release Management ──────────────────────────────────────────

    async listReleases(
      tokens: TokenSet,
      packageName: string,
      opts?: ReleaseListOpts,
    ): Promise<Paginated<StoreRelease>> {
      const targetTracks = opts?.track ? [opts.track] : [...ALL_TRACKS];

      return ctx.withEdit(tokens, packageName, async (editId) => {
        const allReleases: StoreRelease[] = [];

        await Promise.allSettled(
          targetTracks.map(async (track) => {
            const data = await ctx.gpRequest(
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
      const result = await capability.listReleases(tokens, packageName, { track });
      const match = result.items.find((r) => r.id === releaseId);
      if (!match) {
        throw new CapabilityError('google-play', `Release ${releaseId} not found`, false);
      }
      return match;
    },

    // ── Track / Version Management ──────────────────────────────────

    async listTracks(
      tokens: TokenSet,
      packageName: string,
    ): Promise<StoreTrack[]> {
      return ctx.withEdit(tokens, packageName, async (editId) => {
        const data = await ctx.gpRequest(
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
      const data = await ctx.withEdit(tokens, packageName, async (editId) => {
        return ctx.gpRequest<any>(
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
      return ctx.withEdit(tokens, packageName, async (editId) => {
        const current = await ctx.gpRequest<any>(
          tokens,
          `${BASE_URL}/applications/${packageName}/edits/${editId}/tracks/${trackName}`,
        );

        const releases = current.releases ?? [];

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

        const updated = await ctx.gpRequest<any>(
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
      const releases = await capability.listReleases(tokens, packageName);
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
      const versions = await capability.listVersions(tokens, packageName);
      const match = versions.find((v) => v.id === versionId);
      if (!match) {
        throw new CapabilityError('google-play', `Version ${versionId} not found`, false);
      }
      return match;
    },

    // ── Publishing ──────────────────────────────────────────────────

    async submitForReview(
      tokens: TokenSet,
      packageName: string,
      _req: SubmitForReviewRequest,
    ): Promise<PublishResult> {
      const targetTrack = 'production';
      return ctx.withEdit(tokens, packageName, async (editId) => {
        const current = await ctx.gpRequest<any>(
          tokens,
          `${BASE_URL}/applications/${packageName}/edits/${editId}/tracks/${targetTrack}`,
        ).catch(() => ({ releases: [] }));

        const releases = (current.releases ?? []).map((r: any) =>
          r.status === 'draft' ? { ...r, status: 'completed' } : r,
        );

        await ctx.gpRequest(
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
      return ctx.withEdit(tokens, packageName, async (editId) => {
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

        await ctx.gpRequest(
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
      return ctx.withEdit(tokens, packageName, async (editId) => {
        const current = await ctx.gpRequest<any>(
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

        await ctx.gpRequest(
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
      return capability.updateRollout(tokens, packageName, releaseId, { pause: true });
    },
  };

  return capability;
}
