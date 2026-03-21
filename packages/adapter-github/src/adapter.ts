/**
 * GitHub adapter factory.
 * Implements source-control capability with GitHub App authentication.
 *
 * Token model:
 * - Installation tokens expire after 1 hour.
 * - "Refresh" = JWT signing + POST /app/installations/{id}/access_tokens.
 * - installationId stored in providerData (not a standard refresh token).
 */

import { defineAdapter } from "@apollo-deploy/integrations";
import { createGithubOAuth } from "./oauth.js";
import { createGithubWebhook } from "./webhook.js";
import { createGithubSourceControl } from "./capabilities/source-control.js";
import type { GithubAdapterConfig } from "./types.js";

export const createGithubAdapter = defineAdapter<GithubAdapterConfig>({
  id: "github",
  name: "GitHub",
  metadata: {
    description:
      "Connect GitHub repositories to track pull requests, commits, and code deployments.",
    category: "Source Control",
    dateAdded: "2024-01-15",
    websiteUrl: "https://github.com",
    docsUrl: "https://docs.github.com/en/apps",
    auth: { method: "oauth2" as const },
  },
  capabilities: ["source-control"] as const,

  tokenMetadata: {
    // Installation tokens expire after 1 hour
    expiresInSeconds: 3600,
    // "Refreshable" via JWT + private key — not standard OAuth refresh
    refreshable: true,
    rotatesRefreshToken: false,
    // Multiple parallel refresh requests are safe — JWT signing is idempotent
    requiresRefreshLock: false,
  },

  createOAuthHandler: (config) => createGithubOAuth(config),
  createWebhookHandler: (config) => createGithubWebhook(config),
  createSourceControl: (config) => createGithubSourceControl(config),
});
