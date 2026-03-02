import { createHmac, timingSafeEqual } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import type { WebhookHandler, IntegrationEvent } from '@apollo-deploy/integrations';
import type { JiraAdapterConfig } from './types.js';

const EVENT_MAP: Record<string, string> = {
  'jira:issue_created': 'issue.created',
  'jira:issue_updated': 'issue.updated',
  'jira:issue_deleted': 'issue.deleted',
  'comment_created': 'issue.comment_added',
  'comment_updated': 'issue.comment_updated',
  'sprint_created': 'sprint.created',
  'sprint_updated': 'sprint.updated',
};

export function createJiraWebhook(_config: JiraAdapterConfig): WebhookHandler {
  return {
    supportedEvents: ['jira:issue_created', 'jira:issue_updated', 'jira:issue_deleted', 'comment_created'],

    verifySignature({ rawBody, headers, secret }) {
      if (!secret) {return false;}
      const sig = headers['x-hub-signature'];
      if (!sig) {return false;}
      const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
      try {
        return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
      } catch {
        return false;
      }
    },

    parseEvent({ body }): IntegrationEvent {
      const b = body as Record<string, unknown>;
      const webhookEvent = b['webhookEvent'] as string ?? 'unknown';
      const normalized = EVENT_MAP[webhookEvent] ?? webhookEvent;
      const user = b['user'] as Record<string, unknown> | undefined;

      return {
        id: randomUUID(),
        provider: 'jira',
        providerEventType: webhookEvent,
        domain: 'issue-tracking',
        eventType: normalized,
        timestamp: new Date(),
        correlationId: randomUUID(),
        connectionId: '',
        actor: user
          ? { id: (user['accountId'] as string) ?? '', name: (user['displayName'] as string) ?? '' }
          : undefined,
        data: b,
      };
    },

    getDeliveryId(headers) {
      return headers['x-atlassian-webhook-identifier'] ?? `jira:${Date.now()}`;
    },

    handleSynchronous() { return null; },
  };
}
