import { randomUUID, createVerify } from 'node:crypto';
import type { WebhookHandler } from '@apollo-deploy/integrations';
import type { DiscordAdapterConfig } from './types.js';

/**
 * Discord uses Ed25519 asymmetric signature verification.
 * The raw body + timestamp are signed with the app's private key.
 * Response to PING interactions must echo { type: 1 }.
 */
export function createDiscordWebhook(config: DiscordAdapterConfig): WebhookHandler {
  return {
    supportedEvents: ['APPLICATION_COMMAND', 'MESSAGE_COMPONENT', 'MODAL_SUBMIT', 'GUILD_MEMBER_ADD', 'GUILD_MEMBER_REMOVE', 'CHANNEL_CREATE'],

    verifySignature({ rawBody, headers }) {
      const signature = headers['x-signature-ed25519'] as string;
      const timestamp = headers['x-signature-timestamp'] as string;
      if (!signature || !timestamp) return false;
      try {
        const verify = createVerify('ed25519');
        verify.update(timestamp + rawBody.toString());
        const publicKeyHex = config.publicKey.match(/.{2}/g)!.map((h) => parseInt(h, 16));
        const publicKeyDer = Buffer.from([
          // SubjectPublicKeyInfo DER prefix for Ed25519
          0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
          ...publicKeyHex,
        ]);
        return verify.verify({ key: publicKeyDer, format: 'der', type: 'spki' }, Buffer.from(signature, 'hex'));
      } catch {
        return false;
      }
    },

    parseEvent({ body, headers }) {
      const b = body as Record<string, unknown>;
      const interactionType = b['type'] as number;
      const eventType = interactionType === 1 ? 'ping' : interactionType === 2 ? 'application_command' : 'interaction';

      return {
        id: randomUUID(),
        provider: 'discord',
        providerEventType: String(interactionType),
        domain: 'messaging',
        eventType,
        timestamp: new Date(),
        correlationId: (headers['x-discord-application-id'] as string) ?? randomUUID(),
        connectionId: '',
        data: b,
      };
    },

    getDeliveryId(headers) {
      return (headers['x-discord-application-id'] as string) ?? `discord:${Date.now()}`;
    },

    handleSynchronous({ body }) {
      const b = body as Record<string, unknown>;
      // PING — must respond with type 1 immediately
      if (b['type'] === 1) {
        return { statusCode: 200, body: JSON.stringify({ type: 1 }), skipAsyncProcessing: true };
      }
      return null;
    },
  };
}
