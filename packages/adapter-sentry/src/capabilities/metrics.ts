import type {
  MonitoringCapability,
  MetricSeries,
  MetricQueryOpts,
} from "@apollo-deploy/integrations";
import { assertOk, mapSentryError } from "../mappers/errors.js";
import type { SentryContext } from "./_context.js";

export function createSentryMetrics(
  ctx: SentryContext,
): Pick<MonitoringCapability, "queryMetrics" | "listMetrics"> {
  return {
    async queryMetrics(
      tokens,
      orgSlug,
      opts: MetricQueryOpts,
    ): Promise<MetricSeries[]> {
      try {
        const resp = await ctx.get(
          tokens,
          `/organizations/${orgSlug}/metrics/data/`,
          {
            project: opts.project,
            environment: opts.environment,
            mri: opts.metric,
            field: `${opts.aggregate}(${opts.metric})`,
            query: opts.query,
            groupBy: opts.groupBy?.join(","),
            statsPeriod: opts.statsPeriod ?? "24h",
            start: opts.start,
            end: opts.end,
            interval: opts.interval ?? "1h",
          },
        );
        await assertOk(resp, "queryMetrics");
        const body = (await resp.json()) as {
          groups: Record<string, unknown>[];
        };
        return body.groups.map((g) => ({
          group: (g.by as Record<string, string> | undefined) ?? {},
          by: (g.by as Record<string, string> | undefined) ?? {},
          series:
            (g.series as
              | Record<string, [number, number | null][]>
              | undefined) ?? {},
        }));
      } catch (err) {
        throw mapSentryError(err);
      }
    },

    async listMetrics(tokens, orgSlug, opts = {}) {
      try {
        const resp = await ctx.get(
          tokens,
          `/organizations/${orgSlug}/metrics/meta/`,
          {
            project: opts.project,
            query: opts.query,
          },
        );
        await assertOk(resp, "listMetrics");
        const data = (await resp.json()) as Record<string, unknown>[];
        return data.map((m) => ({
          key: String(m.mri),
          name: String(m.name),
          type: String(m.type),
          unit: String(m.unit),
          operations: (m.operations as string[] | undefined) ?? [],
        }));
      } catch (err) {
        throw mapSentryError(err);
      }
    },
  };
}
