import { defineAdapter } from '@apollo-deploy/integrations';
import { createGooglePlayOAuth } from './oauth.js';
import { createGooglePlayWebhook } from './webhook.js';
import { createGooglePlayAppStore } from './capabilities/app-store.js';
import type { GooglePlayAdapterConfig } from './types.js';

export const createGooglePlayAdapter = defineAdapter<GooglePlayAdapterConfig>({
  id: 'google-play',
  name: 'Google Play Console',
  capabilities: ['app-store'] as const,

  tokenMetadata: {
    expiresInSeconds: 3600,       // 1 hour (Google access tokens)
    refreshable: true,            // Hub schedules refresh at 80% (48 min)
    rotatesRefreshToken: false,
    requiresRefreshLock: false,
  },

  createOAuthHandler: (config) => createGooglePlayOAuth(config),
  createWebhookHandler: (config) => createGooglePlayWebhook(config),
  createAppStore: (config) => createGooglePlayAppStore(config),
});
