import { defineAdapter } from "@apollo-deploy/integrations";
import { createJiraOAuth } from "./oauth.js";
import { createJiraWebhook } from "./webhook.js";
import { createJiraIssueTracking } from "./capabilities/issue-tracking.js";
import type { JiraAdapterConfig } from "./types.js";

export const createJiraAdapter = defineAdapter<JiraAdapterConfig>({
  id: "jira",
  name: "Jira",
  metadata: {
    description:
      "Link deployments to Jira issues and automatically transition ticket statuses.",
    category: "Project Management",
    dateAdded: "2024-01-20",
    websiteUrl: "https://www.atlassian.com/software/jira",
    docsUrl: "https://developer.atlassian.com/cloud/jira",
  },
  capabilities: ["issue-tracking"] as const,

  tokenMetadata: {
    expiresInSeconds: 3600,
    refreshable: true,
    // Jira rotates refresh tokens on every use — must atomically swap
    rotatesRefreshToken: true,
    // Must hold distributed lock during refresh to prevent concurrent rotation
    requiresRefreshLock: true,
  },

  createOAuthHandler: (config) => createJiraOAuth(config),
  createWebhookHandler: (config) => createJiraWebhook(config),
  createIssueTracking: (config) => createJiraIssueTracking(config),
});
