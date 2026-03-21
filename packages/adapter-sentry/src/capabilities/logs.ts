import type {
  MonitoringCapability,
  MonitoringLogEntry,
  LogQueryOpts,
} from "@apollo-deploy/integrations";
import { assertOk, mapSentryError } from "../mappers/errors.js";
import { toDate } from "../mappers/models.js";
import type { SentryContext } from "./_context.js";

export function createSentryLogs(
  ctx: SentryContext,
): Pick<MonitoringCapability, "queryLogs"> {
  return {
    async queryLogs(tokens, orgSlug, opts: LogQueryOpts) {
      try {
        const resp = await ctx.get(tokens, `/organizations/${orgSlug}/events/`, {
          dataset: "ourlogs",
          project: opts.project,
          environment: opts.environment,
          query: opts.level != null ? `level:${opts.level}${opts.query != null ? ` ${opts.query}` : ""}` : opts.query,
          field: ["id", "timestamp", "level", "message", "release", "environment", "tags", "trace"].join(","),
          statsPeriod: opts.statsPeriod ?? "24h",
          start: opts.start,
          end: opts.end,
          per_page: opts.limit ?? 50,
          cursor: opts.cursor,
        });
        await assertOk(resp, "queryLogs");
        const body = (await resp.json()) as {
          data: Record<string, unknown>[];
          meta?: Record<string, unknown>;
        };
        const cursor = ctx.parseLinkCursor(resp.headers.get("link"));
        const mapper = (raw: Record<string, unknown>): MonitoringLogEntry => ({
          id: String(raw.id),
          timestamp: toDate(raw.timestamp as string),
          level:
            (raw.level as MonitoringLogEntry["level"] | undefined) ?? "info",
          message: (raw.message as string | undefined) ?? "",
          environment: raw.environment as string | undefined,
          release: raw.release as string | undefined,
          tags:
            (raw.tags as { key: string; value: string }[] | undefined) ?? [],
          attributes:
            (raw.attributes as
              | Record<string, string | number | boolean>
              | undefined) ?? {},
          traceId: raw.traceId as string | undefined,
          spanId: raw.spanId as string | undefined,
          sdk: raw.sdk as MonitoringLogEntry["sdk"],
          project: (() => {
            const p = raw.project as Record<string, unknown> | undefined;
            return p
              ? {
                  id: String(p.id),
                  slug: String(p.slug),
                  name: String(p.name),
                }
              : { id: "", slug: "", name: "" };
          })(),
        });
        return {
          items: (body.data ?? []).map(mapper),
          hasMore: cursor !== undefined,
          cursor,
        };
      } catch (err) {
        throw mapSentryError(err);
      }
    },
  };
}
