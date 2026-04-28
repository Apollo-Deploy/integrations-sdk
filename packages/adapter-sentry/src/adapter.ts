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
      light: "https://cdn.apollodeploy.com/integrations/sentry_integration_light.svg",
      dark: "https://cdn.apollodeploy.com/integrations/sentry_integration_dark.svg",
    },
    websiteUrl: "https://sentry.io",
    docsUrl: "https://docs.sentry.io/api/",
  },
  ui: {
    manifest: {
      connection: {
        flows: ["credentials", "oauth"],
        submitLabel: "Connect Sentry",
        fields: [
          {
            key: "authToken",
            label: "Auth Token",
            type: "secret",
            required: false,
            placeholder: "sntrys_...",
            helpText:
              "Static token mode: generate at Sentry → Settings → Auth Tokens. " +
              "Required scopes: org:read, project:read, event:read, alerts:read, releases. " +
              "Use this instead of OAuth 2.0 when you don't need per-user authorization.",
          },
          {
            key: "baseUrl",
            label: "Base URL (self-hosted only)",
            type: "url",
            required: false,
            placeholder: "https://sentry.example.com",
            helpText:
              "Leave blank for Sentry.io (cloud). Set this for self-hosted Sentry instances.",
          },
        ],
      },
      sharedConfig: {
        submitLabel: "Save organization",
        fields: [
          {
            key: "orgSlug",
            label: "Organization",
            type: "text",
            required: true,
            placeholder: "my-company",
            helpText:
              "Organization slug used as the default scope when resolving projects and monitoring data.",
          },
        ],
      },
      resourceConfig: {
        submitLabel: "Save project",
        fields: [
          {
            key: "projectSlug",
            label: "Project",
            type: "select",
            required: true,
            helpText: "Choose which Sentry project to bind to this resource.",
            choiceSource: { key: "projects", pageSize: 100 },
          },
        ],
      },
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
  listChoices: async (config, { monitoring }, sourceKey, ctx) => {
    if (sourceKey !== "projects") {
      throw new Error(`Unknown choice source: ${sourceKey}`);
    }
    if (!monitoring) {
      throw new Error("Sentry adapter does not expose monitoring capability");
    }

    let orgSlug =
      typeof ctx.scope?.orgSlug === "string"
        ? ctx.scope.orgSlug
        : config.defaultOrgSlug;

    if (!orgSlug) {
      const organizations = await monitoring.listOrganizations(ctx.tokens);
      orgSlug = organizations.items[0]?.slug;
    }

    if (!orgSlug) {
      return {
        choices: [],
        hasMore: false,
      };
    }

    const projects = await monitoring.listProjects(ctx.tokens, orgSlug);

    return {
      choices: projects.items.map((project) => ({
        value: project.slug,
        label: project.name,
      })),
      hasMore: projects.hasMore,
      nextCursor: projects.cursor,
    };
  },
});
