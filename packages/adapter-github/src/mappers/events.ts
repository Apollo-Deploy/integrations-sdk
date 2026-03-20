/**
 * GitHub inbound webhook event → normalized IntegrationEvent mapper.
 */
import { randomUUID } from "node:crypto";
import type { IntegrationEvent } from "@apollo-deploy/integrations";

const EVENT_TYPE_MAP: Record<string, string> = {
  push: "push",
  "pull_request.opened": "pull_request.created",
  "pull_request.closed": "pull_request.closed",
  "pull_request.merged": "pull_request.merged",
  "pull_request.reopened": "pull_request.reopened",
  "pull_request.synchronize": "pull_request.updated",
  "pull_request_review.submitted": "pull_request_review.submitted",
  deployment: "deployment.created",
  deployment_status: "deployment.status_updated",
  "release.published": "release.published",
  "workflow_run.completed": "workflow_run.completed",
  "check_run.completed": "check_run.completed",
  status: "commit_status.updated",
  create: "ref.created",
  delete: "ref.deleted",
};

// eslint-disable-next-line max-params -- required parameters for this utility function
export function mapGithubEvent(
  fullType: string,
  body: unknown,
  connectionId = "",
  projectId?: string,
): IntegrationEvent {
  const b = body as Record<string, unknown>;
  const normalized = EVENT_TYPE_MAP[fullType] ?? fullType;

  const actor =
    b.sender != null
      ? {
          id: String((b.sender as Record<string, unknown>).id),
          name: String((b.sender as Record<string, unknown>).login),
          avatarUrl: (b.sender as Record<string, unknown>).avatar_url as
            | string
            | undefined,
        }
      : undefined;

  return {
    id: randomUUID(),
    provider: "github",
    providerEventType: fullType,
    domain: "source-control",
    eventType: normalized,
    timestamp: new Date(),
    correlationId: randomUUID(),
    connectionId,
    projectId,
    actor,
    data: b,
  };
}
