import type {
  AppStoreCapability,
  InstallStats,
  InstallStatsOpts,
} from "@apollo-deploy/integrations";
import { CapabilityError } from "@apollo-deploy/integrations";
import type { AppleContext, AppleListResponse } from "./_context.js";

// ── Apple Analytics Reports API types ────────────────────────────────────────

interface AnalyticsReportRequest {
  id: string;
  attributes: {
    accessType: "ONGOING" | "ONE_TIME_SNAPSHOT";
  };
}

interface AnalyticsReport {
  id: string;
  attributes: {
    reportType: string;
    reportSubType: string;
    frequency: string;
  };
}

interface AnalyticsReportInstance {
  id: string;
  attributes: {
    processingDate: string;
    granularity: string;
  };
}

interface AnalyticsReportSegment {
  id: string;
  attributes: {
    url: string;
    checksum: string;
    sizeInBytes: number;
  };
}

// ── TSV column names ──────────────────────────────────────────────────────────

// APP_USAGE / SUMMARY report (aggregated, one row per day)
const COL_ACTIVE_DEVICES = "Active Devices";
const COL_TOTAL_DOWNLOADS = "Total Downloads";
const COL_INSTALLATIONS = "Installations";
const COL_DELETIONS = "Deletions";

// APP_INSTALLS (detailed installs) report (event-level rows with dimensions)
// Reference: https://developer.apple.com/documentation/analytics-reports/app-installs
const COL_APP_VERSION = "App Version";
const COL_EVENT = "Event";
const COL_COUNTS = "Counts";
const EVENT_INSTALL = "Install";
const EVENT_DELETE = "Delete";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Decompress a gzip Response body and return the text.
 * Uses the Web Streams `DecompressionStream` API available in Node 18+ and
 * all modern edge runtimes.
 */
async function decompressGzip(response: Response): Promise<string> {
  const body = response.body;
  if (body == null) return "";
  const ds = new DecompressionStream("gzip");
  const decompressedStream = body.pipeThrough(ds);
  return new Response(decompressedStream).text();
}

/**
 * Parse a TSV string and return an array of objects keyed by column header.
 */
function parseTsv(tsv: string): Record<string, string>[] {
  const lines = tsv.split("\n").filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];
  const headers = lines[0].split("\t");
  return lines.slice(1).map((line) => {
    const cells = line.split("\t");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h.trim()] = (cells[i] ?? "").trim();
    });
    return row;
  });
}

function sumColumn(rows: Record<string, string>[], col: string): number {
  return rows.reduce((acc, r) => acc + (parseFloat(r[col] ?? "0") || 0), 0);
}

// ── Main export ───────────────────────────────────────────────────────────────

export function createAppleInstalls(
  ctx: AppleContext,
): Pick<AppStoreCapability, "getInstallStats"> {
  return {
    async getInstallStats(
      tokens,
      appId,
      opts?: InstallStatsOpts,
    ): Promise<InstallStats> {
      const appVersionCode = opts?.appVersionCode;

      // 1. Find or create an ONGOING report request for this app.
      const existingRequests = await ctx.appleRequest<
        AppleListResponse<AnalyticsReportRequest>
      >(
        tokens,
        `/apps/${appId}/analyticsReportRequests?filter[accessType]=ONGOING&limit=10`,
      );

      let requestId: string;

      if (
        existingRequests.data != null &&
        existingRequests.data.length > 0
      ) {
        requestId = existingRequests.data[0].id;
      } else {
        const created = await ctx.appleRequest<{ data: AnalyticsReportRequest }>(
          tokens,
          `/apps/${appId}/analyticsReportRequests`,
          {
            method: "POST",
            body: JSON.stringify({
              data: {
                type: "analyticsReportRequests",
                attributes: {
                  accessType: "ONGOING",
                },
              },
            }),
          },
        );
        requestId = created.data.id;
      }

      // 2. Fetch the appropriate report type.
      //    - Default: APP_USAGE / SUMMARY / DAILY (aggregated metrics per day)
      //    - With appVersionCode: APP_INSTALLS / STANDARD / DAILY (event-level
      //      rows with App Version dimension)
      const reportFilter = appVersionCode != null
        ? `?filter[reportType]=APP_INSTALLS&filter[reportSubType]=STANDARD&filter[frequency]=DAILY&limit=1`
        : `?filter[reportType]=APP_USAGE&filter[reportSubType]=SUMMARY&filter[frequency]=DAILY&limit=1`;

      const reports = await ctx.appleRequest<
        AppleListResponse<AnalyticsReport>
      >(
        tokens,
        `/analyticsReportRequests/${requestId}/reports${reportFilter}`,
      );

      if (reports.data == null || reports.data.length === 0) {
        throw new CapabilityError(
          "apple",
          "Install statistics are not ready yet. Apple takes up to 24 hours to generate " +
            "the first report after a new app is connected. Please check back tomorrow.",
          false,
        );
      }

      const reportId = reports.data[0].id;

      // 3. Get the most recent report instance (sorted desc by processing date).
      const instances = await ctx.appleRequest<
        AppleListResponse<AnalyticsReportInstance>
      >(
        tokens,
        `/analyticsReports/${reportId}/instances` +
          `?limit=1&sort=-processingDate`,
      );

      if (instances.data == null || instances.data.length === 0) {
        throw new CapabilityError(
          "apple",
          "Install statistics are not ready yet. Apple usually makes data available within 24 hours. " +
            "Please check back tomorrow.",
          false,
        );
      }

      const instance = instances.data[0];
      const instanceId = instance.id;
      const reportedAt = new Date(instance.attributes.processingDate);

      // 4. Get the first download segment for this instance.
      const segments = await ctx.appleRequest<
        AppleListResponse<AnalyticsReportSegment>
      >(
        tokens,
        `/analyticsReportInstances/${instanceId}/segments?limit=1`,
      );

      if (segments.data == null || segments.data.length === 0) {
        throw new CapabilityError(
          "apple",
          "The latest install statistics report is still being processed by Apple. " +
            "Please try again in a few minutes.",
          false,
        );
      }

      const segmentUrl = segments.data[0].attributes.url;

      // 5. Download the gzipped TSV segment using the signed URL directly
      //    (no Authorization header — the URL is pre-signed by Apple).
      const downloadRes = await fetch(segmentUrl);
      if (!downloadRes.ok) {
        if (downloadRes.status === 401 || downloadRes.status === 403) {
          throw new CapabilityError(
            "apple",
            "Access to install statistics was denied. Please check that your App Store Connect " +
              "API key has the 'Sales and Finance' or 'App Analytics' role enabled.",
            false,
          );
        }
        if (downloadRes.status === 429) {
          throw new CapabilityError(
            "apple",
            "Too many requests were made to Apple's servers. Please wait a moment and try again.",
            true,
          );
        }
        throw new CapabilityError(
          "apple",
          "Something went wrong while downloading install statistics from Apple. Please try again shortly.",
          downloadRes.status >= 500,
        );
      }

      // 6. Decompress and parse.
      const tsv = await decompressGzip(downloadRes);
      const rows = parseTsv(tsv);

      // 7. Build the result based on the report type used.
      if (appVersionCode != null) {
        // APP_INSTALLS report: event-level rows with App Version, Event, and Counts columns.
        const versionRows = rows.filter(
          (r) => r[COL_APP_VERSION] === appVersionCode,
        );
        if (versionRows.length === 0) {
          throw new CapabilityError(
            "apple",
            `No install statistics found for app version "${appVersionCode}". ` +
              "Check that this version has been released and has had activity.",
            false,
          );
        }

        const installRows = versionRows.filter((r) => r[COL_EVENT] === EVENT_INSTALL);
        const deleteRows = versionRows.filter((r) => r[COL_EVENT] === EVENT_DELETE);

        return {
          appId,
          platform: "ios",
          reportedAt,
          activeDeviceInstalls: 0, // Not available in the detailed installs report
          totalInstalls: Math.round(sumColumn(installRows, COL_COUNTS)),
          dailyInstalls: Math.round(sumColumn(installRows, COL_COUNTS)),
          dailyUninstalls: Math.round(sumColumn(deleteRows, COL_COUNTS)),
        };
      }

      // APP_USAGE / SUMMARY report: aggregated metric columns per day.
      const activeDeviceInstalls = sumColumn(rows, COL_ACTIVE_DEVICES);
      const totalInstalls = sumColumn(rows, COL_TOTAL_DOWNLOADS);
      const dailyInstalls = sumColumn(rows, COL_INSTALLATIONS);
      const dailyUninstalls = sumColumn(rows, COL_DELETIONS);

      return {
        appId,
        platform: "ios",
        reportedAt,
        activeDeviceInstalls: Math.round(activeDeviceInstalls),
        totalInstalls: Math.round(totalInstalls),
        dailyInstalls: Math.round(dailyInstalls),
        dailyUninstalls: Math.round(dailyUninstalls),
      };
    },
  };
}
