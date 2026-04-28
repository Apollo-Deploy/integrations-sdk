import { defineAdapter } from "@apollo-deploy/integrations";
import { createGitlabOAuth } from "./oauth.js";
import { createGitlabWebhook } from "./webhook.js";
import { createGitlabSourceControl } from "./capabilities/source-control.js";
import { createGitlabIssueTracking } from "./capabilities/issue-tracking.js";
import type { GitlabAdapterConfig } from "./types.js";

export const createGitlabAdapter = defineAdapter<GitlabAdapterConfig>({
  id: "gitlab",
  name: "GitLab",
  metadata: {
    description:
      "Connect GitLab projects for source control, merge requests, and issue tracking.",
    category: "Source Control",
    dateAdded: "2024-02-01",
    iconUrl: {
      light: "https://cdn.apollodeploy.com/integrations/gitlab_integration_light.svg",
      dark: "https://cdn.apollodeploy.com/integrations/gitlab_integration_dark.svg",
    },
    websiteUrl: "https://gitlab.com",
    docsUrl: "https://docs.gitlab.com/ee/api/oauth2.html",
  },
  ui: {
    manifest: {
      connection: {
        flow: "oauth",
        submitLabel: "Connect GitLab",
      },
      resourceConfig: {
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
  capabilities: ["source-control", "issue-tracking"] as const,

  tokenMetadata: {
    expiresInSeconds: 7_200, // 2 hours
    refreshable: true,
    // GitLab invalidates existing tokens and issues new ones on refresh
    rotatesRefreshToken: true,
    requiresRefreshLock: true,
  },

  createOAuthHandler: (config) => createGitlabOAuth(config),
  createWebhookHandler: (config) => createGitlabWebhook(config),

  createSourceControl: (config) => createGitlabSourceControl(config),
  createIssueTracking: (config) => createGitlabIssueTracking(config),
  listChoices: async (_config, { sourceControl }, sourceKey, ctx) => {
    if (sourceKey !== "repositories") {
      throw new Error(`Unknown choice source: ${sourceKey}`);
    }
    if (!sourceControl) {
      throw new Error("GitLab adapter does not expose source-control capability");
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
