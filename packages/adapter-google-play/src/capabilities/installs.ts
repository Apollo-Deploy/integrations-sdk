import type {
  AppStoreCapability,
  InstallStats,
  InstallStatsOpts,
  TokenSet,
} from "@apollo-deploy/integrations";
import { CapabilityError } from "@apollo-deploy/integrations";
import type { GooglePlayContext } from "./_context.js";

// ── GCS bucket / path helpers ─────────────────────────────────────────────────

const GCS_API = "https://storage.googleapis.com/storage/v1";

/** Encode an object path for the GCS JSON API (slashes become %2F). */
function encodeGcsPath(path: string): string {
  return encodeURIComponent(path);
}

/**
 * Resolve the YYYY-MM month string to use when looking up reports.
 * Defaults to the current calendar month but always tries the previous month
 * as a fallback, since Play Console files for the current month may not be
 * published until the month is over.
 */
function resolveReportMonth(optMonth?: string): { primary: string; fallback: string } {
  const now = new Date();
  if (optMonth != null && optMonth !== "") {
    // If the caller provided a month, also provide the prior month as fallback.
    const [yr, mo] = optMonth.split("-").map(Number) as [number, number];
    const fallbackDate = new Date(yr, mo - 2, 1); // zero-indexed month
    const fallback = `${fallbackDate.getFullYear()}-${String(fallbackDate.getMonth() + 1).padStart(2, "0")}`;
    return { primary: optMonth, fallback };
  }
  const primary = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const fallbackDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const fallback = `${fallbackDate.getFullYear()}-${String(fallbackDate.getMonth() + 1).padStart(2, "0")}`;
  return { primary, fallback };
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

  const headers = lines[0]!.split(",").map((h) => h.replace(/^"|"$/g, "").trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? "";
    });
    return row;
  });
}

/**
 * Column names in the Play Console install-stats overview CSV.
 * Reference: https://support.google.com/googleplay/android-developer/answer/6135870
 */
const COL_DATE = "Date";
const COL_ACTIVE_DEVICE_INSTALLS = "Active Device Installs";
const COL_TOTAL_USER_INSTALLS = "Total User Installs";
const COL_DAILY_DEVICE_INSTALLS = "Daily Device Installs";
const COL_DAILY_USER_UNINSTALLS = "Daily User Uninstalls";

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function gcsDownloadText(tokens: TokenSet, url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new CapabilityError(
        "google-play",
        "Your Google Play service account does not have permission to access install statistics. " +
          "Please grant the 'Storage Object Viewer' role on the Play Console reports bucket, " +
          "or check that Statistics are enabled for this service account in Play Console \u2192 Setup \u2192 API access.",
        false,
      );
    }
    if (res.status === 404) {
      throw new CapabilityError(
        "google-play",
        "404", // sentinel \u2014 caught by the retry loop
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

  // Play Console CSV files are UTF-16 LE encoded (Google explicitly documents
  // this under the GCS export section). We must decode via ArrayBuffer rather
  // than using res.text() which defaults to UTF-8.
  const buffer = await res.arrayBuffer();
  // utf-16le is a valid WHATWG encoding but is absent from Bun's narrow Encoding union.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const decoder = new TextDecoder("utf-16le" as any);
  return decoder.decode(buffer);
}

// ── Main export ───────────────────────────────────────────────────────────────

export function createGooglePlayInstalls(
  ctx: GooglePlayContext,
): Pick<AppStoreCapability, "getInstallStats"> {
  return {
    async getInstallStats(
      tokens,
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

      // The file naming convention from the Play Console docs:
      //   installs_{packagename}_{YYYYMM}_overview.csv
      // where YYYYMM is the month without a separator.
      const buildObjectName = (month: string): string => {
        const yyyymm = month.replace("-", "");
        return `stats/installs/installs_${packageName}_${yyyymm}_overview.csv`;
      };

      // Try primary month first, then fall back to the previous month.
      let csvText: string | null = null;
      let resolvedObjectName: string | null = null;

      for (const month of [primary, fallback]) {
        const objectName = buildObjectName(month);
        const downloadUrl =
          `${GCS_API}/b/${encodeURIComponent(bucket)}/o/${encodeGcsPath(objectName)}?alt=media`;
        try {
          csvText = await gcsDownloadText(tokens, downloadUrl);
          resolvedObjectName = objectName;
          break;
        } catch (err) {
          // CapabilityError with 404 — try next month.
          if (
            err instanceof CapabilityError &&
            String(err.message).includes("404")
          ) {
            continue;
          }
          throw err;
        }
      }

      if (csvText == null || resolvedObjectName == null) {
        throw new CapabilityError(
          "google-play",
          `Install statistics are not yet available for ${primary}. ` +
            "Google Play publishes monthly install reports a few days after the month ends. " +
            "If you are expecting data, ensure your service account has access to Statistics " +
            "in Play Console → Setup → API access, and that the app has been live for at least one full month.",
          false,
        );
      }

      const rows = parseCsv(csvText);
      if (rows.length === 0) {
        throw new CapabilityError(
          "google-play",
          "Install statistics were received but contained no data. " +
            "This can happen when the app had no installs during the selected period.",
          false,
        );
      }

      // Use the most recent row (last row = latest date in the file).
      const latest = rows[rows.length - 1]!;

      const reportedAt = latest[COL_DATE] != null && latest[COL_DATE] !== ""
        ? new Date(latest[COL_DATE])
        : new Date();

      const parse = (col: string): number =>
        parseFloat(latest[col] ?? "0") || 0;

      return {
        appId: packageName,
        platform: "android",
        reportedAt,
        activeDeviceInstalls: Math.round(parse(COL_ACTIVE_DEVICE_INSTALLS)),
        totalInstalls: Math.round(parse(COL_TOTAL_USER_INSTALLS)),
        dailyInstalls: Math.round(parse(COL_DAILY_DEVICE_INSTALLS)),
        dailyUninstalls: Math.round(parse(COL_DAILY_USER_UNINSTALLS)),
      };
    },
  };
}
