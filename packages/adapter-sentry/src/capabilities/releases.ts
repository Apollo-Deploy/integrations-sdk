import type { MonitoringCapability } from "@apollo-deploy/integrations";
import type {
  MonitoringCreateReleaseInput,
  CreateDeployInput,
  ReleaseWindowComparison,
  CompareReleaseWindowsOpts,
} from "@apollo-deploy/integrations";
import { assertOk, mapSentryError } from "../mappers/errors.js";
import { mapRelease, mapDeploy } from "../mappers/models.js";
import type { SentryContext } from "./_context.js";

export function createSentryReleases(
  ctx: SentryContext,
): Pick<
  MonitoringCapability,
  | "listReleases"
  | "getRelease"
  | "createRelease"
  | "updateRelease"
  | "deleteRelease"
  | "listDeploys"
  | "createDeploy"
  | "compareReleaseWindows"
> {
  return {
    async listReleases(tokens, orgSlug, opts = {}) {
      try {
        const resp = await ctx.get(
          tokens,
          `/organizations/${orgSlug}/releases/`,
          {
            project: opts.projectSlug,
            environment: opts.environment,
            query: opts.query,
            per_page: opts.limit ?? 25,
            cursor: opts.cursor,
            summaryStatsPeriod: opts.summaryStatsPeriod,
          },
        );
        await assertOk(resp, "listReleases");
        return await ctx.paginate(resp, mapRelease);
      } catch (err) {
        throw mapSentryError(err);
      }
    },

    async getRelease(tokens, orgSlug, version) {
      try {
        const resp = await ctx.get(
          tokens,
          `/organizations/${orgSlug}/releases/${encodeURIComponent(version)}/`,
        );
        await assertOk(resp, "getRelease");
        return mapRelease((await resp.json()) as Record<string, unknown>);
      } catch (err) {
        throw mapSentryError(err);
      }
    },

    async createRelease(tokens, orgSlug, input: MonitoringCreateReleaseInput) {
      try {
        const resp = await ctx.post(
          tokens,
          `/organizations/${orgSlug}/releases/`,
          input,
        );
        await assertOk(resp, "createRelease");
        return mapRelease((await resp.json()) as Record<string, unknown>);
      } catch (err) {
        throw mapSentryError(err);
      }
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async updateRelease(tokens, orgSlug, version, input) {
      try {
        const resp = await ctx.put(
          tokens,
          `/organizations/${orgSlug}/releases/${encodeURIComponent(version)}/`,
          input,
        );
        await assertOk(resp, "updateRelease");
        return mapRelease((await resp.json()) as Record<string, unknown>);
      } catch (err) {
        throw mapSentryError(err);
      }
    },

    async deleteRelease(tokens, orgSlug, version) {
      try {
        const resp = await ctx.del(
          tokens,
          `/organizations/${orgSlug}/releases/${encodeURIComponent(version)}/`,
        );
        await assertOk(resp, "deleteRelease");
      } catch (err) {
        throw mapSentryError(err);
      }
    },

    async listDeploys(tokens, orgSlug, version) {
      try {
        const resp = await ctx.get(
          tokens,
          `/organizations/${orgSlug}/releases/${encodeURIComponent(version)}/deploys/`,
        );
        await assertOk(resp, "listDeploys");
        const data = (await resp.json()) as Record<string, unknown>[];
        return data.map(mapDeploy);
      } catch (err) {
        throw mapSentryError(err);
      }
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async createDeploy(tokens, orgSlug, version, input: CreateDeployInput) {
      try {
        const resp = await ctx.post(
          tokens,
          `/organizations/${orgSlug}/releases/${encodeURIComponent(version)}/deploys/`,
          input,
        );
        await assertOk(resp, "createDeploy");
        return mapDeploy((await resp.json()) as Record<string, unknown>);
      } catch (err) {
        throw mapSentryError(err);
      }
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async compareReleaseWindows(
      tokens,
      orgSlug,
      base,
      head,
      opts?: CompareReleaseWindowsOpts,
    ): Promise<ReleaseWindowComparison> {
      try {
        const qs = new URLSearchParams();
        if (opts?.environment) qs.set("environment", opts.environment);
        if (opts?.project) qs.set("project", opts.project);

        const [baseResp, headResp] = await Promise.all([
          ctx.get(
            tokens,
            `/organizations/${orgSlug}/releases/${encodeURIComponent(base)}/commits/?${qs.toString()}`,
          ),
          ctx.get(
            tokens,
            `/organizations/${orgSlug}/releases/${encodeURIComponent(head)}/commits/?${qs.toString()}`,
          ),
        ]);

        await assertOk(baseResp, "compareReleaseWindows (base)");
        await assertOk(headResp, "compareReleaseWindows (head)");

        const baseCommitIds = ((await baseResp.json()) as { id: string }[]).map(
          (c) => c.id,
        );
        const headCommitIds = ((await headResp.json()) as { id: string }[]).map(
          (c) => c.id,
        );

        const baseSet = new Set<string>(baseCommitIds);
        const headSet = new Set<string>(headCommitIds);

        const aheadBy = headCommitIds.filter((id) => !baseSet.has(id)).length;
        const behindBy = baseCommitIds.filter((id) => !headSet.has(id)).length;

        let status: ReleaseWindowComparison["status"];
        if (aheadBy === 0 && behindBy === 0) status = "identical";
        else if (aheadBy > 0 && behindBy === 0) status = "ahead";
        else if (aheadBy === 0 && behindBy > 0) status = "behind";
        else status = "diverged";

        return {
          base: { ref: base },
          head: { ref: head },
          status,
          aheadBy,
          behindBy,
        };
      } catch (err) {
        throw mapSentryError(err);
      }
    },
  };
}
