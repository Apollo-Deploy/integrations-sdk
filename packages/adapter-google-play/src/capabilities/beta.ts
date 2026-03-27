import type {
  AppStoreCapability,
  TokenSet,
  Paginated,
  PaginationOpts,
  BetaGroup,
  BetaTester,
  BetaTesterInput,
  CreateBetaGroupInput,
} from "@apollo-deploy/integrations";
import { CapabilityError } from "@apollo-deploy/integrations";
import { mapGoogleBetaGroup, mapGoogleBetaTester } from "../mappers/models.js";
import type { GooglePlayContext } from "./_context.js";

export function createGooglePlayBeta(
  ctx: GooglePlayContext,
): Pick<
  AppStoreCapability,
  | "listBetaGroups"
  | "getBetaGroup"
  | "createBetaGroup"
  | "deleteBetaGroup"
  | "listBetaTesters"
  | "addBetaTesters"
  | "removeBetaTesters"
  | "assignBuildToBetaGroup"
  | "removeBuildFromBetaGroup"
> {
  // We need a reference to releaseToTrack — it's passed in via the composed capability.
  // Instead of circular deps, assignBuildToBetaGroup reimplements a minimal version.
  const capability: ReturnType<typeof createGooglePlayBeta> = {
    async listBetaGroups(
      _tokens: TokenSet,
      packageName: string,
    ): Promise<BetaGroup[]> {
      return Promise.resolve(
        ["internal", "alpha", "beta"].map((t) =>
          mapGoogleBetaGroup(packageName, t),
        ),
      );
    },

    async getBetaGroup(
      tokens: TokenSet,
      packageName: string,
      groupId: string,
    ): Promise<BetaGroup> {
      const groups = await capability.listBetaGroups(tokens, packageName);
      const match = groups.find((g) => g.id === groupId);
      if (!match) {
        throw new CapabilityError(
          "google-play",
          `Beta group ${groupId} not found`,
          false,
        );
      }
      return match;
    },

    async createBetaGroup(
      _tokens: TokenSet,
      _packageName: string,
      _input: CreateBetaGroupInput,
    ): Promise<BetaGroup> {
      throw new CapabilityError(
        "google-play",
        "Google Play uses fixed tracks and does not support creating custom beta groups.",
        false,
      );
    },

    async deleteBetaGroup(
      _tokens: TokenSet,
      _packageName: string,
      _groupId: string,
    ): Promise<void> {
      throw new CapabilityError(
        "google-play",
        "Google Play uses fixed tracks and does not support deleting beta groups.",
        false,
      );
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async listBetaTesters(
      _tokens: TokenSet,
      packageName: string,
      groupId: string,
      _opts?: PaginationOpts,
    ): Promise<Paginated<BetaTester>> {
      const trackName = groupId.includes(":")
        ? (groupId.split(":")[1] ?? groupId)
        : groupId;
      const data = await ctx.withEdit(packageName, async (editId) =>
        ctx
          .publisherRequest(
            ctx.client.edits.testers.get({
              packageName,
              editId,
              track: trackName,
            }),
          )
          .catch(() => ({ googleGroups: [] })),
      );
      const groups = (data?.googleGroups ?? []) as string[];
      return { items: groups.map(mapGoogleBetaTester), hasMore: false };
    },

    async addBetaTesters(
      _tokens: TokenSet,
      groupId: string,
      testers: BetaTesterInput[],
    ): Promise<void> {
      if (!groupId.includes(":")) {
        throw new CapabilityError(
          "google-play",
          `Expected groupId format "packageName:track" (e.g. "com.example.app:beta"), got "${groupId}".`,
          false,
        );
      }
      const colonIdx = groupId.indexOf(":");
      const packageName = groupId.slice(0, colonIdx);
      const trackName = groupId.slice(colonIdx + 1);

      await ctx.withEdit(
        packageName,
        async (editId) => {
          const current = await ctx
            .publisherRequest(
              ctx.client.edits.testers.get({
                packageName,
                editId,
                track: trackName,
              }),
            )
            .catch(() => ({ googleGroups: [] }));
          const existing = (current?.googleGroups ?? []) as string[];
          const merged = [
            ...new Set([...existing, ...testers.map((t) => t.email)]),
          ];
          await ctx.publisherRequest(
            ctx.client.edits.testers.update({
              packageName,
              editId,
              track: trackName,
              requestBody: { googleGroups: merged },
            }),
          );
        },
        { commit: true },
      );
    },

    async removeBetaTesters(
      _tokens: TokenSet,
      groupId: string,
      testerIds: string[],
    ): Promise<void> {
      if (!groupId.includes(":")) {
        throw new CapabilityError(
          "google-play",
          `Expected groupId format "packageName:track" (e.g. "com.example.app:beta"), got "${groupId}".`,
          false,
        );
      }
      const colonIdx = groupId.indexOf(":");
      const packageName = groupId.slice(0, colonIdx);
      const trackName = groupId.slice(colonIdx + 1);

      await ctx.withEdit(
        packageName,
        async (editId) => {
          const current = await ctx
            .publisherRequest(
              ctx.client.edits.testers.get({
                packageName,
                editId,
                track: trackName,
              }),
            )
            .catch(() => ({ googleGroups: [] }));
          const existing = (current?.googleGroups ?? []) as string[];
          const filtered = existing.filter((e) => !testerIds.includes(e));
          await ctx.publisherRequest(
            ctx.client.edits.testers.update({
              packageName,
              editId,
              track: trackName,
              requestBody: { googleGroups: filtered },
            }),
          );
        },
        { commit: true },
      );
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async assignBuildToBetaGroup(
      _tokens: TokenSet,
      packageName: string,
      groupId: string,
      buildId: string,
    ): Promise<void> {
      const trackName = groupId.includes(":")
        ? (groupId.split(":")[1] ?? groupId)
        : groupId;

      // Minimal releaseToTrack implementation to avoid circular deps
      await ctx.withEdit(
        packageName,
        async (editId) => {
          const release: Record<string, unknown> = {
            name: buildId,
            status: "completed",
            versionCodes: [buildId],
          };

          await ctx.publisherRequest(
            ctx.client.edits.tracks.update({
              packageName,
              editId,
              track: trackName,
              requestBody: { track: trackName, releases: [release] },
            }),
          );
        },
        { commit: true },
      );
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async removeBuildFromBetaGroup(
      _tokens: TokenSet,
      _packageName: string,
      _groupId: string,
      _buildId: string,
    ): Promise<void> {
      throw new CapabilityError(
        "google-play",
        "Removing a specific build from a Google Play track is not directly supported. Use releaseToTrack with a different version.",
        false,
      );
    },
  };

  return capability;
}
