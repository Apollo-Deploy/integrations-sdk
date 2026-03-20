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
import { BASE_URL } from "./_context.js";

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
      tokens: TokenSet,
      packageName: string,
      request: CreatePhasedReleaseRequest,
    ): Promise<PhasedRelease> {
      const [trackName, ...rest] = request.versionId.split(":");
      const versionCode = rest.join(":");
      if (!trackName || !versionCode) {
        throw new CapabilityError(
          "google-play",
          'versionId must be in "track:versionCode" format (e.g. "production:42").',
          false,
        );
      }

      const fraction = (request.rolloutPercentage ?? 1) / 100;

      return ctx.withEdit(
        tokens,
        packageName,
        async (editId) => {
          const current = await ctx
            .gpRequest(
              tokens,
              `${BASE_URL}/applications/${packageName}/edits/${editId}/tracks/${trackName}`,
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

          await ctx.gpRequest(
            tokens,
            `${BASE_URL}/applications/${packageName}/edits/${editId}/tracks/${trackName}`,
            {
              method: "PUT",
              body: JSON.stringify({ track: trackName, releases }),
            },
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
      tokens: TokenSet,
      packageName: string,
      versionId: string,
    ): Promise<PhasedRelease> {
      const [trackName, ...rest] = versionId.split(":");
      const versionCode = rest.join(":");
      if (!trackName || !versionCode) {
        throw new CapabilityError(
          "google-play",
          'versionId must be in "track:versionCode" format (e.g. "production:42").',
          false,
        );
      }

      return ctx.withEdit(tokens, packageName, async (editId) => {
        const data = await ctx.gpRequest(
          tokens,
          `${BASE_URL}/applications/${packageName}/edits/${editId}/tracks/${trackName}`,
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
      tokens: TokenSet,
      packageName: string,
      phasedReleaseId: string,
      update: UpdatePhasedReleaseRequest,
    ): Promise<PhasedRelease> {
      const [trackName, ...rest] = phasedReleaseId.split(":");
      const versionCode = rest.join(":");
      if (!trackName || !versionCode) {
        throw new CapabilityError(
          "google-play",
          'phasedReleaseId must be in "track:versionCode" format.',
          false,
        );
      }

      return ctx.withEdit(
        tokens,
        packageName,
        async (editId) => {
          const current = await ctx.gpRequest(
            tokens,
            `${BASE_URL}/applications/${packageName}/edits/${editId}/tracks/${trackName}`,
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

          await ctx.gpRequest(
            tokens,
            `${BASE_URL}/applications/${packageName}/edits/${editId}/tracks/${trackName}`,
            {
              method: "PUT",
              body: JSON.stringify({ track: trackName, releases }),
            },
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
      tokens: TokenSet,
      packageName: string,
      phasedReleaseId: string,
    ): Promise<void> {
      const [trackName, ...rest] = phasedReleaseId.split(":");
      const versionCode = rest.join(":");
      if (!trackName || !versionCode) {
        throw new CapabilityError(
          "google-play",
          'phasedReleaseId must be in "track:versionCode" format.',
          false,
        );
      }

      await ctx.withEdit(
        tokens,
        packageName,
        async (editId) => {
          const current = await ctx.gpRequest(
            tokens,
            `${BASE_URL}/applications/${packageName}/edits/${editId}/tracks/${trackName}`,
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

          await ctx.gpRequest(
            tokens,
            `${BASE_URL}/applications/${packageName}/edits/${editId}/tracks/${trackName}`,
            {
              method: "PUT",
              body: JSON.stringify({ track: trackName, releases }),
            },
          );
        },
        { commit: true },
      );
    },

    async createReleaseRequest(
      tokens: TokenSet,
      packageName: string,
      versionId: string,
    ): Promise<ReleaseRequest> {
      const [trackName, ...rest] = versionId.split(":");
      const versionCode = rest.join(":");
      if (!trackName || !versionCode) {
        throw new CapabilityError(
          "google-play",
          'versionId must be in "track:versionCode" format (e.g. "production:42").',
          false,
        );
      }

      await ctx.withEdit(
        tokens,
        packageName,
        async (editId) => {
          const current = await ctx.gpRequest(
            tokens,
            `${BASE_URL}/applications/${packageName}/edits/${editId}/tracks/${trackName}`,
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

          await ctx.gpRequest(
            tokens,
            `${BASE_URL}/applications/${packageName}/edits/${editId}/tracks/${trackName}`,
            {
              method: "PUT",
              body: JSON.stringify({ track: trackName, releases }),
            },
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
