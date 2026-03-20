import type { AppStoreCapability } from "@apollo-deploy/integrations";
import { mapAppleBetaGroup, mapAppleBetaTester } from "../mappers/models.js";
import type {
  AppleContext,
  AppleListResponse,
  AppleSingleResponse,
} from "./_context.js";

export function createAppleBeta(
  ctx: AppleContext,
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
  return {
    async listBetaGroups(tokens, appId) {
      const params = new URLSearchParams({ "filter[app]": appId });
      const data = await ctx.appleRequest<AppleListResponse>(
        tokens,
        `/betaGroups?${String(params)}`,
      );
      return data.data.map(mapAppleBetaGroup);
    },

    async getBetaGroup(tokens, _appId, groupId) {
      const data = await ctx.appleRequest<AppleSingleResponse>(
        tokens,
        `/betaGroups/${groupId}?include=betaTesters`,
      );
      return mapAppleBetaGroup(data.data);
    },

    async createBetaGroup(tokens, appId, input) {
      const result = await ctx.appleRequest<AppleSingleResponse>(
        tokens,
        "/betaGroups",
        {
          method: "POST",
          body: JSON.stringify({
            data: {
              type: "betaGroups",
              attributes: {
                name: input.name,
                isInternalGroup: input.isInternal,
                hasAccessToAllBuilds: false,
                publicLinkEnabled: input.publicLinkEnabled ?? false,
                publicLinkLimit: input.testerLimit,
              },
              relationships: {
                app: { data: { type: "apps", id: appId } },
              },
            },
          }),
        },
      );
      return mapAppleBetaGroup(result.data);
    },

    async deleteBetaGroup(tokens, _appId, groupId) {
      await ctx.appleRequest(tokens, `/betaGroups/${groupId}`, {
        method: "DELETE",
      });
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async listBetaTesters(tokens, _appId, groupId, opts) {
      const params = new URLSearchParams({ limit: String(opts?.limit ?? 20) });
      if (opts?.cursor != null && opts.cursor !== "")
        params.set("cursor", opts.cursor);

      const data = await ctx.appleRequest<AppleListResponse>(
        tokens,
        `/betaGroups/${groupId}/betaTesters?${String(params)}`,
      );
      return {
        items: data.data.map(mapAppleBetaTester),
        hasMore: data.links?.next != null && data.links.next !== "",
        cursor: ctx.extractCursor(data.links?.next),
      };
    },

    async addBetaTesters(tokens, groupId, testers) {
      for (const tester of testers) {
        await ctx.appleRequest(tokens, "/betaTesters", {
          method: "POST",
          body: JSON.stringify({
            data: {
              type: "betaTesters",
              attributes: {
                email: tester.email,
                firstName: tester.firstName,
                lastName: tester.lastName,
              },
              relationships: {
                betaGroups: { data: [{ type: "betaGroups", id: groupId }] },
              },
            },
          }),
        });
      }
    },

    async removeBetaTesters(tokens, groupId, testerIds) {
      await ctx.appleRequest(
        tokens,
        `/betaGroups/${groupId}/relationships/betaTesters`,
        {
          method: "DELETE",
          body: JSON.stringify({
            data: testerIds.map((id) => ({ type: "betaTesters", id })),
          }),
        },
      );
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async assignBuildToBetaGroup(tokens, _appId, groupId, buildId) {
      await ctx.appleRequest(
        tokens,
        `/betaGroups/${groupId}/relationships/builds`,
        {
          method: "POST",
          body: JSON.stringify({ data: [{ type: "builds", id: buildId }] }),
        },
      );
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async removeBuildFromBetaGroup(tokens, _appId, groupId, buildId) {
      await ctx.appleRequest(
        tokens,
        `/betaGroups/${groupId}/relationships/builds`,
        {
          method: "DELETE",
          body: JSON.stringify({ data: [{ type: "builds", id: buildId }] }),
        },
      );
    },
  };
}
