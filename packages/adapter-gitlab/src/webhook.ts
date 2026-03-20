import { timingSafeEqual } from "node:crypto";
import { randomUUID } from "node:crypto";
import type { WebhookHandler } from "@apollo-deploy/integrations";
import type { GitlabAdapterConfig } from "./types.js";

// GitLab uses a shared secret token header comparison — no HMAC, just constant-time equality
const GITLAB_EVENT_DOMAIN_MAP: Record<
  string,
  "source-control" | "issue-tracking" | "ci-cd"
> = {
  Push: "source-control",
  "Push Hook": "source-control",
  "Tag Push Hook": "source-control",
  "Merge Request Hook": "source-control",
  "Merge Request": "source-control",
  "Note Hook": "issue-tracking",
  "Confidential Note Hook": "issue-tracking",
  "Issue Hook": "issue-tracking",
  "Confidential Issues Hook": "issue-tracking",
  "Pipeline Hook": "ci-cd",
  "Job Hook": "ci-cd",
  "Release Hook": "source-control",
  "Deployment Hook": "ci-cd",
};

export function createGitlabWebhook(
  _config: GitlabAdapterConfig,
): WebhookHandler {
  return {
    supportedEvents: Object.keys(GITLAB_EVENT_DOMAIN_MAP),

    verifySignature({ headers, secret }) {
      const token = headers["x-gitlab-token"];
      if (token === "" || secret === "") return false;
      try {
        return timingSafeEqual(Buffer.from(token), Buffer.from(secret));
      } catch {
        return false;
      }
    },

    parseEvent({ body, headers }) {
      const b = body as Record<string, unknown>;
      const eventName = headers["x-gitlab-event"] ?? "unknown";
      const domain = GITLAB_EVENT_DOMAIN_MAP[eventName] ?? "source-control";
      const actionKind = (b.object_attributes as Record<string, unknown>)
        .action as string | undefined;
      const eventType =
        actionKind != null && actionKind !== ""
          ? `${eventName.toLowerCase().replace(/ /g, "_")}.${actionKind}`
          : eventName.toLowerCase().replace(/ /g, "_");

      return {
        id: randomUUID(),
        provider: "gitlab",
        providerEventType: eventName,
        domain,
        eventType,
        timestamp: new Date(
          (b.created_at as string | undefined) ?? String(Date.now()),
        ),
        correlationId: headers["x-gitlab-event-uuid"] ?? randomUUID(),
        connectionId: "",
        data: b,
      };
    },

    getDeliveryId(headers) {
      return headers["x-gitlab-event-uuid"] ?? `gitlab:${String(Date.now())}`;
    },

    handleSynchronous() {
      return null;
    },
  };
}
