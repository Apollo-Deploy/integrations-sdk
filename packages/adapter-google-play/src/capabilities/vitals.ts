import type {
  AppStoreCapability,
  TokenSet,
  Paginated,
  VitalsSummary,
  VitalMetric,
  VitalMetricType,
  CrashCluster,
  AnrCluster,
  VitalsQueryOpts,
  CrashQueryOpts,
} from "@apollo-deploy/integrations";
import {
  mapGoogleVitalMetric,
  mapGoogleCrashCluster,
  mapGoogleAnrCluster,
} from "../mappers/models.js";
import type { GooglePlayContext } from "./_context.js";
import { REPORTING_URL } from "./_context.js";

export function createGooglePlayVitals(
  ctx: GooglePlayContext,
): Pick<
  AppStoreCapability,
  | "getVitalsSummary"
  | "getVitalMetric"
  | "listCrashClusters"
  | "getCrashCluster"
  | "listAnrClusters"
> {
  return {
    async getVitalsSummary(
      _tokens: TokenSet,
      packageName: string,
      _opts?: VitalsQueryOpts,
    ): Promise<VitalsSummary> {
      const period = {
        start: _opts?.startDate ?? new Date(Date.now() - 28 * 86400000),
        end: _opts?.endDate ?? new Date(),
      };

      return Promise.resolve({
        appId: packageName,
        platform: "android" as const,
        period,
        metrics: {
          crashRate: {
            value: 0,
            unit: "%",
            status: "good" as const,
            trend: "stable" as const,
          },
          anrRate: {
            value: 0,
            unit: "%",
            status: "good" as const,
            trend: "stable" as const,
          },
          launchTime: {
            value: 0,
            unit: "ms",
            status: "good" as const,
            trend: "stable" as const,
          },
        },
      });
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async getVitalMetric(
      _tokens: TokenSet,
      packageName: string,
      metric: VitalMetricType,
      opts?: VitalsQueryOpts,
    ): Promise<VitalMetric> {
      const metricSet = ctx.vitalsMetricSet(metric);
      const body: Record<string, unknown> = {
        dimensions: ["date"],
        metrics: [metric === "crash_rate" ? "userPerceivedCrashRate" : metric],
        timelineSpec: {
          aggregationPeriod: "DAILY",
          startTime: opts?.startDate
            ? {
                year: opts.startDate.getFullYear(),
                month: opts.startDate.getMonth() + 1,
                day: opts.startDate.getDate(),
              }
            : undefined,
          endTime: opts?.endDate
            ? {
                year: opts.endDate.getFullYear(),
                month: opts.endDate.getMonth() + 1,
                day: opts.endDate.getDate(),
              }
            : undefined,
        },
      };

      const data = await ctx.reportingRequest(
        `${REPORTING_URL}/apps/${encodeURIComponent(packageName)}/${metricSet}:query`,
        { method: "POST", body: JSON.stringify(body) },
      );

      return mapGoogleVitalMetric(packageName, metric, data);
    },

    async listCrashClusters(
      _tokens: TokenSet,
      packageName: string,
      opts?: CrashQueryOpts,
    ): Promise<Paginated<CrashCluster>> {
      const params = new URLSearchParams();
      params.set("filter", "errorType=CRASH");
      if (opts?.limit) params.set("pageSize", String(opts.limit));
      if (opts?.cursor) params.set("pageToken", opts.cursor);

      const data = await ctx.reportingRequest(
        `${REPORTING_URL}/apps/${encodeURIComponent(packageName)}/errorIssues?${params}`,
      );

      return {
        items: (data?.errorIssues ?? []).map((e: Record<string, unknown>) =>
          mapGoogleCrashCluster(packageName, e),
        ),
        hasMore: !!data?.nextPageToken,
        cursor: data?.nextPageToken,
      };
    },

    async getCrashCluster(
      _tokens: TokenSet,
      packageName: string,
      clusterId: string,
    ): Promise<CrashCluster> {
      const data = await ctx.reportingRequest(
        `${REPORTING_URL}/apps/${encodeURIComponent(packageName)}/errorIssues/${clusterId}`,
      );
      return mapGoogleCrashCluster(packageName, data);
    },

    async listAnrClusters(
      _tokens: TokenSet,
      packageName: string,
      opts?: CrashQueryOpts,
    ): Promise<Paginated<AnrCluster>> {
      const params = new URLSearchParams();
      params.set("filter", "errorType=ANR");
      if (opts?.limit) params.set("pageSize", String(opts.limit));
      if (opts?.cursor) params.set("pageToken", opts.cursor);

      const data = await ctx.reportingRequest(
        `${REPORTING_URL}/apps/${encodeURIComponent(packageName)}/errorIssues?${params}`,
      );

      return {
        items: (data?.errorIssues ?? []).map((e: Record<string, unknown>) =>
          mapGoogleAnrCluster(packageName, e),
        ),
        hasMore: !!data?.nextPageToken,
        cursor: data?.nextPageToken,
      };
    },
  };
}
