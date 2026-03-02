import { createHmac, timingSafeEqual } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import type { WebhookHandler } from '@apollo-deploy/integrations';
import type { LinearAdapterConfig } from './types.js';

export function createLinearWebhook(config: LinearAdapterConfig): WebhookHandler {
  return {
    supportedEvents: ['Issue', 'Comment', 'Project', 'ProjectUpdate', 'Cycle', 'Reaction'],

    verifySignature({ rawBody, headers, secret }) {
      const signingSecret = secret || config.webhookSecret;
      const sig = headers['linear-signature'];
      if (!sig) return false;
      const expected = createHmac('sha256', signingSecret).update(rawBody).digest('hex');
      try {
        return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
      } catch {
        return false;
      }
    },

    parseEvent({ body }) {
      const b = body as Record<string, unknown>;
      const type = b['type'] as string ?? 'unknown';
      const action = b['action'] as string ?? '';
      const eventType = action ? `${type.toLowerCase()}.${action}` : type.toLowerCase();

      return {
        id: randomUUID(),
        provider: 'linear',
        providerEventType: `${type}.${action}`,
        domain: 'issue-tracking',
        eventType,
        timestamp: new Date((b['createdAt'] as string) ?? Date.now()),
        correlationId: randomUUID(),
        connectionId: '',
        data: b,
      };
    },

    getDeliveryId(headers) {
      return headers['linear-delivery'] ?? `linear:${Date.now()}`;
    },

    handleSynchronous() { return null; },
  };
}
