import type {
  AppStoreCapability,
  InstallStats,
  InstallStatsOpts,
} from "@apollo-deploy/integrations";
import { CapabilityError } from "@apollo-deploy/integrations";
import type { GooglePlayContext } from "./_context.js";
import { mintGcsAccessToken } from "../oauth.js";

// ── GCS bucket / path helpers ─────────────────────────────────────────────────

const GCS_API = "https://storage.googleapis.com/storage/v1";

/** Encode an object path for the GCS JSON API (slashes become %2F). */
function encodeGcsPath(path: string): string {
  return encodeURIComponent(path);
}

/** Format a Date as a YYYY-MM string. */
function formatMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Return the YYYY-MM string for the month before `yyyyMM`. */
function previousMonth(yyyyMM: string): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(yyyyMM);
  if (match == null) return yyyyMM;
  const [, yearStr, monthStr] = match;
  const prev = new Date(parseInt(yearStr ?? "0", 10), parseInt(monthStr ?? "1", 10) - 2, 1);
  return formatMonth(prev);
}

/**
 * Resolve the YYYY-MM month string to use when looking up reports.
 * Defaults to the current calendar month but always tries the previous month
 * as a fallback, since Play Console files for the current month may not be
 * published until the month is over.
 */
function resolveReportMonth(optMonth?: string): { primary: string; fallback: string } {
  if (optMonth != null && optMonth !== "") {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(optMonth)) {
      throw new CapabilityError(
        "google-play",
        `Invalid reportMonth "${optMonth}". Expected format: YYYY-MM (e.g. "2025-03").`,
        false,
      );
    }
    return { primary: optMonth, fallback: previousMonth(optMonth) };
  }
  const primary = formatMonth(new Date());
  return { primary, fallback: previousMonth(primary) };
}

// ── CSV parsing ───────────────────────────────────────────────────────────────

/**
 * Parse a CSV string into rows keyed by column header.
 * Play Console stats files are comma-delimited. The UTF-16 BOM is already
 * stripped by TextDecoder, but we guard against it as well.
 */
function parseCsv(csv: string): Record<string, string>[] {
  // Guard against any residual BOM after TextDecoder.
  const cleaned = csv.replace(/^\uFEFF/, "");
  const lines = cleaned.split("\n").filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];

  const [headerLine, ...dataLines] = lines;
  if (headerLine == null || dataLines.length === 0) return [];

  const headers = headerLine.split(",").map((h) => h.replace(/^"|"$/g, "").trim());
  return dataLines.map((line) => {
    const cells = line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? "";
    });
    return row;
  });
}

/**
 * Column names in the Play Console install-stats CSV.
 * Reference: https://support.google.com/googleplay/android-developer/answer/6135870#zippy=%2Cinstalls
 */
const COL_DATE = "Date";
const COL_APP_VERSION_CODE = "App Version Code";
const COL_ACTIVE_DEVICE_INSTALLS = "Active Device Installs";
const COL_TOTAL_USER_INSTALLS = "Total User Installs";
const COL_DAILY_DEVICE_INSTALLS = "Daily Device Installs";
const COL_DAILY_DEVICE_UNINSTALLS = "Daily Device Uninstalls";

// ── Fetch helpers ─────────────────────────────────────────────────────────────

/**
 * Download a text file from GCS. Returns `null` for 404 (file not found)
 * instead of throwing, so the caller can try fallback paths without
 * exception-based control flow.
 *
 * Play Console CSV files are UTF-16 LE encoded (Google docs confirm this
 * under the GCS export section).
 */
async function gcsDownloadText(accessToken: string, url: string): Promise<string | null> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    if (res.status === 401 || res.status === 403) {
      throw new CapabilityError(
        "google-play",
        "Your Google Play service account does not have permission to access install statistics. " +
          "Please grant the 'Storage Object Viewer' role on the Play Console reports bucket, " +
          "or check that Statistics are enabled for this service account in Play Console \u2192 Setup \u2192 API access.",
        false,
      );
    }
    if (res.status === 429) {
      throw new CapabilityError(
        "google-play",
        "Too many requests were made to Google's servers. Please wait a moment and try again.",
        true,
      );
    }
    throw new CapabilityError(
      "google-play",
      "Something went wrong while fetching install statistics from Google. Please try again shortly.",
      res.status >= 500,
    );
  }

  const buffer = await res.arrayBuffer();
  // utf-16le is a valid WHATWG encoding but is absent from Bun's narrow Encoding union.
  const decoder = new TextDecoder("utf-16le" as any);
  return decoder.decode(buffer);
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Build the GCS object name for a monthly installs CSV.
 *
 * Supported dimensions per Google docs:
 *   - `overview` (default) — aggregated across all versions
 *   - `app_version` — broken down by `App Version Code`
 *
 * Format: `stats/installs/installs_{package}_{yyyyMM}_{dimension}.csv`
 *
 * Reference: https://support.google.com/googleplay/android-developer/answer/6135870#zippy=%2Cinstalls
 */
function buildObjectName(
  packageName: string,
  month: string,
  dimension = "overview",
): string {
  const yyyymm = month.replaceAll("-", "");
  return `stats/installs/installs_${packageName}_${yyyymm}_${dimension}.csv`;
}

export function createGooglePlayInstalls(
  ctx: GooglePlayContext,
): Pick<AppStoreCapability, "getInstallStats"> {
  return {
    async getInstallStats(
      _tokens,
      packageName,
      opts?: InstallStatsOpts,
    ): Promise<InstallStats> {
      const accountId = ctx.config.developerAccountId;
      if (accountId == null || accountId === "") {
        throw new CapabilityError(
          "google-play",
          "Install statistics are not configured. To enable this feature, add your " +
            "Developer Account ID to the Google Play adapter config (developerAccountId). " +
            "You can find this number in the Play Console URL after /developers/ — " +
            "for example: play.google.com/console/u/0/developers/1234567890/",
          false,
        );
      }

      const bucket = `pubsite_prod_rev_${accountId}`;
      const { primary, fallback } = resolveReportMonth(opts?.reportMonth);
      const appVersionCode = opts?.appVersionCode;
      const dimension = appVersionCode != null ? "app_version" : "overview";

      // Mint a fresh GCS-scoped token. The token passed into this method is
      // scoped to androidpublisher and cannot access Cloud Storage.
      const gcsAccessToken = await mintGcsAccessToken(
        ctx.config.serviceAccountCredentials,
      );

      // Try primary month first, then fall back to the previous month.
      let csvText: string | null = null;

      for (const month of [primary, fallback]) {
        const objectName = buildObjectName(packageName, month, dimension);
        const downloadUrl =
          `${GCS_API}/b/${encodeURIComponent(bucket)}/o/${encodeGcsPath(objectName)}?alt=media`;
        csvText = await gcsDownloadText(gcsAccessToken, downloadUrl);
        if (csvText != null) break;
      }

      if (csvText == null) {
        throw new CapabilityError(
          "google-play",
          `Install statistics are not yet available for ${primary}. ` +
            "Google Play publishes monthly install reports a few days after the month ends. " +
            "If you are expecting data, ensure your service account has access to Statistics " +
            "in Play Console → Setup → API access, and that the app has been live for at least one full month.",
          false,
        );
      }

      let rows = parseCsv(csvText);

      // When filtering by app version, keep only the rows matching the
      // requested version code from the _app_version.csv dimension file.
      if (appVersionCode != null) {
        rows = rows.filter(
          (r) => r[COL_APP_VERSION_CODE] === appVersionCode,
        );
        if (rows.length === 0) {
          throw new CapabilityError(
            "google-play",
            `No install statistics found for app version code "${appVersionCode}". ` +
              "Check that this version has been published and has had installs during the selected period.",
            false,
          );
        }
      }

      // Use the most recent row (last row = latest date in the file).
      const latest = rows.at(-1);
      if (latest == null) {
        throw new CapabilityError(
          "google-play",
          "Install statistics were received but contained no data. " +
            "This can happen when the app had no installs during the selected period.",
          false,
        );
      }

      const reportedAt = latest[COL_DATE] != null && latest[COL_DATE] !== ""
        ? new Date(latest[COL_DATE])
        : new Date();

      const parseCol = (col: string): number => {
        const raw = latest[col];
        if (raw == null || raw === "") return 0;
        const n = parseInt(raw, 10);
        return Number.isNaN(n) ? 0 : n;
      };

      return {
        appId: packageName,
        platform: "android",
        reportedAt,
        activeDeviceInstalls: parseCol(COL_ACTIVE_DEVICE_INSTALLS),
        totalInstalls: parseCol(COL_TOTAL_USER_INSTALLS),
        dailyInstalls: parseCol(COL_DAILY_DEVICE_INSTALLS),
        dailyUninstalls: parseCol(COL_DAILY_DEVICE_UNINSTALLS),
      };
    },
  };
}
