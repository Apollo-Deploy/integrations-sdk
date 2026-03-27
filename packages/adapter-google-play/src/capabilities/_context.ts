import { androidpublisher, type androidpublisher_v3 } from "@googleapis/androidpublisher";
import { JWT } from "google-auth-library";
import type { VitalMetricType } from "@apollo-deploy/integrations";
import { CapabilityError } from "@apollo-deploy/integrations";
import type { GooglePlayAdapterConfig } from "../types.js";

const REPORTING_URL = "https://playdeveloperreporting.googleapis.com/v1beta1";
const PUBLISHER_SCOPE = "https://www.googleapis.com/auth/androidpublisher";

export { REPORTING_URL };

export const ALL_TRACKS = ["production", "beta", "alpha", "internal"] as const;

/** Default timeout for fetch-based reporting requests (30 seconds). */
const REPORTING_TIMEOUT_MS = 30_000;

/** Max retries for retryable errors (429, 5xx). Google recommends n=5. */
const MAX_RETRIES = 5;

type AndroidPublisherClient = androidpublisher_v3.Androidpublisher;

export interface GooglePlayContext {
  config: GooglePlayAdapterConfig;
  client: AndroidPublisherClient;
  getAccessToken(): Promise<string>;
  publisherRequest<T>(request: Promise<{ data: T }>): Promise<T>;
  publisherError(error: unknown, prefix?: string): CapabilityError;
  reportingRequest<T = any>(url: string, init?: RequestInit): Promise<T>;
  withEdit<T>(
    packageName: string,
    fn: (editId: string) => Promise<T>,
    opts?: { commit?: boolean },
  ): Promise<T>;
  vitalsMetricSet(metric: VitalMetricType): string;
  parseTrackVersionId(input: string): { trackName: string; versionCode: string };
}

export function createGooglePlayContext(
  config: GooglePlayAdapterConfig,
): GooglePlayContext {
  const authClient = new JWT({
    email: config.serviceAccountCredentials.client_email,
    key: config.serviceAccountCredentials.private_key,
    scopes: [PUBLISHER_SCOPE],
  });

  async function getAccessToken(): Promise<string> {
    const { token } = await authClient.getAccessToken();
    if (token == null) {
      throw new CapabilityError("google-play", "Failed to obtain access token from Google", false);
    }
    return token;
  }

  const client = androidpublisher({ version: "v3", auth: authClient });

  /**
   * Exponential backoff delay per Google's recommendations:
   * wait = (2^attempt) * 1000 + random(0..1000) ms
   */
  function backoffDelay(attempt: number): number {
    return Math.pow(2, attempt) * 1000 + Math.random() * 1000;
  }

  function publisherError(error: unknown, prefix = "Google Play API"): CapabilityError {
    if (error instanceof CapabilityError) {
      return error;
    }

    const response =
      typeof error === "object" && error !== null
        ? (error as { response?: { status?: number; data?: unknown } }).response
        : undefined;

    const status = response?.status;
    const responseData = response?.data;
    const body =
      typeof responseData === "string"
        ? responseData
        : responseData != null
          ? JSON.stringify(responseData)
          : error instanceof Error
            ? error.message
            : String(error);

    return new CapabilityError(
      "google-play",
      `${prefix} ${status ?? "error"}: ${body}`,
      status === 429 || (status != null && status >= 500),
    );
  }

  async function publisherRequest<T>(request: Promise<{ data: T }>): Promise<T> {
    try {
      const { data } = await request;
      return data;
    } catch (error) {
      throw publisherError(error);
    }
  }

  async function reportingRequest<T = any>(url: string, init?: RequestInit): Promise<T> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      // Re-acquire the token on each attempt so retries don't fail
      // if the original token was near expiry.
      const token = await getAccessToken();

      const res = await fetch(url, {
        ...init,
        signal: init?.signal ?? AbortSignal.timeout(REPORTING_TIMEOUT_MS),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(init?.headers as Record<string, string> | undefined),
        },
      });

      if (res.ok) {
        if (res.status === 204) return null as T;
        return res.json() as Promise<T>;
      }

      const retryable = res.status === 429 || res.status >= 500;
      if (attempt < MAX_RETRIES && retryable) {
        await new Promise((r) => setTimeout(r, backoffDelay(attempt)));
        continue;
      }

      const body = await res.text();
      throw new CapabilityError(
        "google-play",
        `Google Play Reporting API ${res.status}: ${body}`,
        retryable,
      );
    }

    // Unreachable — the loop always returns or throws. Satisfies TS control-flow.
    throw new CapabilityError("google-play", "Reporting request failed after retries", true);
  }

  async function withEdit<T>(
    packageName: string,
    fn: (editId: string) => Promise<T>,
    opts: { commit?: boolean } = {},
  ): Promise<T> {
    const edit = await publisherRequest(
      client.edits.insert({ packageName }),
    );
    const editId = edit.id;
    if (!editId) {
      throw new CapabilityError(
        "google-play",
        "Google Play did not return an edit ID.",
        false,
      );
    }

    try {
      const result = await fn(editId);
      if (opts.commit) {
        await publisherRequest(
          client.edits.commit({ packageName, editId }),
        );
      } else {
        // Fire-and-forget cleanup — no need to wrap through publisherRequest
        // since we discard the result and ignore errors.
        await client.edits.delete({ packageName, editId }).catch(() => {});
      }
      return result;
    } catch (err) {
      await client.edits.delete({ packageName, editId }).catch(() => {});
      throw err;
    }
  }

  function vitalsMetricSet(metric: VitalMetricType): string {
    switch (metric) {
      case "crash_rate":
        return "crashRateMetricSet";
      case "anr_rate":
        return "anrRateMetricSet";
      case "launch_time":
        return "slowStartRateMetricSet";
      case "excessive_wakeups":
        return "excessiveWakeupRateMetricSet";
      case "stuck_background_worker":
        return "stuckBackgroundWakelockRateMetricSet";
      default:
        return "crashRateMetricSet";
    }
  }

  /**
   * Parse a "track:versionCode" composite ID. Throws CapabilityError if malformed.
   * Handles version codes that themselves contain colons (e.g. "production:42:rc1").
   */
  function parseTrackVersionId(input: string): { trackName: string; versionCode: string } {
    const [trackName, ...rest] = input.split(":");
    const versionCode = rest.join(":");
    if (!trackName || !versionCode) {
      throw new CapabilityError(
        "google-play",
        `Expected "track:versionCode" format (e.g. "production:42"), got "${input}".`,
        false,
      );
    }
    return { trackName, versionCode };
  }

  return {
    config,
    client,
    getAccessToken,
    publisherRequest,
    publisherError,
    reportingRequest,
    withEdit,
    vitalsMetricSet,
    parseTrackVersionId,
  };
}
