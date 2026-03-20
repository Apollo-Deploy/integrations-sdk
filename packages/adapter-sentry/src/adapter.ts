/**
 * Sentry adapter factory.
 *
 * Authentication: static auth token (Bearer) or OAuth 2.0.
 * Token model: static tokens never expire; OAuth tokens expire in ~8h.
 * Auth method: api_key (static token) or oauth2 (internal integration).
 *
 * Capabilities: monitoring (errors, vitals, logs, replays, releases, alerts, crons).
 */

import { defineAdapter } from "@apollo-deploy/integrations";
import { createSentryOAuth } from "./oauth.js";
import { createSentryWebhook } from "./webhook.js";
import { createSentryMonitoring } from "./capabilities/index.js";
import type { SentryAdapterConfig } from "./types.js";

export const createSentryAdapter = defineAdapter<SentryAdapterConfig>({
  id: "sentry",
  name: "Sentry",
  metadata: {
    description:
      "Monitor crashes, performance vitals, logs, replays, and alerts from Sentry.",
    category: "Monitoring",
    dateAdded: "2026-03-20",
    iconUrl: {
      light: "https://static.apollodeploy.com/icons/sentry-light.png",
      dark: "https://static.apollodeploy.com/icons/sentry-dark.png",
    },
    websiteUrl: "https://sentry.io",
    docsUrl: "https://docs.sentry.io/api/",
    auth: {
      method: "api_key" as const,
      credentialInputs: [
        {
          key: "authToken",
          label: "Auth Token",
          type: "password" as const,
          required: true,
          placeholder: "sntrys_...",
          helpText:
            "Generate at Sentry → Settings → Auth Tokens. Required scopes: org:read, project:read, event:read, alerts:read, releases.",
        },
        {
          key: "defaultOrgSlug",
          label: "Organization Slug",
          type: "text" as const,
          required: false,
          placeholder: "my-company",
          helpText:
            "Default organization slug used when not specified in method calls.",
        },
        {
          key: "baseUrl",
          label: "Base URL (self-hosted only)",
          type: "url" as const,
          required: false,
          placeholder: "https://sentry.example.com",
          helpText:
            "Leave blank for Sentry.io (cloud). Set this for self-hosted Sentry instances.",
        },
      ],
    },
  },
  capabilities: ["monitoring"] as const,

  tokenMetadata: {
    // Static auth tokens do not expire. OAuth tokens expire in ~8h.
    expiresInSeconds: null,
    refreshable: false,
    rotatesRefreshToken: false,
    requiresRefreshLock: false,
  },

  createOAuthHandler: (config) => createSentryOAuth(config),
  createWebhookHandler: (config) => createSentryWebhook(config),
  createMonitoring: (config) => createSentryMonitoring(config),
});
