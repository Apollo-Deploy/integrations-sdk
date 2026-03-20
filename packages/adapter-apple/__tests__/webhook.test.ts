import { describe, test, expect } from "bun:test";
import crypto from "node:crypto";
import { createAppleWebhook } from "../src/webhook";

const WEBHOOK_SECRET = "test-secret-abc123";

function signBody(body: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(Buffer.from(body))
    .digest("hex");
}

describe("createAppleWebhook", () => {
  const handler = createAppleWebhook({
    issuerId: "i",
    keyId: "k",
    privateKey: "",
    webhookSecret: WEBHOOK_SECRET,
  });

  test("verifySignature accepts valid HMAC-SHA256 signature", () => {
    const rawBody = Buffer.from(
      '{"type":"BUILD_UPLOAD_STATE_CHANGE","data":{}}',
    );
    const sig = signBody(rawBody.toString(), WEBHOOK_SECRET);

    const result = handler.verifySignature({
      rawBody,
      headers: { "x-apple-signature": sig },
      secret: WEBHOOK_SECRET,
    });
    expect(result).toBe(true);
  });

  test("verifySignature rejects tampered body", () => {
    const rawBody = Buffer.from("tampered-body");
    const sig = signBody("original-body", WEBHOOK_SECRET);

    const result = handler.verifySignature({
      rawBody,
      headers: { "x-apple-signature": sig },
      secret: WEBHOOK_SECRET,
    });
    expect(result).toBe(false);
  });

  test("verifySignature rejects missing signature", () => {
    const rawBody = Buffer.from("{}");
    const result = handler.verifySignature({
      rawBody,
      headers: {},
      secret: WEBHOOK_SECRET,
    });
    expect(result).toBe(false);
  });

  test("parseEvent maps BUILD_UPLOAD_STATE_CHANGE to build.status_changed", () => {
    const body = {
      type: "BUILD_UPLOAD_STATE_CHANGE",
      data: {
        id: "build-123",
        type: "builds",
        attributes: { processingState: "VALID" },
      },
    };
    const event = handler.parseEvent({ body, headers: {} });

    expect(event.provider).toBe("apple");
    expect(event.providerEventType).toBe("BUILD_UPLOAD_STATE_CHANGE");
    expect(event.eventType).toBe("build.status_changed");
    expect(event.domain).toBe("app-store");
  });

  test("parseEvent maps APP_VERSION_STATE_CHANGE to release.status_changed", () => {
    const body = {
      type: "APP_VERSION_STATE_CHANGE",
      data: { id: "v-456", type: "appStoreVersions", attributes: {} },
    };
    const event = handler.parseEvent({ body, headers: {} });
    expect(event.eventType).toBe("release.status_changed");
  });

  test("getDeliveryId returns x-apple-delivery-id when present", () => {
    const id = handler.getDeliveryId(
      { "x-apple-delivery-id": "delivery-abc" },
      {},
    );
    expect(id).toBe("delivery-abc");
  });

  test("getDeliveryId generates UUID when header is absent", () => {
    const id = handler.getDeliveryId({}, {});
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("supportedEvents includes expected types", () => {
    expect(handler.supportedEvents).toContain("BUILD_UPLOAD_STATE_CHANGE");
    expect(handler.supportedEvents).toContain("APP_VERSION_STATE_CHANGE");
    expect(handler.supportedEvents).toContain("TESTFLIGHT_FEEDBACK");
  });
});
