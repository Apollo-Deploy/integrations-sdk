import { describe, test, expect } from "bun:test";
import { createGooglePlayWebhook } from "../src/webhook";

const VERIFICATION_TOKEN = "test-pubsub-token-xyz";

function makePubSubMessage(notification: object): object {
  const data = Buffer.from(JSON.stringify(notification)).toString("base64");
  return {
    message: {
      data,
      messageId: "msg-12345",
      publishTime: "2026-03-02T10:00:00Z",
    },
    subscription: "projects/my-project/subscriptions/deploy-play-sub",
  };
}

describe("createGooglePlayWebhook", () => {
  const handler = createGooglePlayWebhook({
    serviceAccountCredentials: {
      type: "service_account",
      project_id: "p",
      private_key_id: "k",
      private_key: "",
      client_email: "e@p.iam.gserviceaccount.com",
      client_id: "1",
      auth_uri: "",
      token_uri: "",
    },
    pubsubVerificationToken: VERIFICATION_TOKEN,
  });

  test("verifySignature accepts Google Bearer token", () => {
    const result = handler.verifySignature({
      rawBody: Buffer.from("{}"),
      headers: { authorization: "Bearer some-google-jwt-token" },
      secret: "",
    });
    expect(result).toBe(true);
  });

  test("verifySignature falls back to pubsubVerificationToken", () => {
    const result = handler.verifySignature({
      rawBody: Buffer.from("{}"),
      headers: {},
      secret: "",
    });
    expect(result).toBe(true);
  });

  test("verifySignature rejects when no auth and no token configured", () => {
    const handlerNoToken = createGooglePlayWebhook({
      serviceAccountCredentials: {
        type: "service_account",
        project_id: "p",
        private_key_id: "k",
        private_key: "",
        client_email: "e@p.iam.gserviceaccount.com",
        client_id: "1",
        auth_uri: "",
        token_uri: "",
      },
    });
    const result = handlerNoToken.verifySignature({
      rawBody: Buffer.from("{}"),
      headers: {},
      secret: "",
    });
    expect(result).toBe(false);
  });

  test("parseEvent decodes base64 Pub/Sub envelope and maps subscription notification", () => {
    const notification = {
      packageName: "com.example.app",
      eventTimeMillis: "1740000000000",
      subscriptionNotification: {
        version: "1.0",
        notificationType: 4, // SUBSCRIPTION_PURCHASED
        purchaseToken: "tok-abc",
      },
    };

    const body = makePubSubMessage(notification);
    const event = handler.parseEvent({ body, headers: {} });

    expect(event.provider).toBe("google-play");
    expect(event.eventType).toBe("subscription.purchased");
    expect(event.domain).toBe("app-store");
    expect((event.data as any).packageName).toBe("com.example.app");
    expect((event.data as any).purchaseToken).toBe("tok-abc");
  });

  test("parseEvent maps test notification", () => {
    const notification = {
      packageName: "com.example.app",
      eventTimeMillis: "1740000000000",
      testNotification: { version: "1.0" },
    };
    const body = makePubSubMessage(notification);
    const event = handler.parseEvent({ body, headers: {} });
    expect(event.eventType).toBe("test");
  });

  test("parseEvent maps voided purchase notification", () => {
    const notification = {
      packageName: "com.example.app",
      eventTimeMillis: "1740000000000",
      voidedPurchaseNotification: {
        purchaseToken: "tok-void",
        orderId: "order-001",
        productType: 1,
      },
    };
    const body = makePubSubMessage(notification);
    const event = handler.parseEvent({ body, headers: {} });
    expect(event.eventType).toBe("purchase.voided");
  });

  test("getDeliveryId returns messageId from Pub/Sub envelope", () => {
    const body = makePubSubMessage({ packageName: "x", eventTimeMillis: "0" });
    const id = handler.getDeliveryId({}, body);
    expect(id).toBe("msg-12345");
  });

  test("supportedEvents includes subscription and one-time product types", () => {
    expect(handler.supportedEvents).toContain("SUBSCRIPTION_PURCHASED");
    expect(handler.supportedEvents).toContain("ONE_TIME_PRODUCT_PURCHASED");
    expect(handler.supportedEvents).toContain("TEST_NOTIFICATION");
    expect(handler.supportedEvents).toContain("VOIDED_PURCHASE");
  });
});
