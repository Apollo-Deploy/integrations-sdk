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
  },
  capabilities: ["issue-tracking"] as const,

  tokenMetadata: {
    expiresInSeconds: 86_400, // 24 hours
    refreshable: false, // Linear does not support refresh
    rotatesRefreshToken: false,
    requiresRefreshLock: false,
  },

  createOAuthHandler: (config) => createLinearOAuth(config),
  createWebhookHandler: (config) => createLinearWebhook(config),
});
