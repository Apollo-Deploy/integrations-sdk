import { defineAdapter } from "@apollo-deploy/integrations";
import { createLinearOAuth } from "./oauth.js";
import { createLinearWebhook } from "./webhook.js";
import type { LinearAdapterConfig } from "./types.js";

export const createLinearAdapter = defineAdapter<LinearAdapterConfig>({
  id: "linear",
  name: "Linear",
  metadata: {
    description:
      "Sync issues and automatically update Linear tickets when deployments complete.",
    category: "Project Management",
    dateAdded: "2024-04-05",
    websiteUrl: "https://linear.app",
    docsUrl: "https://developers.linear.app/docs",
    auth: { method: "oauth2" as const },
  },
  capabilities: ["issue-tracking"] as const,

  tokenMetadata: {
    expiresInSeconds: 86_400, // 24 hours
    refreshable: true,
    // Linear issues a new refresh_token on every refresh (RFC 6749 rotation)
    rotatesRefreshToken: true,
    requiresRefreshLock: true,
  },

  createOAuthHandler: (config) => createLinearOAuth(config),
  createWebhookHandler: (config) => createLinearWebhook(config),
});
