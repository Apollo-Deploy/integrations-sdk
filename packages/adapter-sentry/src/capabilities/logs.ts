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
        const resp = await ctx.get(tokens, `/organizations/${orgSlug}/logs/`, {
          project: opts.project,
          environment: opts.environment,
          query: opts.query,
          level: opts.level,
          statsPeriod: opts.statsPeriod ?? "24h",
          start: opts.start,
          end: opts.end,
          per_page: opts.limit ?? 50,
          cursor: opts.cursor,
        });
        await assertOk(resp, "queryLogs");
        return await ctx.paginate(
          resp,
          (raw): MonitoringLogEntry => ({
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
          }),
        );
      } catch (err) {
        throw mapSentryError(err);
      }
    },
  };
}
