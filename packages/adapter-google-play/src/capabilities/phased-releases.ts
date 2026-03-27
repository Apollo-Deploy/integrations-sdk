import type {
  AppStoreCapability,
  TokenSet,
  PhasedRelease,
  PhasedReleaseState,
  CreatePhasedReleaseRequest,
  UpdatePhasedReleaseRequest,
  ReleaseRequest,
} from "@apollo-deploy/integrations";
import { CapabilityError } from "@apollo-deploy/integrations";
import type { GooglePlayContext } from "./_context.js";

// ── Helpers ──────────────────────────────────────────────────────────────

function mapGooglePhasedReleaseStatus(gpStatus: string): PhasedReleaseState {
  switch (gpStatus) {
    case "inProgress":
      return "active";
    case "halted":
      return "paused";
    case "completed":
      return "complete";
    case "draft":
      return "inactive";
    default:
      return "inactive";
  }
}

// eslint-disable-next-line max-params -- implements interface; method signature is contractual
function mapGooglePhasedRelease(
  packageName: string,
  trackName: string,
  versionCode: string,
  release: Record<string, any>,
): PhasedRelease {
  const state = mapGooglePhasedReleaseStatus(release.status ?? "draft");
  const fraction = release.userFraction as number | undefined;

  return {
    id: `${trackName}:${versionCode}`,
    versionId: `${trackName}:${versionCode}`,
    state,
    rolloutPercentage:
      state === "complete"
        ? 100
        : fraction != null
          ? Math.round(fraction * 100)
          : 0,
  };
}

export function createGooglePlayPhasedReleases(
  ctx: GooglePlayContext,
): Pick<
  AppStoreCapability,
  | "createPhasedRelease"
  | "getPhasedRelease"
  | "updatePhasedRelease"
  | "deletePhasedRelease"
  | "createReleaseRequest"
> {
  return {
    async createPhasedRelease(
      _tokens: TokenSet,
      packageName: string,
      request: CreatePhasedReleaseRequest,
    ): Promise<PhasedRelease> {
      const { trackName, versionCode } = ctx.parseTrackVersionId(request.versionId);

      const fraction = (request.rolloutPercentage ?? 1) / 100;

      return ctx.withEdit(
        packageName,
        async (editId) => {
          const current = await ctx
            .publisherRequest(
              ctx.client.edits.tracks.get({ packageName, editId, track: trackName }),
            )
            .catch(() => ({ releases: [] }));

          const releases = (current.releases ?? []).map(
            (r: Record<string, any>) => {
              const codes = (r.versionCodes ?? []).map(String);
              if (codes.includes(versionCode)) {
                return { ...r, status: "inProgress", userFraction: fraction };
              }
              return r;
            },
          );

          const hasMatch = releases.some((r: Record<string, any>) =>
            (r.versionCodes ?? []).map(String).includes(versionCode),
          );
          if (!hasMatch) {
            releases.push({
              versionCodes: [versionCode],
              status: "inProgress",
              userFraction: fraction,
            });
          }

          await ctx.publisherRequest(
            ctx.client.edits.tracks.update({
              packageName,
              editId,
              track: trackName,
              requestBody: { track: trackName, releases },
            }),
          );

          return mapGooglePhasedRelease(packageName, trackName, versionCode, {
            status: "inProgress",
            userFraction: fraction,
            versionCodes: [versionCode],
          });
        },
        { commit: true },
      );
    },

    async getPhasedRelease(
      _tokens: TokenSet,
      packageName: string,
      versionId: string,
    ): Promise<PhasedRelease> {
      const { trackName, versionCode } = ctx.parseTrackVersionId(versionId);

      return ctx.withEdit(packageName, async (editId) => {
        const data = await ctx.publisherRequest(
          ctx.client.edits.tracks.get({ packageName, editId, track: trackName }),
        );

        const release = (data?.releases ?? []).find(
          (r: Record<string, any>) =>
            (r.versionCodes ?? []).map(String).includes(versionCode),
        );

        if (!release) {
          throw new CapabilityError(
            "google-play",
            `No release found for version ${versionCode} on track ${trackName}`,
            false,
          );
        }

        return mapGooglePhasedRelease(
          packageName,
          trackName,
          versionCode,
          release,
        );
      });
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async updatePhasedRelease(
      _tokens: TokenSet,
      packageName: string,
      phasedReleaseId: string,
      update: UpdatePhasedReleaseRequest,
    ): Promise<PhasedRelease> {
      const { trackName, versionCode } = ctx.parseTrackVersionId(phasedReleaseId);

      return ctx.withEdit(
        packageName,
        async (editId) => {
          const current = await ctx.publisherRequest(
            ctx.client.edits.tracks.get({ packageName, editId, track: trackName }),
          );

          let matchedRelease: Record<string, any> | null = null;
          const releases = (current.releases ?? []).map(
            (r: Record<string, any>) => {
              const codes = (r.versionCodes ?? []).map(String);
              if (!codes.includes(versionCode)) return r;

              const updated = { ...r };
              if (update.state === "paused") {
                updated.status = "halted";
              } else if (update.state === "active") {
                updated.status = "inProgress";
              } else if (update.state === "complete") {
                updated.status = "completed";
                delete updated.userFraction;
              }
              if (update.rolloutPercentage != null) {
                updated.userFraction = update.rolloutPercentage / 100;
                if (updated.status !== "halted") updated.status = "inProgress";
              }
              matchedRelease = updated;
              return updated;
            },
          );

          if (!matchedRelease) {
            throw new CapabilityError(
              "google-play",
              `No release found for version ${versionCode} on track ${trackName}`,
              false,
            );
          }

          await ctx.publisherRequest(
            ctx.client.edits.tracks.update({
              packageName,
              editId,
              track: trackName,
              requestBody: { track: trackName, releases },
            }),
          );

          return mapGooglePhasedRelease(
            packageName,
            trackName,
            versionCode,
            matchedRelease,
          );
        },
        { commit: true },
      );
    },

    async deletePhasedRelease(
      _tokens: TokenSet,
      packageName: string,
      phasedReleaseId: string,
    ): Promise<void> {
      const { trackName, versionCode } = ctx.parseTrackVersionId(phasedReleaseId);

      await ctx.withEdit(
        packageName,
        async (editId) => {
          const current = await ctx.publisherRequest(
            ctx.client.edits.tracks.get({ packageName, editId, track: trackName }),
          );

          const releases = (current.releases ?? []).map(
            (r: Record<string, any>) => {
              const codes = (r.versionCodes ?? []).map(String);
              if (codes.includes(versionCode) && r.status === "inProgress") {
                return { ...r, status: "halted" };
              }
              return r;
            },
          );

          await ctx.publisherRequest(
            ctx.client.edits.tracks.update({
              packageName,
              editId,
              track: trackName,
              requestBody: { track: trackName, releases },
            }),
          );
        },
        { commit: true },
      );
    },

    async createReleaseRequest(
      _tokens: TokenSet,
      packageName: string,
      versionId: string,
    ): Promise<ReleaseRequest> {
      const { trackName, versionCode } = ctx.parseTrackVersionId(versionId);

      await ctx.withEdit(
        packageName,
        async (editId) => {
          const current = await ctx.publisherRequest(
            ctx.client.edits.tracks.get({ packageName, editId, track: trackName }),
          );

          const releases = (current.releases ?? []).map(
            (r: Record<string, any>) => {
              const codes = (r.versionCodes ?? []).map(String);
              if (codes.includes(versionCode)) {
                const { userFraction: _dropped, ...rest } = r;
                return { ...rest, status: "completed" };
              }
              return r;
            },
          );

          await ctx.publisherRequest(
            ctx.client.edits.tracks.update({
              packageName,
              editId,
              track: trackName,
              requestBody: { track: trackName, releases },
            }),
          );
        },
        { commit: true },
      );

      return {
        id: `${trackName}:${versionCode}:release`,
        versionId,
        requestedAt: new Date(),
      };
    },
  };
}
