import type { Paginated } from "@apollo-deploy/integrations";
import { assertOk, mapSentryError } from "../mappers/errors.js";
import { mapDsnKey, mapDebugFile } from "../mappers/models.js";
import type {
  SentryMonitoringCapability,
  SentryDsnKey,
  SentryStats,
  SentryStatsQueryOpts,
  SentryDebugFile,
} from "../types.js";
import type { SentryContext } from "./_context.js";

type SentryExtras = Pick<
  SentryMonitoringCapability,
  | "listDsnKeys"
  | "createDsnKey"
  | "getStats"
  | "listDebugFiles"
  | "deleteDebugFile"
>;

export function createSentryExtras(ctx: SentryContext): SentryExtras {
  return {
    async listDsnKeys(tokens, orgSlug, projectSlug): Promise<SentryDsnKey[]> {
      try {
        const resp = await ctx.get(
          tokens,
          `/projects/${orgSlug}/${projectSlug}/keys/`,
        );
        await assertOk(resp, "listDsnKeys");
        const data = (await resp.json()) as Record<string, unknown>[];
        return data.map(mapDsnKey);
      } catch (err) {
        throw mapSentryError(err);
      }
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async createDsnKey(
      tokens,
      orgSlug,
      projectSlug,
      name,
    ): Promise<SentryDsnKey> {
      try {
        const resp = await ctx.post(
          tokens,
          `/projects/${orgSlug}/${projectSlug}/keys/`,
          { name },
        );
        await assertOk(resp, "createDsnKey");
        return mapDsnKey((await resp.json()) as Record<string, unknown>);
      } catch (err) {
        throw mapSentryError(err);
      }
    },

    async getStats(
      tokens,
      orgSlug,
      opts: SentryStatsQueryOpts = {},
    ): Promise<SentryStats> {
      try {
        const resp = await ctx.get(tokens, `/organizations/${orgSlug}/stats_v2/`, {
          project: opts.project,
          environment: opts.environment,
          field: opts.stat === "rejected" ? "sum(times_seen)" : "sum(quantity)",
          groupBy: opts.environment ? "outcome" : undefined,
          statsPeriod: opts.since == null && opts.until == null ? "24h" : undefined,
          start: opts.since,
          end: opts.until,
          interval: opts.resolution ?? "1h",
        });
        await assertOk(resp, "getStats");
        return (await resp.json()) as SentryStats;
      } catch (err) {
        throw mapSentryError(err);
      }
    },

    async listDebugFiles(
      tokens,
      orgSlug,
      projectSlug,
    ): Promise<Paginated<SentryDebugFile>> {
      try {
        const resp = await ctx.get(
          tokens,
          `/projects/${orgSlug}/${projectSlug}/files/dsyms/`,
        );
        await assertOk(resp, "listDebugFiles");
        return await ctx.paginate(resp, mapDebugFile);
      } catch (err) {
        throw mapSentryError(err);
      }
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async deleteDebugFile(tokens, orgSlug, projectSlug, fileId): Promise<void> {
      try {
        const token =
          tokens.accessToken !== "" ? tokens.accessToken : ctx.config.authToken;
        const base =
          (ctx.config.baseUrl?.replace(/\/$/, "") ?? "https://sentry.io") +
          "/api/0";
        const url = new URL(
          `${base}/projects/${orgSlug}/${projectSlug}/files/dsyms/`,
        );
        url.searchParams.set("id", fileId);
        const resp = await fetch(url.toString(), {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        await assertOk(resp, "deleteDebugFile");
      } catch (err) {
        throw mapSentryError(err);
      }
    },
  };
}
