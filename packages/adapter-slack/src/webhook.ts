/**
 * Slack inbound webhook handler.
 *
 * Security:
 * - HMAC-SHA256 with signing secret.
 * - 5-minute anti-replay window via X-Slack-Request-Timestamp.
 *
 * Synchronous:
 * - url_verification challenge must be answered inline.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  WebhookHandler,
  SynchronousResponse,
} from "@apollo-deploy/integrations";
import { mapSlackEvent } from "./mappers/events.js";
import type { SlackAdapterConfig } from "./types.js";

const REPLAY_WINDOW_SECONDS = 300; // 5 minutes

export function createSlackWebhook(config: SlackAdapterConfig): WebhookHandler {
  return {
    supportedEvents: [
      "message",
      "app_mention",
      "reaction_added",
      "reaction_removed",
      "channel_created",
      "channel_deleted",
      "member_joined_channel",
      "member_left_channel",
      "url_verification",
      "event_callback",
    ],

    verifySignature({ rawBody, headers, secret }) {
      const signingSecret = secret !== "" ? secret : config.signingSecret;
      const timestamp = headers["x-slack-request-timestamp"];
      const signature = headers["x-slack-signature"];

      if (timestamp === "" || signature === "") {
        return false;
      }

      // Anti-replay: reject requests older than 5 minutes
      const tsMs = Number(timestamp) * 1000;
      if (Math.abs(Date.now() - tsMs) > REPLAY_WINDOW_SECONDS * 1000) {
        return false;
      }

      const baseString = `v0:${timestamp}:${rawBody.toString("utf8")}`;
      const expected = `v0=${createHmac("sha256", signingSecret).update(baseString).digest("hex")}`;

      try {
        return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
      } catch {
        return false;
      }
    },

    parseEvent({ body }) {
      const b = body as Record<string, unknown>;
      // Slack sends event type in body.type or body.event.type
      const outerType = b.type as string;
      const eventType =
        outerType === "event_callback"
          ? ((b.event as Record<string, unknown>).type as string)
          : outerType;

      return mapSlackEvent(eventType, body);
    },

    getDeliveryId(headers, body) {
      // Slack has no canonical delivery ID header.
      // Compose one from timestamp + team + event_id.
      const b = body as Record<string, unknown>;
      const ts = headers["x-slack-request-timestamp"] ?? String(Date.now());
      const eventId =
        (b.event_id as string | undefined) ??
        ((b.event as Record<string, unknown> | undefined)?.event_ts as
          | string
          | undefined);
      return `slack:${ts}:${eventId ?? ts}`;
    },

    handleSynchronous({ body }): SynchronousResponse | null {
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
