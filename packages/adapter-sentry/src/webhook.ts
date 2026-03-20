/**
 * Sentry inbound webhook handler.
 *
 * Sentry signs webhook payloads with HMAC-SHA256.
 * Header: `sentry-hook-signature: <hex digest>`
 * Body is signed raw (not base64).
 *
 * Event types (resource + action):
 *   installation.created, installation.deleted
 *   event_alert.triggered
 *   metric_alert.open, metric_alert.resolved, metric_alert.warning
 *   issue.created, issue.resolved, issue.assigned, issue.ignored,
 *   issue.unresolved, issue.archived, issue.escalating
 *   comment.created, comment.updated, comment.deleted
 *   error.created
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { randomUUID } from "node:crypto";
import { WebhookError } from "@apollo-deploy/integrations";
import type {
  WebhookHandler,
  IntegrationEvent,
} from "@apollo-deploy/integrations";
import type { SentryAdapterConfig } from "./types.js";

const DOMAIN_MAP: Record<string, string> = {
  "issue.created": "monitoring",
  "issue.resolved": "monitoring",
  "issue.assigned": "monitoring",
  "issue.ignored": "monitoring",
  "issue.unresolved": "monitoring",
  "issue.archived": "monitoring",
  "issue.escalating": "monitoring",
  "event_alert.triggered": "monitoring",
  "metric_alert.open": "monitoring",
  "metric_alert.resolved": "monitoring",
  "metric_alert.warning": "monitoring",
  "error.created": "monitoring",
  "comment.created": "monitoring",
  "comment.updated": "monitoring",
  "comment.deleted": "monitoring",
  "installation.created": "monitoring",
  "installation.deleted": "monitoring",
};

const NORMALIZED_EVENT_MAP: Record<string, string> = {
  "issue.created": "monitor.issue.created",
  "issue.resolved": "monitor.issue.resolved",
  "issue.assigned": "monitor.issue.assigned",
  "issue.ignored": "monitor.issue.ignored",
  "issue.unresolved": "monitor.issue.unresolved",
  "issue.archived": "monitor.issue.archived",
  "issue.escalating": "monitor.issue.escalating",
  "error.created": "monitor.error.created",
  "event_alert.triggered": "monitor.alert.triggered",
  "metric_alert.open": "monitor.alert.open",
  "metric_alert.resolved": "monitor.alert.resolved",
  "metric_alert.warning": "monitor.alert.warning",
  "comment.created": "monitor.comment.created",
  "comment.updated": "monitor.comment.updated",
  "comment.deleted": "monitor.comment.deleted",
  "installation.created": "monitor.installation.created",
  "installation.deleted": "monitor.installation.deleted",
};

export function createSentryWebhook(
  _config: SentryAdapterConfig,
): WebhookHandler {
  return {
    supportedEvents: Object.keys(NORMALIZED_EVENT_MAP),

    verifySignature({ rawBody, headers, secret }) {
      if (secret === "") return false;
      const signature = headers["sentry-hook-signature"];
      if (signature === "") return false;
      const expected = createHmac("sha256", secret)
        .update(Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody))
        .digest("hex");
      try {
        return timingSafeEqual(
          Buffer.from(signature.toLowerCase()),
          Buffer.from(expected.toLowerCase()),
        );
      } catch {
        return false;
      }
    },

    parseEvent({ body, headers }): IntegrationEvent {
      // Sentry sends: sentry-hook-resource (e.g. 'issue') and action is in the body
      const resource =
        headers["sentry-hook-resource"] !== ""
          ? headers["sentry-hook-resource"]
          : "unknown";
      const b = body as Record<string, unknown>;
      const action = (b.action as string | undefined) ?? "unknown";
      const fullType = `${resource}.${action}`;

      const normalized = NORMALIZED_EVENT_MAP[fullType] ?? fullType;
      const domain = (DOMAIN_MAP[fullType] ?? "monitoring") as "monitoring";

      // Extract actor from the data
      const actor = b.actor as Record<string, unknown> | undefined;
      const actorInfo =
        actor != null
          ? {
              id: (actor.id as string | undefined) ?? "",
              name:
                (actor.name as string | undefined) ??
                (actor.email as string | undefined) ??
                "",
            }
          : undefined;

      return {
        id: randomUUID(),
        provider: "sentry",
        providerEventType: fullType,
        domain,
        eventType: normalized,
        timestamp: new Date(),
        correlationId:
          (headers["sentry-hook-id"] as string | undefined) ?? randomUUID(),
        connectionId: "",
        actor: actorInfo,
        data: b,
      };
    },

    getDeliveryId(headers) {
      const id = headers["sentry-hook-id"];
      if (id === "") {
        throw new WebhookError("sentry", "Missing sentry-hook-id header", 400);
      }
      return id;
    },

    handleSynchronous({ body }) {
      // Sentry sends a url_verification challenge during webhook setup
      const b = body as Record<string, unknown>;
      if (b.type === "url_verification") {
        return {
          statusCode: 200,
          body: { challenge: b.challenge },
          skipAsyncProcessing: true,
        };
      }
      return null;
    },
  };
}
