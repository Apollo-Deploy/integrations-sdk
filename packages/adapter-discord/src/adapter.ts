import { defineAdapter } from '@apollo-deploy/integrations';
import { createDiscordOAuth } from './oauth.js';
import { createDiscordWebhook } from './webhook.js';
import { createDiscordMessaging } from './capabilities/messaging.js';
import type { DiscordAdapterConfig } from './types.js';

export const createDiscordAdapter = defineAdapter<DiscordAdapterConfig>({
  id: 'discord',
  name: 'Discord',
  capabilities: ['messaging'] as const,

  tokenMetadata: {
    expiresInSeconds: null, // bot tokens never expire
    refreshable: false,
    rotatesRefreshToken: false,
    requiresRefreshLock: false,
  },

  createOAuthHandler: (config) => createDiscordOAuth(config),
  createWebhookHandler: (config) => createDiscordWebhook(config),
  createMessaging: (config) => createDiscordMessaging(config),
});
