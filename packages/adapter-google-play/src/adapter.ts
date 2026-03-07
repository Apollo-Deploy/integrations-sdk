import { defineAdapter } from '@apollo-deploy/integrations';
import { createGooglePlayOAuth } from './oauth.js';
import { createGooglePlayWebhook } from './webhook.js';
import { createGooglePlayAppStore } from './capabilities/index.js';
import type { GooglePlayAdapterConfig } from './types.js';
import type { AdapterAuthConfig } from '@apollo-deploy/integrations';

const auth: AdapterAuthConfig = {
  method: 'api_key',
  setupFlow: 'credential_form',
  credentialInputs: [
    {
      key: 'serviceAccountJson',
      label: 'Service Account JSON',
      type: 'textarea',
      required: true,
      placeholder: '{\n  "type": "service_account",\n  "project_id": "...",\n  ...\n}',
      helpText: 'Paste the full JSON key file for a Google Cloud service account with Google Play Developer API access.',
    },
  ],
};

export const createGooglePlayAdapter = defineAdapter<GooglePlayAdapterConfig>({
  id: 'google-play',
  name: 'Google Play Console',
  metadata: {
    description: 'Manage Android app releases, tracks, and rollouts via the Google Play Developer API.',
    category: 'App Stores',
    dateAdded: '2024-06-15',
    iconUrl: {
      light: "https://cdn.apollodeploy.com/integrations/google_play_integration_light.svg",
      dark: "https://cdn.apollodeploy.com/integrations/google_play_integration_dark.svg",
    },
    websiteUrl: 'https://play.google.com/console',
    docsUrl: 'https://developers.google.com/android-publisher',
    auth,
  },
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
