import type { IntegrationEvent } from "@apollo-deploy/integrations";

const EVENT_MAP: Record<string, string> = {
  BUILD_UPLOAD_STATE_CHANGE: "build.status_changed",
  BUILD_BETA_STATE_CHANGE: "beta.status_changed",
  APP_VERSION_STATE_CHANGE: "release.status_changed",
  TESTFLIGHT_FEEDBACK: "feedback.received",
  BACKGROUND_ASSET_STATE_CHANGE: "asset.status_changed",
};

export function mapAppleEvent(payload: {
  type: string;
  data: { id: string; type: string; attributes: Record<string, unknown> };
}): IntegrationEvent {
  return {
    id: crypto.randomUUID(),
    provider: "apple",
    providerEventType: payload.type,
    domain: "app-store",
    eventType: EVENT_MAP[payload.type] ?? payload.type.toLowerCase(),
    timestamp: new Date(),
    correlationId: crypto.randomUUID(),
    connectionId: "",
    data: payload.data,
  };
}
