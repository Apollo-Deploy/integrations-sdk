import type {
  AppStoreCapability,
  StoreTrack,
} from "@apollo-deploy/integrations";
import { CapabilityError } from "@apollo-deploy/integrations";
import { mapAppleRelease, mapAppleVersion } from "../mappers/models.js";
import type { AppleContext } from "./_context.js";

// ── Helpers ────────────────────────────────────────────────────────────

function mapReleaseStatusToAppleState(status: string): string | undefined {
  const map: Record<string, string> = {
    draft: "PREPARE_FOR_SUBMISSION",
    in_review: "IN_REVIEW",
    pending_release: "PENDING_DEVELOPER_RELEASE",
    completed: "READY_FOR_SALE",
    rejected: "REJECTED",
  };
  return map[status];
}

function mapAppleReleaseStatus(state: string): string {
  switch (state) {
    case "PREPARE_FOR_SUBMISSION":
      return "draft";
    case "WAITING_FOR_REVIEW":
    case "IN_REVIEW":
      return "in_review";
    case "PENDING_DEVELOPER_RELEASE":
      return "pending_release";
    case "READY_FOR_SALE":
      return "completed";
    case "REJECTED":
      return "rejected";
    default:
      return "draft";
  }
}

export function createAppleReleases(
  ctx: AppleContext,
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
  const capability: ReturnType<typeof createAppleReleases> = {
    // ── Releases ────────────────────────────────────────────────────

    async listReleases(tokens, appId, opts) {
      const params = new URLSearchParams({
        "filter[app]": appId,
        limit: String(opts?.limit ?? 20),
      });
      if (opts?.cursor) params.set("cursor", opts.cursor);
      if (opts?.status) {
        const appleState = mapReleaseStatusToAppleState(opts.status);
        if (appleState) params.set("filter[appStoreState]", appleState);
      }

      const data = await ctx.appleRequest(
        tokens,
        `/appStoreVersions?${params}`,
      );
      return {
        items: data.data.map(mapAppleRelease),
        hasMore: !!data.links?.next,
        cursor: ctx.extractCursor(data.links?.next),
      };
    },

    async getRelease(tokens, _appId, releaseId) {
      const data = await ctx.appleRequest(
        tokens,
        `/appStoreVersions/${releaseId}?include=appStoreVersionPhasedRelease`,
      );
      return mapAppleRelease(data.data);
    },

    // ── Tracks & Versions ───────────────────────────────────────────

    async listTracks(tokens, appId) {
      const [versions, betaData] = await Promise.all([
        ctx.appleRequest(
          tokens,
          `/appStoreVersions?filter[app]=${appId}&limit=1&sort=-createdDate`,
        ),
        ctx
          .appleRequest(
            tokens,
            `/preReleaseVersions?filter[app]=${appId}&limit=1`,
          )
          .catch(() => ({ data: [] })),
      ]);

      const tracks: StoreTrack[] = [
        {
          id: "app_store",
          appId,
          name: "App Store",
          type: "production",
          releases: (versions.data ?? []).map((v: Record<string, any>) => ({
            version: v.attributes.versionString,
            versionCodes: [v.id],
            status: mapAppleReleaseStatus(v.attributes.appStoreState) as any,
            releaseNotes: [],
          })),
        },
        {
          id: "testflight",
          appId,
          name: "TestFlight",
          type: "beta",
          releases: (betaData.data ?? []).map((v: Record<string, any>) => ({
            version: v.attributes.version,
            versionCodes: [v.id],
            status: "draft" as const,
            releaseNotes: [],
          })),
        },
      ];

      return tracks;
    },

    async getTrack(tokens, appId, trackId) {
      const tracks = await capability.listTracks(tokens, appId);
      const match = tracks.find((t) => t.id === trackId);
      if (!match)
        throw new CapabilityError("apple", `Track ${trackId} not found`, false);
      return match;
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async updateTrack(tokens, appId, trackId, update) {
      if (trackId === "app_store") {
        const versions = await ctx.appleRequest(
          tokens,
          `/appStoreVersions?filter[app]=${appId}&limit=1&sort=-createdDate`,
        );
        const versionId = versions.data[0]?.id as string | undefined;
        if (!versionId)
          throw new CapabilityError(
            "apple",
            "No App Store Version found",
            false,
          );

        const withPhased = await ctx.appleRequest(
          tokens,
          `/appStoreVersions/${versionId}?include=appStoreVersionPhasedRelease`,
        );
        const phasedReleaseId = withPhased.included?.[0]?.id as
          | string
          | undefined;

        if (update.completeRollout && phasedReleaseId) {
          await ctx.appleRequest(
            tokens,
            `/appStoreVersionPhasedReleases/${phasedReleaseId}`,
            {
              method: "PATCH",
              body: JSON.stringify({
                data: {
                  type: "appStoreVersionPhasedReleases",
                  id: phasedReleaseId,
                  attributes: { phasedReleaseState: "COMPLETE" },
                },
              }),
            },
          );
        } else if (update.halt && phasedReleaseId) {
          await ctx.appleRequest(
            tokens,
            `/appStoreVersionPhasedReleases/${phasedReleaseId}`,
            {
              method: "PATCH",
              body: JSON.stringify({
                data: {
                  type: "appStoreVersionPhasedReleases",
                  id: phasedReleaseId,
                  attributes: { phasedReleaseState: "PAUSED" },
                },
              }),
            },
          );
        } else if (update.resume && phasedReleaseId) {
          await ctx.appleRequest(
            tokens,
            `/appStoreVersionPhasedReleases/${phasedReleaseId}`,
            {
              method: "PATCH",
              body: JSON.stringify({
                data: {
                  type: "appStoreVersionPhasedReleases",
                  id: phasedReleaseId,
                  attributes: { phasedReleaseState: "ACTIVE" },
                },
              }),
            },
          );
        }
      }

      return capability.getTrack(tokens, appId, trackId);
    },

    async listVersions(tokens, appId) {
      const params = new URLSearchParams({ "filter[app]": appId });
      const data = await ctx.appleRequest(
        tokens,
        `/appStoreVersions?${params}`,
      );
      return data.data.map(mapAppleVersion);
    },

    async getVersion(tokens, _appId, versionId) {
      const data = await ctx.appleRequest(
        tokens,
        `/appStoreVersions/${versionId}`,
      );
      return mapAppleVersion(data.data);
    },

    // ── Publishing ──────────────────────────────────────────────────

    async submitForReview(tokens, _appId, request) {
      await ctx.appleRequest(tokens, "/appStoreVersionSubmissions", {
        method: "POST",
        body: JSON.stringify({
          data: {
            type: "appStoreVersionSubmissions",
            relationships: {
              appStoreVersion: {
                data: { type: "appStoreVersions", id: request.versionId },
              },
            },
          },
        }),
      });

      if (request.phasedRelease) {
        await ctx
          .appleRequest(tokens, "/appStoreVersionPhasedReleases", {
            method: "POST",
            body: JSON.stringify({
              data: {
                type: "appStoreVersionPhasedReleases",
                attributes: { phasedReleaseState: "INACTIVE" },
                relationships: {
                  appStoreVersion: {
                    data: { type: "appStoreVersions", id: request.versionId },
                  },
                },
              },
            }),
          })
          .catch(() => {
            // May already exist; non-fatal
          });
      }

      return {
        success: true,
        status: "in_review" as const,
        message: "Submitted for App Review",
        releaseId: request.versionId,
      };
    },

    async releaseToTrack(tokens, _appId, request) {
      await ctx.appleRequest(tokens, `/appStoreVersions/${request.buildId}`, {
        method: "PATCH",
        body: JSON.stringify({
          data: {
            type: "appStoreVersions",
            id: request.buildId,
            attributes: { releaseType: "MANUAL" },
          },
        }),
      });

      return {
        success: true,
        status: "completed" as const,
        message: "Released to App Store",
        releaseId: request.buildId,
      };
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async updateRollout(tokens, _appId, releaseId, update) {
      const versionData = await ctx.appleRequest(
        tokens,
        `/appStoreVersions/${releaseId}?include=appStoreVersionPhasedRelease`,
      );
      const phasedRelease = (versionData.included ?? []).find(
        (r: Record<string, unknown>) =>
          r.type === "appStoreVersionPhasedReleases",
      );

      if (!phasedRelease) {
        throw new CapabilityError(
          "apple",
          "No phased release found for this version",
          false,
        );
      }

      let newState: string;
      if (update.completeRollout) newState = "COMPLETE";
      else if (update.pause) newState = "PAUSED";
      else if (update.resume) newState = "ACTIVE";
      else
        throw new CapabilityError(
          "apple",
          "Must specify completeRollout, pause, or resume",
          false,
        );

      await ctx.appleRequest(
        tokens,
        `/appStoreVersionPhasedReleases/${phasedRelease.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            data: {
              type: "appStoreVersionPhasedReleases",
              id: phasedRelease.id,
              attributes: { phasedReleaseState: newState },
            },
          }),
        },
      );

      return capability.getRelease(tokens, "", releaseId);
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async haltRelease(tokens, appId, releaseId, _reason) {
      return capability.updateRollout(tokens, appId, releaseId, {
        pause: true,
      });
    },
  };

  return capability;
}
