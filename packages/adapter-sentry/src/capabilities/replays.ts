import type { MonitoringCapability } from "@apollo-deploy/integrations";
import { assertOk, mapSentryError } from "../mappers/errors.js";
import { mapReplay } from "../mappers/models.js";
import type { SentryContext } from "./_context.js";

export function createSentryReplays(
  ctx: SentryContext,
): Pick<
  MonitoringCapability,
  "listReplays" | "getReplay" | "getReplayErrorCount"
> {
  return {
    async listReplays(tokens, orgSlug, opts = {}) {
      try {
        const resp = await ctx.get(
          tokens,
          `/organizations/${orgSlug}/replays/`,
          {
            project: opts.project,
            environment: opts.environment,
            statsPeriod: opts.statsPeriod ?? "14d",
            start: opts.start,
            end: opts.end,
            query: opts.query,
            sort: opts.sort ?? "-startedAt",
            per_page: opts.limit ?? 25,
            cursor: opts.cursor,
          },
        );
        await assertOk(resp, "listReplays");
        const body = (await resp.json()) as { data: Record<string, unknown>[] };
        const cursor = ctx.parseLinkCursor(resp.headers.get("link"));
        return {
          items: body.data.map(mapReplay),
          hasMore: cursor !== undefined,
          cursor,
        };
      } catch (err) {
        throw mapSentryError(err);
      }
    },

    async getReplay(tokens, orgSlug, replayId) {
      try {
        const resp = await ctx.get(
          tokens,
          `/organizations/${orgSlug}/replays/${replayId}/`,
        );
        await assertOk(resp, "getReplay");
        const body = (await resp.json()) as { data: Record<string, unknown> };
        return mapReplay(body.data);
      } catch (err) {
        throw mapSentryError(err);
      }
    },

    async getReplayErrorCount(tokens, orgSlug, replayId) {
      try {
        const resp = await ctx.get(
          tokens,
          `/organizations/${orgSlug}/replays/${replayId}/`,
        );
        await assertOk(resp, "getReplayErrorCount");
        const body = (await resp.json()) as { data: Record<string, unknown> };
        return Number(
          (body.data as Record<string, unknown> | undefined)?.count_errors ?? 0,
        );
      } catch (err) {
        throw mapSentryError(err);
      }
    },
  };
}
