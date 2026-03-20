/**
 * Sentry error mapper — translates raw Sentry API errors to CapabilityError.
 */
import { CapabilityError } from "@apollo-deploy/integrations";

interface SentryApiError {
  detail?: string;
  message?: string;
}

export function mapSentryError(err: unknown): CapabilityError {
  if (err instanceof CapabilityError) return err;

  if (
    err instanceof Response ||
    (err != null && typeof err === "object" && "status" in err)
  ) {
    const r = err as { status: number; statusText?: string };
    const retryable = r.status === 429 || r.status >= 500;
    return new CapabilityError(
      "sentry",
      `Sentry API error ${String(r.status)}: ${r.statusText ?? "Unknown"}`,
      retryable,
    );
  }

  return new CapabilityError("sentry", String(err), false);
}

export async function assertOk(resp: Response, context: string): Promise<void> {
  if (!resp.ok) {
    let detail: string;
    try {
      const body = (await resp.json()) as SentryApiError;
      detail = body.detail ?? body.message ?? "";
    } catch {
      detail = await resp.text().catch(() => "");
    }
    const retryable = resp.status === 429 || resp.status >= 500;
    throw new CapabilityError(
      "sentry",
      `${context}: HTTP ${String(resp.status)}${detail !== "" ? ` — ${detail}` : ""}`,
      retryable,
    );
  }
}
