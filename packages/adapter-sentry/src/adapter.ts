/**
 * Sentry adapter factory.
 *
 * Authentication: static auth token (Bearer) or OAuth 2.0.
 * Token model: static tokens never expire; OAuth tokens expire in ~30 days.
 * Auth method: api_key (static token) or oauth2 (internal/public integration).
 *
 * Mode selection at runtime:
 *   - clientId + clientSecret provided → full OAuth 2.0 authorization-code flow
 *   - only authToken provided          → static Bearer token (no redirect)
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
      method: "oauth2" as const,
      fields: [
        {
          key: "authToken",
          label: "Auth Token",
          type: "password" as const,
          required: false,
          placeholder: "sntrys_...",
          helpText:
            "Static token mode: generate at Sentry → Settings → Auth Tokens. " +
            "Required scopes: org:read, project:read, event:read, alerts:read, releases. " +
            "Use this instead of OAuth 2.0 when you don't need per-user authorization.",
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
    // OAuth tokens expire in ~30 days; static auth tokens never expire.
    // expiresInSeconds reflects the OAuth2 case. The static-token handler
    // always throws TokenRefreshError(false) so the hub will not retry.
    expiresInSeconds: 2592000,
    refreshable: true,
    rotatesRefreshToken: false,
    requiresRefreshLock: false,
  },

  createOAuthHandler: (config) => createSentryOAuth(config),
  createWebhookHandler: (config) => createSentryWebhook(config),
  createMonitoring: (config) => createSentryMonitoring(config),
});
