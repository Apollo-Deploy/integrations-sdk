import { defineAdapter } from '@apollo-deploy/integrations';
import { createGitlabOAuth } from './oauth.js';
import { createGitlabWebhook } from './webhook.js';
import { createGitlabSourceControl } from './capabilities/source-control.js';
import { createGitlabIssueTracking } from './capabilities/issue-tracking.js';
import type { GitlabAdapterConfig } from './types.js';

export const createGitlabAdapter = defineAdapter<GitlabAdapterConfig>({
  id: 'gitlab',
  name: 'GitLab',
  capabilities: ['source-control', 'issue-tracking'] as const,

  tokenMetadata: {
    expiresInSeconds: 7_200, // 2 hours
    refreshable: true,
    rotatesRefreshToken: false, // GitLab refresh tokens are long-lived
    requiresRefreshLock: false,
  },

  createOAuthHandler: (config) => createGitlabOAuth(config),
  createWebhookHandler: (config) => createGitlabWebhook(config),

  createSourceControl: (config) => createGitlabSourceControl(config),
  createIssueTracking: (config) => createGitlabIssueTracking(config),
});
