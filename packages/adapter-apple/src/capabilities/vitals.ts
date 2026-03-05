import type { AppStoreCapability, VitalMetricType, AnrCluster } from '@apollo-deploy/integrations';
import { mapAppleCrashCluster, mapAppleVitalsMetric } from '../mappers/models.js';
import type { AppleContext } from './_context.js';

// ── Helpers ──────────────────────────────────────────────────────────────

function mapVitalMetricToApple(metric: VitalMetricType): string {
  const map: Record<string, string> = {
    crash_rate: 'CRASH_RATE',
    launch_time: 'LAUNCH',
    hang_rate: 'HANG',
    memory_usage: 'MEMORY',
    disk_usage: 'DISK',
    disk_writes: 'DISK_WRITES',
    battery_drain: 'BATTERY',
    scroll_hitch_rate: 'SCROLL_HITCH',
  };
  return map[metric] ?? metric.toUpperCase().replace(/_/g, '_');
}

function extractApplePerfMetric(data: any, key: string): any {
  if (!data?.data) {
    return { value: 0, unit: '%', status: 'good' as const, trend: 'stable' as const };
  }
  const match = (data.data ?? []).find(
    (d: any) => d.attributes?.metricType === key || d.type?.includes(key.toLowerCase()),
  );
  const value = match?.attributes?.value ?? 0;
  return {
    value: Number(value),
    unit: match?.attributes?.unit ?? '%',
    status: 'good' as const,
    trend: 'stable' as const,
  };
}

export function createAppleVitals(
  ctx: AppleContext,
): Pick<AppStoreCapability, 'getVitalsSummary' | 'getVitalMetric' | 'listCrashClusters' | 'getCrashCluster' | 'listAnrClusters'> {
  return {
    async getVitalsSummary(tokens, appId, opts) {
      const params = new URLSearchParams({ 'filter[platform]': 'IOS' });
      if (opts?.version) params.set('filter[version]', opts.version);

      const [perfData, _crashData, _hangData] = await Promise.all([
        ctx.appleRequest(tokens, `/apps/${appId}/perfPowerMetrics?${params}`).catch(() => null),
        ctx.appleRequest(tokens, `/apps/${appId}/diagnosticSignatures?filter[diagnosticType]=CRASH&limit=1`).catch(() => null),
        ctx.appleRequest(tokens, `/apps/${appId}/diagnosticSignatures?filter[diagnosticType]=HANG&limit=1`).catch(() => null),
      ]);

      const period = {
        start: opts?.startDate ?? new Date(Date.now() - 28 * 86400000),
        end: opts?.endDate ?? new Date(),
      };

      return {
        appId,
        platform: 'ios' as const,
        period,
        metrics: {
          crashRate: extractApplePerfMetric(perfData, 'CRASH_RATE'),
          launchTime: extractApplePerfMetric(perfData, 'LAUNCH'),
          memoryUsage: extractApplePerfMetric(perfData, 'MEMORY'),
          diskWrites: extractApplePerfMetric(perfData, 'DISK_WRITES'),
        },
      };
    },

    async getVitalMetric(tokens, appId, metric, opts) {
      const appleMetricType = mapVitalMetricToApple(metric);
      const params = new URLSearchParams({
        'filter[metricType]': appleMetricType,
        'filter[platform]': 'IOS',
      });
      if (opts?.version) params.set('filter[version]', opts.version);

      const data = await ctx.appleRequest(tokens, `/apps/${appId}/perfPowerMetrics?${params}`);
      return mapAppleVitalsMetric(appId, metric, data);
    },

    async listCrashClusters(tokens, appId, opts) {
      const params = new URLSearchParams({
        'filter[diagnosticType]': 'CRASH',
        limit: String(opts?.limit ?? 20),
      });
      if (opts?.cursor) params.set('cursor', opts.cursor);
      if (opts?.version) params.set('filter[version]', opts.version);

      const data = await ctx.appleRequest(
        tokens,
        `/apps/${appId}/diagnosticSignatures?${params}`,
      );

      return {
        items: (data.data ?? []).map((s: any) => mapAppleCrashCluster(appId, s)),
        hasMore: !!data.links?.next,
        cursor: ctx.extractCursor(data.links?.next),
      };
    },

    async getCrashCluster(tokens, _appId, clusterId) {
      const [signature, logs] = await Promise.all([
        ctx.appleRequest(tokens, `/diagnosticSignatures/${clusterId}`),
        ctx.appleRequest(tokens, `/diagnosticSignatures/${clusterId}/logs`).catch(() => ({ data: [] })),
      ]);

      const cluster = mapAppleCrashCluster('', signature.data);
      cluster.stackTrace = logs.data?.[0]?.attributes?.diagnosticLog as string | undefined;
      return cluster;
    },

    async listAnrClusters() {
      // ANR is Android-only. Apple equivalent is "hangs" — use listCrashClusters with HANG type.
      return { items: [] as AnrCluster[], hasMore: false };
    },
  };
}
