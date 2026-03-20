import type { IntegrationEvent } from "@apollo-deploy/integrations";

const SUBSCRIPTION_TYPES: Record<number, string> = {
  1: "subscription.recovered",
  2: "subscription.renewed",
  3: "subscription.canceled",
  4: "subscription.purchased",
  5: "subscription.on_hold",
  6: "subscription.in_grace_period",
  7: "subscription.restarted",
  8: "subscription.price_change_confirmed",
  9: "subscription.deferred",
  10: "subscription.paused",
  11: "subscription.pause_schedule_changed",
  12: "subscription.revoked",
  13: "subscription.expired",
};

const OTP_TYPES: Record<number, string> = {
  1: "purchase.one_time_purchased",
  2: "purchase.one_time_canceled",
};

interface GooglePlayDeveloperNotification {
  version?: string;
  packageName: string;
  eventTimeMillis: string;
  subscriptionNotification?: {
    version: string;
    notificationType: number;
    purchaseToken: string;
  };
  oneTimeProductNotification?: {
    version: string;
    notificationType: number;
    purchaseToken: string;
    sku: string;
  };
  voidedPurchaseNotification?: {
    purchaseToken: string;
    orderId: string;
    productType: number;
  };
  testNotification?: {
    version: string;
  };
}

export function mapGooglePlayEvent(
  notification: GooglePlayDeveloperNotification,
): IntegrationEvent {
  let eventType = "unknown";
  let data: Record<string, unknown> = {};

  if (notification.testNotification) {
    eventType = "test";
    data = { version: notification.testNotification.version };
  } else if (notification.subscriptionNotification) {
    const sub = notification.subscriptionNotification;
    eventType =
      SUBSCRIPTION_TYPES[sub.notificationType] ??
      `subscription.type_${sub.notificationType}`;
    data = { purchaseToken: sub.purchaseToken };
  } else if (notification.oneTimeProductNotification) {
    const otp = notification.oneTimeProductNotification;
    eventType =
      OTP_TYPES[otp.notificationType] ??
      `purchase.type_${otp.notificationType}`;
    data = { purchaseToken: otp.purchaseToken, sku: otp.sku };
  } else if (notification.voidedPurchaseNotification) {
    eventType = "purchase.voided";
    data = {
      purchaseToken: notification.voidedPurchaseNotification.purchaseToken,
      orderId: notification.voidedPurchaseNotification.orderId,
    };
  }

  return {
    id: crypto.randomUUID(),
    provider: "google-play",
    providerEventType: eventType,
    domain: "app-store",
    eventType,
    timestamp: new Date(Number(notification.eventTimeMillis)),
    correlationId: crypto.randomUUID(),
    connectionId: "",
    data: {
      packageName: notification.packageName,
      ...data,
    },
  };
}
