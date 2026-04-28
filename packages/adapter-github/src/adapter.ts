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
  },
  ui: {
    manifest: {
      connection: {
        flow: "oauth",
        submitLabel: "Connect GitHub",
      },
      config: {
        submitLabel: "Save repository",
        fields: [
          {
            key: "repoId",
            label: "Repository",
            type: "select",
            required: true,
            helpText: "Choose which repository to bind to this resource.",
            choiceSource: { key: "repositories", pageSize: 100 },
          },
        ],
      },
    },
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
  listChoices: async (_config, { sourceControl }, sourceKey, ctx) => {
    if (sourceKey !== "repositories") {
      throw new Error(`Unknown choice source: ${sourceKey}`);
    }
    if (!sourceControl) {
      throw new Error("GitHub adapter does not expose source-control capability");
    }

    const repositories = await sourceControl.listRepositories(ctx.tokens, {
      cursor: ctx.cursor,
      limit: ctx.limit ?? 100,
    });

    return {
      choices: repositories.items.map((repository) => ({
        value: repository.id,
        label: repository.fullName,
      })),
      hasMore: repositories.hasMore,
      nextCursor: repositories.cursor,
    };
  },
});
