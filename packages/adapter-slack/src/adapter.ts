import { defineAdapter } from '@apollo-deploy/integrations';
import { createSlackOAuth } from './oauth.js';
import { createSlackWebhook } from './webhook.js';
import { createSlackMessaging } from './capabilities/messaging.js';
import type { SlackAdapterConfig } from './types.js';

export const createSlackAdapter = defineAdapter<SlackAdapterConfig>({
  id: 'slack',
  name: 'Slack',
  capabilities: ['messaging'] as const,

  tokenMetadata: {
    // Slack tokens don't expire unless token rotation is enabled;
    // set to null to skip automatic scheduling.
    expiresInSeconds: null,
    refreshable: false,
    rotatesRefreshToken: false,
    requiresRefreshLock: false,
  },

  createOAuthHandler: (config) => createSlackOAuth(config),
  createWebhookHandler: (config) => createSlackWebhook(config),
  createMessaging: (config) => createSlackMessaging(config),
});
