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
    auth: { type: "oauth" },
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
});
