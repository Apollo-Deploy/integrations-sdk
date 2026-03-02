import { defineAdapter } from '@apollo-deploy/integrations';
import { createAppleOAuth } from './oauth.js';
import { createAppleWebhook } from './webhook.js';
import { createAppleAppStore } from './capabilities/app-store.js';
import type { AppleAdapterConfig } from './types.js';

export const createAppleAdapter = defineAdapter<AppleAdapterConfig>({
  id: 'apple',
  name: 'Apple App Store Connect',
  capabilities: ['app-store'] as const,

  tokenMetadata: {
    expiresInSeconds: 1200,       // 20 minutes max
    refreshable: false,           // NOT refreshable — regenerate JWT each time
    rotatesRefreshToken: false,
    requiresRefreshLock: false,
  },

  createOAuthHandler: (config) => createAppleOAuth(config),
  createWebhookHandler: (config) => createAppleWebhook(config),
  createAppStore: (config) => createAppleAppStore(config),
});
