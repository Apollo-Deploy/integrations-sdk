import type {
  MonitoringCapability,
  WebVitalsData,
  MonitoringVitalsQueryOpts,
} from "@apollo-deploy/integrations";
import { assertOk, mapSentryError } from "../mappers/errors.js";
import type { SentryContext } from "./_context.js";

export function createSentryVitals(
  ctx: SentryContext,
): Pick<MonitoringCapability, "getWebVitals" | "getPerformanceScores"> {
  return {
    async getWebVitals(
      tokens,
      orgSlug,
      opts: MonitoringVitalsQueryOpts,
    ): Promise<WebVitalsData> {
      try {
        const field = [
          "transaction",
          "p75(measurements.lcp)",
          "p75(measurements.fcp)",
          "p75(measurements.cls)",
          "p75(measurements.fid)",
          "p75(measurements.ttfb)",
          "p75(measurements.inp)",
          "tpm()",
          "failure_rate()",
          "count_miserable(user)",
          "score(lcp)",
          "score(fcp)",
          "score(cls)",
        ];
        const resp = await ctx.get(
          tokens,
          `/organizations/${orgSlug}/events/`,
          {
            field: field.join(","),
            dataset: "metrics",
            project: opts.project,
            environment: opts.environment,
            transaction: opts.transaction,
            statsPeriod: opts.statsPeriod ?? "7d",
            start: opts.start,
            end: opts.end,
            per_page: opts.limit ?? 50,
            cursor: opts.cursor,
          },
        );
        await assertOk(resp, "getWebVitals");
        const body = (await resp.json()) as { data: Record<string, unknown>[] };
        return {
          project: opts.project ?? "",
          environment: opts.environment,
          period: opts.statsPeriod ?? "7d",
          data: body.data.map((row) => ({
            transaction: (row.transaction as string | undefined) ?? "",
            lcp: row["p75(measurements.lcp)"] as number | undefined,
            fcp: row["p75(measurements.fcp)"] as number | undefined,
            cls: row["p75(measurements.cls)"] as number | undefined,
            fid: row["p75(measurements.fid)"] as number | undefined,
            ttfb: row["p75(measurements.ttfb)"] as number | undefined,
            inp: row["p75(measurements.inp)"] as number | undefined,
            tpm: Number(row["tpm()"] ?? 0),
            failureRate: Number(row["failure_rate()"] ?? 0),
          })),
        };
      } catch (err) {
        throw mapSentryError(err);
      }
    },

    async getPerformanceScores(tokens, orgSlug, opts): Promise<WebVitalsData> {
      try {
        const resp = await ctx.get(
          tokens,
          `/organizations/${orgSlug}/events/`,
          {
            field: [
              "transaction",
              "performance_score(measurements.score.total)",
              "performance_score(measurements.score.lcp)",
              "performance_score(measurements.score.fcp)",
              "performance_score(measurements.score.cls)",
              "performance_score(measurements.score.ttfb)",
              "tpm()",
              "count()",
            ].join(","),
            dataset: "metrics",
            project: opts.project,
            environment: opts.environment,
            statsPeriod: opts.statsPeriod ?? "7d",
            start: opts.start,
            end: opts.end,
            per_page: opts.limit ?? 50,
            cursor: opts.cursor,
          },
        );
        await assertOk(resp, "getPerformanceScores");
        const body = (await resp.json()) as { data: Record<string, unknown>[] };
        return {
          project: opts.project ?? "",
          environment: opts.environment,
          period: opts.statsPeriod ?? "7d",
          data: body.data.map((row) => ({
            transaction: (row.transaction as string | undefined) ?? "",
            performanceScore:
              Number(row["performance_score(measurements.score.total)"] ?? 0) *
              100,
            tpm: Number(row["tpm()"] ?? 0),
            failureRate: 0,
          })),
        };
      } catch (err) {
        throw mapSentryError(err);
      }
    },
  };
}
