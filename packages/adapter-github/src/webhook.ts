/**
 * GitHub inbound webhook handler.
 * Signature verification via HMAC-SHA256 (X-Hub-Signature-256).
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { WebhookError } from '@apollo-deploy/integrations';
import type { WebhookHandler } from '@apollo-deploy/integrations';
import { mapGithubEvent } from './mappers/events.js';
import type { GithubAdapterConfig } from './types.js';

export function createGithubWebhook(_config: GithubAdapterConfig): WebhookHandler {
  return {
    supportedEvents: [
      'push',
      'pull_request',
      'pull_request_review',
      'deployment',
      'deployment_status',
      'release',
      'workflow_run',
      'check_run',
      'status',
      'create',
      'delete',
    ],

    verifySignature({ rawBody, headers, secret }) {
      if (!secret) {return false;}
      const signature = headers['x-hub-signature-256'];
      if (!signature?.startsWith('sha256=')) {return false;}
      const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
      try {
        return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
      } catch {
        return false;
      }
    },

    parseEvent({ body, headers }) {
      const eventType = headers['x-github-event'] ?? 'unknown';
      const action = (body as Record<string, unknown>)?.['action'];
      const fullType = action ? `${eventType}.${action}` : eventType;
      return mapGithubEvent(fullType, body);
    },

    getDeliveryId(headers) {
      const id = headers['x-github-delivery'];
      if (!id) {
        throw new WebhookError('github', 'Missing X-GitHub-Delivery header', 400);
      }
      return id;
    },

    handleSynchronous() {
      // GitHub doesn't require synchronous challenge responses
      return null;
    },
  };
}
