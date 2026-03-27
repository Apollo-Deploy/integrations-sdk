import type {
  AppStoreCapability,
  InstallStats,
  InstallStatsOpts,
} from "@apollo-deploy/integrations";
import { Storage } from "@google-cloud/storage";
import { CapabilityError } from "@apollo-deploy/integrations";
import type { GooglePlayContext } from "./_context.js";

// ── GCS bucket / path helpers ─────────────────────────────────────────────────

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
 * Returns up to 3 candidate months, newest first.
 * Defaults to the current calendar month but always includes the two prior
 * months as fallbacks — Play Console may not generate dimension files
 * (e.g. _app_version.csv) until later in the reporting cycle.
 */
function resolveReportMonth(optMonth?: string): { primary: string; candidates: string[] } {
  if (optMonth != null && optMonth !== "") {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(optMonth)) {
      throw new CapabilityError(
        "google-play",
        `Invalid reportMonth "${optMonth}". Expected format: YYYY-MM (e.g. "2025-03").`,
        false,
      );
    }
    const m1 = previousMonth(optMonth);
    return { primary: optMonth, candidates: [optMonth, m1, previousMonth(m1)] };
  }
  const primary = formatMonth(new Date());
  const m1 = previousMonth(primary);
  return { primary, candidates: [primary, m1, previousMonth(m1)] };
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

const INSTALLS_PERMISSION_MESSAGE =
  "Your Google Play service account does not have permission to access install statistics. " +
  "Grant access to download bulk reports for this service account in Play Console Users and permissions, " +
  "then wait for Google to propagate bucket access.";

// ── Fetch helpers ─────────────────────────────────────────────────────────────

/**
 * Download a text file from GCS. Returns `null` for 404 (file not found)
 * instead of throwing, so the caller can try fallback paths without
 * exception-based control flow.
 *
 * Play Console CSV files are UTF-16 LE encoded (Google docs confirm this
 * under the GCS export section).
 */
async function gcsDownloadText(
  storage: Storage,
  bucket: string,
  objectName: string,
): Promise<string | null> {
  try {
    const [contents] = await storage.bucket(bucket).file(objectName).download({ validation: false, decompress: false });

    // utf-16le is a valid WHATWG encoding but is absent from Bun's narrow Encoding union.
    const decoder = new TextDecoder("utf-16le" as any);
    return decoder.decode(contents);
  } catch (error) {
    const rawCode =
      typeof error === "object" && error !== null
        ? (error as { code?: number | string }).code
        : undefined;
    const status =
      typeof rawCode === "string"
        ? Number.parseInt(rawCode, 10)
        : rawCode;

    if (status === 404) return null;
    if (status === 401 || status === 403) {
      throw new CapabilityError(
        "google-play",
        INSTALLS_PERMISSION_MESSAGE,
        false,
      );
    }
    if (status === 429) {
      throw new CapabilityError(
        "google-play",
        "Too many requests were made to Google's servers. Please wait a moment and try again.",
        true,
      );
    }
    throw new CapabilityError(
      "google-play",
      "Something went wrong while fetching install statistics from Google. Please try again shortly.",
      status != null && status >= 500,
    );
  }
}

type GcsLookupResult =
  | { kind: "found"; text: string }
  | { kind: "not-found" }
  | { kind: "forbidden" };

async function gcsLookupAcrossBuckets(
  storage: Storage,
  buckets: string[],
  objectName: string,
): Promise<GcsLookupResult> {
  let sawForbidden = false;

  for (const bucket of buckets) {
    try {
      const text = await gcsDownloadText(storage, bucket, objectName);
      if (text != null) {
        return { kind: "found", text };
      }
    } catch (error) {
      if (
        error instanceof CapabilityError &&
        error.message.includes("does not have permission to access install statistics")
      ) {
        sawForbidden = true;
        continue;
      }
      throw error;
    }
  }

  if (sawForbidden) {
    return { kind: "forbidden" };
  }

  return { kind: "not-found" };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Build the GCS object name for a monthly installs CSV.
 *
 * Without a dimension (default) the aggregate file has no suffix:
 *   `stats/installs/installs_{package}_{yyyyMM}.csv`
 *
 * With a dimension, the suffix is appended:
 *   - `app_version` → `_app_version.csv` — by App Version Code
 *   - `carrier`     → `_carrier.csv`     — by mobile carrier
 *   - `country`     → `_country.csv`     — by country
 *   - `device`      → `_device.csv`      — by device model
 *   - `language`    → `_language.csv`    — by user language
 *   - `os_version`  → `_os_version.csv`  — by Android OS version
 *
 * Reference: https://support.google.com/googleplay/android-developer/answer/6135870#zippy=%2Cinstalls
 */
function buildObjectName(
  packageName: string,
  month: string,
  dimension?: string,
): string {
  const yyyymm = month.replaceAll("-", "");
  const suffix = dimension != null ? `_${dimension}` : "";
  return `stats/installs/installs_${packageName}_${yyyymm}${suffix}.csv`;
}

export function createGooglePlayInstalls(
  ctx: GooglePlayContext,
): Pick<AppStoreCapability, "getInstallStats"> {
  const storage = new Storage({
    projectId: ctx.config.serviceAccountCredentials.project_id,
    credentials: ctx.config.serviceAccountCredentials,
  });

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

      const buckets = [`pubsite_prod_${accountId}`, `pubsite_prod_rev_${accountId}`];
      const { primary, candidates } = resolveReportMonth(opts?.reportMonth);
      const appVersionCode = opts?.appVersionCode;
      // appVersionCode implies app_version; otherwise default to the aggregate file.
      const dimension = appVersionCode != null ? "app_version" : opts?.dimension;

      // Try each candidate month in order until a matching file is found.
      // For each month we first try the requested dimension (or aggregate when
      // unspecified), then fall back to `_app_version` — some Play Console
      // accounts only publish the dimension breakdown files and not the
      // aggregate overview CSV.
      let csvText: string | null = null;
      let sawForbidden = false;

      for (const month of candidates) {
        const result = await gcsLookupAcrossBuckets(
          storage,
          buckets,
          buildObjectName(packageName, month, dimension),
        );
        if (result.kind === "found") {
          csvText = result.text;
          break;
        }
        if (result.kind === "forbidden") {
          sawForbidden = true;
          continue;
        }

        // Aggregate file not found — try the _app_version dimension file as a
        // fallback before moving to the previous month.
        if (dimension == null) {
          const fallback = await gcsLookupAcrossBuckets(
            storage,
            buckets,
            buildObjectName(packageName, month, "app_version"),
          );
          if (fallback.kind === "found") {
            csvText = fallback.text;
            break;
          }
          if (fallback.kind === "forbidden") {
            sawForbidden = true;
          }
        }
      }

      if (csvText == null) {
        if (sawForbidden) {
          throw new CapabilityError(
            "google-play",
            INSTALLS_PERMISSION_MESSAGE,
            false,
          );
        }
        if (appVersionCode != null) {
          // Probe the aggregate file to distinguish "report doesn't exist" from
          // "report exists but app_version dimension file isn't generated yet".
          const overviewExists = await gcsLookupAcrossBuckets(
            storage,
            buckets,
            buildObjectName(packageName, primary),
          );
          if (overviewExists.kind === "forbidden") {
            throw new CapabilityError(
              "google-play",
              INSTALLS_PERMISSION_MESSAGE,
              false,
            );
          }
          if (overviewExists.kind === "found") {
            throw new CapabilityError(
              "google-play",
              `Install data for ${primary} is available, but the per-version breakdown ` +
                `(App Version Code "${appVersionCode}") hasn't been generated yet. ` +
                "Google Play publishes dimension files like _app_version.csv a few days after " +
                "the month ends. Check back at the start of next month.",
              false,
            );
          }
          throw new CapabilityError(
            "google-play",
            `No install statistics found for app version code "${appVersionCode}" in ` +
              `${candidates.join(", ")}. If this version was released recently, ` +
              "Google Play won't publish its install report until after the month ends.",
            false,
          );
        }
        throw new CapabilityError(
          "google-play",
          `Install statistics are not yet available for ${primary}. ` +
            "Google Play publishes monthly install reports a few days after the month ends. " +
            "If you are expecting data, ensure your service account has bulk report access in Play Console Users and permissions, " +
            "and that the app has been live for at least one full month.",
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
