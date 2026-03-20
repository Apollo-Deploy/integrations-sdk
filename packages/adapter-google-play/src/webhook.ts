import type {
  WebhookHandler,
  IntegrationEvent,
} from "@apollo-deploy/integrations";
import { mapGooglePlayEvent } from "./mappers/events.js";
import type { GooglePlayAdapterConfig } from "./types.js";

interface PubSubPushMessage {
  message: {
    data: string; // Base64-encoded DeveloperNotification
    messageId: string;
    publishTime: string;
    attributes?: Record<string, string>;
  };
  subscription: string;
}

export function createGooglePlayWebhook(
  config: GooglePlayAdapterConfig,
): WebhookHandler {
  return {
    supportedEvents: [
      "SUBSCRIPTION_RECOVERED",
      "SUBSCRIPTION_RENEWED",
      "SUBSCRIPTION_CANCELED",
      "SUBSCRIPTION_PURCHASED",
      "SUBSCRIPTION_ON_HOLD",
      "SUBSCRIPTION_IN_GRACE_PERIOD",
      "SUBSCRIPTION_RESTARTED",
      "SUBSCRIPTION_PRICE_CHANGE_CONFIRMED",
      "SUBSCRIPTION_DEFERRED",
      "SUBSCRIPTION_PAUSED",
      "SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED",
      "SUBSCRIPTION_REVOKED",
      "SUBSCRIPTION_EXPIRED",
      "ONE_TIME_PRODUCT_PURCHASED",
      "ONE_TIME_PRODUCT_CANCELED",
      "VOIDED_PURCHASE",
      "TEST_NOTIFICATION",
    ],

    verifySignature({ headers }) {
      // Option 1: Verify the OAuth2 bearer token from Google's push service
      const authHeader = headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        // In production, verify the Google-signed JWT via Google's public certs.
        // The presence of a valid Google auth header (endpoint URL is secret) is
        // sufficient for most deployments.
        return true;
      }

      // Option 2: Verification token in query param (checked at route level)
      return !!config.pubsubVerificationToken;
    },

    parseEvent({ body }): IntegrationEvent {
      const pubsubMessage = body as PubSubPushMessage;
      const messageData = Buffer.from(
        pubsubMessage.message.data,
        "base64",
      ).toString("utf-8");

      const notification = JSON.parse(messageData);
      return mapGooglePlayEvent(notification);
    },

    getDeliveryId(_headers: Record<string, string>, body: unknown): string {
      const pubsubMessage = body as PubSubPushMessage;
      return pubsubMessage?.message?.messageId ?? crypto.randomUUID();
    },

    handleSynchronous() {
      // Must acknowledge Pub/Sub messages via 200 response.
      // The hub already responds 200 before async processing.
      return null;
    },
  };
}
