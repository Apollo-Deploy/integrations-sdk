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
} from "@apollo-deploy/integrations";
import { CapabilityError } from "@apollo-deploy/integrations";
import { mapGoogleRelease, mapGoogleTrack } from "../mappers/models.js";
import type { GooglePlayContext } from "./_context.js";
import { ALL_TRACKS } from "./_context.js";

export function createGooglePlayReleases(
  ctx: GooglePlayContext,
): Pick<
  AppStoreCapability,
  | "listReleases"
  | "getRelease"
  | "listTracks"
  | "getTrack"
  | "updateTrack"
  | "listVersions"
  | "getVersion"
  | "submitForReview"
  | "releaseToTrack"
  | "updateRollout"
  | "haltRelease"
> {
  const capability: ReturnType<typeof createGooglePlayReleases> = {
    // ── Release Management ──────────────────────────────────────────

    async listReleases(
      _tokens: TokenSet,
      packageName: string,
      opts?: ReleaseListOpts,
    ): Promise<Paginated<StoreRelease>> {
      const targetTracks = opts?.track ? [opts.track] : [...ALL_TRACKS];

      return ctx.withEdit(packageName, async (editId) => {
        const trackResults = await Promise.all(
          targetTracks.map(async (track) => {
            const data = await ctx
              .publisherRequest(
                ctx.client.edits.tracks.get({ packageName, editId, track }),
              )
              .catch(() => null);
            if (!data) return [];
            const releases: StoreRelease[] = [];
            for (const release of data?.releases ?? []) {
              const mapped = mapGoogleRelease(packageName, track, release);
              if (!opts?.status || mapped.status === opts.status) {
                releases.push(mapped);
              }
            }
            return releases;
          }),
        );

        return { items: trackResults.flat(), hasMore: false };
      });
    },

    async getRelease(
      tokens: TokenSet,
      packageName: string,
      releaseId: string,
    ): Promise<StoreRelease> {
      const { trackName } = ctx.parseTrackVersionId(releaseId);
      const result = await capability.listReleases(tokens, packageName, {
        track: trackName,
      });
      const match = result.items.find((r) => r.id === releaseId);
      if (!match) {
        throw new CapabilityError(
          "google-play",
          `Release ${releaseId} not found`,
          false,
        );
      }
      return match;
    },

    // ── Track / Version Management ──────────────────────────────────

    async listTracks(
      _tokens: TokenSet,
      packageName: string,
    ): Promise<StoreTrack[]> {
      return ctx.withEdit(packageName, async (editId) => {
        const data = await ctx.publisherRequest(
          ctx.client.edits.tracks.list({ packageName, editId }),
        );
        return (data?.tracks ?? []).map((t: Record<string, any>) =>
          mapGoogleTrack(packageName, t),
        );
      });
    },

    async getTrack(
      _tokens: TokenSet,
      packageName: string,
      trackId: string,
    ): Promise<StoreTrack> {
      const trackName = trackId.includes(":")
        ? (trackId.split(":")[1] ?? trackId)
        : trackId;
      const data = await ctx.withEdit(packageName, async (editId) => {
        return ctx.publisherRequest(
          ctx.client.edits.tracks.get({ packageName, editId, track: trackName }),
        );
      });
      return mapGoogleTrack(packageName, data);
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async updateTrack(
      _tokens: TokenSet,
      packageName: string,
      trackId: string,
      update: TrackUpdateRequest,
    ): Promise<StoreTrack> {
      const trackName = trackId.includes(":")
        ? (trackId.split(":")[1] ?? trackId)
        : trackId;
      return ctx.withEdit(
        packageName,
        async (editId) => {
          const current = await ctx.publisherRequest(
            ctx.client.edits.tracks.get({ packageName, editId, track: trackName }),
          );

          const releases = current.releases ?? [];

          if (update.rolloutPercentage !== undefined) {
            for (const r of releases) {
              if (r.status === "inProgress") {
                r.userFraction = update.rolloutPercentage / 100;
              }
            }
          }
          if (update.halt) {
            for (const r of releases) r.status = "halted";
          } else if (update.resume) {
            for (const r of releases) {
              if (r.status === "halted") r.status = "inProgress";
            }
          } else if (update.completeRollout) {
            for (const r of releases) {
              delete r.userFraction;
              r.status = "completed";
            }
          }

          const updated = await ctx.publisherRequest(
            ctx.client.edits.tracks.update({
              packageName,
              editId,
              track: trackName,
              requestBody: { track: trackName, releases },
            }),
          );

          return mapGoogleTrack(packageName, updated);
        },
        { commit: true },
      );
    },

    async listVersions(
      tokens: TokenSet,
      packageName: string,
    ): Promise<StoreVersion[]> {
      const releases = await capability.listReleases(tokens, packageName);
      return releases.items.map(
        (r): StoreVersion => ({
          id: r.id,
          appId: packageName,
          versionString: r.version,
          state: r.status,
          platform: "android",
          createdAt: r.createdAt,
        }),
      );
    },

    async getVersion(
      tokens: TokenSet,
      packageName: string,
      versionId: string,
    ): Promise<StoreVersion> {
      const versions = await capability.listVersions(tokens, packageName);
      const match = versions.find((v) => v.id === versionId);
      if (!match) {
        throw new CapabilityError(
          "google-play",
          `Version ${versionId} not found`,
          false,
        );
      }
      return match;
    },

    // ── Publishing ──────────────────────────────────────────────────

    async submitForReview(
      _tokens: TokenSet,
      packageName: string,
      _req: SubmitForReviewRequest,
    ): Promise<PublishResult> {
      const targetTrack = "production";
      return ctx.withEdit(
        packageName,
        async (editId) => {
          const current = await ctx
            .publisherRequest(
              ctx.client.edits.tracks.get({
                packageName,
                editId,
                track: targetTrack,
              }),
            )
            .catch(() => ({ releases: [] }));

          const releases = (current.releases ?? []).map(
            (r: Record<string, any>) =>
              r.status === "draft" ? { ...r, status: "completed" } : r,
          );

          await ctx.publisherRequest(
            ctx.client.edits.tracks.update({
              packageName,
              editId,
              track: targetTrack,
              requestBody: { track: targetTrack, releases },
            }),
          );

          return {
            success: true,
            releaseId: `${targetTrack}:submitted`,
            status: "in_review",
          };
        },
        { commit: true },
      );
    },

    async releaseToTrack(
      _tokens: TokenSet,
      packageName: string,
      req: ReleaseToTrackRequest,
    ): Promise<PublishResult> {
      return ctx.withEdit(
        packageName,
        async (editId) => {
          const userFraction =
            req.rolloutPercentage != null
              ? req.rolloutPercentage / 100
              : undefined;

          const release: Record<string, any> = {
            name: req.buildId,
            status:
              userFraction != null && userFraction < 1
                ? "inProgress"
                : "completed",
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

          await ctx.publisherRequest(
            ctx.client.edits.tracks.update({
              packageName,
              editId,
              track: req.track,
              requestBody: { track: req.track, releases: [release] },
            }),
          );

          return {
            success: true,
            releaseId: `${req.track}:${req.buildId}`,
            status:
              release.status === "inProgress" ? "rolling_out" : "completed",
          };
        },
        { commit: true },
      );
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async updateRollout(
      _tokens: TokenSet,
      packageName: string,
      releaseId: string,
      update: RolloutUpdateRequest,
    ): Promise<StoreRelease> {
      const { trackName: targetTrack } = ctx.parseTrackVersionId(releaseId);
      return ctx.withEdit(
        packageName,
        async (editId) => {
          const current = await ctx.publisherRequest(
            ctx.client.edits.tracks.get({
              packageName,
              editId,
              track: targetTrack,
            }),
          );

          const releases = (current.releases ?? []).map(
            (r: Record<string, any>) => {
              if (r.status !== "inProgress") return r;
              if (update.pause) return { ...r, status: "halted" };
              if (update.resume) return { ...r, status: "inProgress" };
              if (update.completeRollout) {
                const { userFraction: _dropped, ...rest } = r;
                return { ...rest, status: "completed" };
              }
              if (update.rolloutPercentage != null) {
                return { ...r, userFraction: update.rolloutPercentage / 100 };
              }
              return r;
            },
          );

          await ctx.publisherRequest(
            ctx.client.edits.tracks.update({
              packageName,
              editId,
              track: targetTrack,
              requestBody: { track: targetTrack, releases },
            }),
          );

          const updatedRelease =
            releases.find(
              (r: Record<string, any>) => r.versionCodes?.[0] != null,
            ) ?? releases[0];
          return mapGoogleRelease(
            packageName,
            targetTrack,
            updatedRelease ?? {},
          );
        },
        { commit: true },
      );
    },

    async haltRelease(
      tokens: TokenSet,
      packageName: string,
      releaseId: string,
      _reason?: string,
    ): Promise<StoreRelease> {
      return capability.updateRollout(tokens, packageName, releaseId, {
        pause: true,
      });
    },
  };

  return capability;
}
