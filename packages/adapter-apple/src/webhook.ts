import crypto from "node:crypto";
import type {
  WebhookHandler,
  IntegrationEvent,
} from "@apollo-deploy/integrations";
import { mapAppleEvent } from "./mappers/events.js";
import type { AppleAdapterConfig } from "./types.js";

interface AppleWebhookPayload {
  type: string;
  data: {
    id: string;
    type: string;
    attributes: Record<string, unknown>;
    relationships?: Record<string, unknown>;
  };
}

export function createAppleWebhook(config: AppleAdapterConfig): WebhookHandler {
  return {
    supportedEvents: [
      "BUILD_UPLOAD_STATE_CHANGE",
      "BUILD_BETA_STATE_CHANGE",
      "APP_VERSION_STATE_CHANGE",
      "TESTFLIGHT_FEEDBACK",
      "BACKGROUND_ASSET_STATE_CHANGE",
    ],

    verifySignature({ rawBody, headers, secret }) {
      const signature =
        headers["x-apple-signature"] ?? headers["x-appstoreconnect-signature"];
      if (!signature) return false;

      const webhookSecret = secret || config.webhookSecret;
      if (!webhookSecret) return false;

      const expected = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex");

      try {
        return crypto.timingSafeEqual(
          Buffer.from(signature),
          Buffer.from(expected),
        );
      } catch {
        return false;
      }
    },

    parseEvent({ body }): IntegrationEvent {
      const event = body as AppleWebhookPayload;
      return mapAppleEvent(event);
    },

    getDeliveryId(headers: Record<string, string>) {
      return headers["x-apple-delivery-id"] ?? crypto.randomUUID();
    },

    handleSynchronous() {
      return null;
    },
  };
}
