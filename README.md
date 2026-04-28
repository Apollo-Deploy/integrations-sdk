# Integrations SDK

A unified TypeScript SDK for building third-party integrations across GitHub, Slack, Jira, Linear, GitLab, Discord, Apple App Store Connect, Google Play Console, and Sentry. Define your integration logic once, connect everywhere.

## Installation

Install the core package:

```bash
bun add @apollo-deploy/integrations
```

Install adapters for your platforms:

```bash
bun add @apollo-deploy/adapter-github @apollo-deploy/adapter-slack @apollo-deploy/adapter-jira
```

Install the Sentry adapter:

```bash
bun add @apollo-deploy/adapter-sentry
```

## Usage

```typescript
import { IntegrationHub, createCryptoProviderFromEnv } from '@apollo-deploy/integrations';
import { createGithubAdapter } from '@apollo-deploy/adapter-github';
import { createSlackAdapter } from '@apollo-deploy/adapter-slack';

const hub = new IntegrationHub({
  adapters: {
    github: createGithubAdapter({
      appId: process.env.GITHUB_APP_ID!,
      privateKey: process.env.GITHUB_PRIVATE_KEY!,
      webhookSecret: process.env.GITHUB_WEBHOOK_SECRET!,
    }),
    slack: createSlackAdapter({
      botToken: process.env.SLACK_BOT_TOKEN!,
      signingSecret: process.env.SLACK_SIGNING_SECRET!,
    }),
  },
  crypto: createCryptoProviderFromEnv(),
  logger: console,
});

// Type-safe webhook routing — hub.webhooks.github only exists if github adapter is registered
const response = await hub.webhooks.github(request, { secret: 'whsec_...' });

// Subscribe to normalized events across all providers
hub.onEvent('push', async (event, ctx) => {
  console.log(`Push to ${event.data.repository} by ${event.data.sender}`);
});

hub.onAnyEvent(async (event, ctx) => {
  console.log(`[${event.provider}] ${event.eventType}`);
});

await hub.initialize();
```

## Supported Platforms

| Platform | Package | Capability | OAuth | Webhooks |
| ---------- | --------- | ------------ | ------- | ---------- |
| GitHub | `@apollo-deploy/adapter-github` | Source Control | Yes | Yes |
| GitLab | `@apollo-deploy/adapter-gitlab` | Source Control, Issue Tracking | Yes | Yes |
| Slack | `@apollo-deploy/adapter-slack` | Messaging | Yes | Yes |
| Discord | `@apollo-deploy/adapter-discord` | Messaging | Yes | Yes |
| Jira | `@apollo-deploy/adapter-jira` | Issue Tracking | Yes | Yes |
| Linear | `@apollo-deploy/adapter-linear` | Issue Tracking | Yes | Yes |
| Apple App Store Connect | `@apollo-deploy/adapter-apple` | App Store | JWT | Yes |
| Google Play Console | `@apollo-deploy/adapter-google-play` | App Store | JWT | Yes |
| Sentry | `@apollo-deploy/adapter-sentry` | Monitoring | Yes / Static Token | Yes |

## Features

- **Type-safe webhook routing** — `hub.webhooks.github(req)` only compiles if the GitHub adapter was registered
- **Normalized events** — all provider-specific webhook payloads are mapped to a universal `IntegrationEvent` shape
- **OAuth management** — authorization URL building, code exchange, token refresh, and identity fetching
- **Capability discovery** — query which adapters support `source-control`, `messaging`, `issue-tracking`, or `app-store`
- **Encrypted token storage** — AES-256-GCM encryption with HKDF key derivation for at-rest token security
- **Stateless adapters** — tokens are passed as parameters to every method, adapters hold config not state
- **Host-rendered setup UI** — adapters can expose `ui.manifest` for generic setup forms and `ui.listChoices()` for provider-backed select fields
- **Async webhook processing** — return `200` immediately, process via `waitUntil` (serverless) or fire-and-forget
- **Webhook signature verification** — each adapter implements provider-specific signature verification

## Host-rendered setup UI

Adapters can expose a static setup manifest and an optional dynamic choice resolver for host applications that want to render connection, shared configuration, and resource configuration forms without provider-specific UI code.

```typescript
const catalog = hub.listAdapters();
const githubInfo = catalog.find((adapter) => adapter.key === 'github');

console.log(githubInfo?.ui?.manifest.connection.flow);
console.log(githubInfo?.ui?.manifest.resourceConfig?.fields);

const github = hub.getAdapter('github');
const repositories = await github.ui?.listChoices?.('repositories', {
  tokens,
  limit: 50,
  scope: { orgId: 'org_123', appId: 'app_123' },
});
```

`hub.listAdapters()` returns only static metadata and `ui.manifest`.
`adapter.ui.listChoices()` is the runtime hook for provider-backed select fields because it requires tokens and host scope.

## Capabilities

### Source Control

```typescript
const github = hub.getAdaptersByCapability('source-control');
// listRepositories, getRepository, listBranches, getPullRequest, createCommitStatus, listCommits
```

### Messaging

```typescript
const slack = hub.getAdaptersByCapability('messaging');
// listChannels, sendMessage, updateMessage, sendRichMessage
```

### Issue Tracking

```typescript
const jira = hub.getAdaptersByCapability('issue-tracking');
// listIssues, getIssue, createIssue, updateIssue, addComment, listProjects
```

### App Store

```typescript
const apple = hub.getAdaptersByCapability('app-store');
// App management, builds, releases, version/track management, publishing,
// reviews & ratings, beta testing, app vitals & crash clusters
```

### Monitoring

```typescript
const sentry = hub.getAdaptersByCapability('monitoring');
// listIssues, getIssue, updateIssue, listEvents, createRelease, listReleases,
// listVitals, listMetrics, listAlertRules, listCronMonitors, listReplays,
// listLogs, listFeedback, listOrgs, listTeams, listProjects, listTags
```

## Packages

| Package | Description |
| --------- | ------------- |
| `@apollo-deploy/integrations` | Core SDK — `IntegrationHub`, `defineAdapter()`, types, capabilities, crypto |
| `@apollo-deploy/adapter-github` | GitHub adapter (source control) |
| `@apollo-deploy/adapter-gitlab` | GitLab adapter (source control + issue tracking) |
| `@apollo-deploy/adapter-slack` | Slack adapter (messaging) |
| `@apollo-deploy/adapter-discord` | Discord adapter (messaging) |
| `@apollo-deploy/adapter-jira` | Jira adapter (issue tracking) |
| `@apollo-deploy/adapter-linear` | Linear adapter (issue tracking) |
| `@apollo-deploy/adapter-apple` | Apple App Store Connect adapter |
| `@apollo-deploy/adapter-google-play` | Google Play Console adapter |
| `@apollo-deploy/adapter-sentry` | Sentry adapter (monitoring) |

## Creating a Custom Adapter

```typescript
import { defineAdapter } from '@apollo-deploy/integrations';
import { createMyServiceMessaging } from './capabilities/messaging.js';
import { createMyServiceOAuth } from './oauth.js';
import { createMyServiceWebhook } from './webhook.js';

interface MyServiceConfig {
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
}

export const createMyServiceAdapter = defineAdapter<MyServiceConfig>({
  id: 'my-service',
  name: 'my-service',
  metadata: {
    description: 'Send alerts and workflow notifications to My Service.',
    category: 'Messaging',
    websiteUrl: 'https://my-service.example',
    docsUrl: 'https://docs.my-service.example',
  },
  ui: {
    manifest: {
      connection: {
        flow: 'oauth',
        submitLabel: 'Connect My Service',
      },
    },
  },
  capabilities: ['messaging'] as const,
  tokenMetadata: {
    expiresInSeconds: 3600,
    refreshable: true,
    rotatesRefreshToken: false,
    requiresRefreshLock: false,
  },
  createOAuthHandler: (config) => createMyServiceOAuth(config),
  createWebhookHandler: (config) => createMyServiceWebhook(config),
  createMessaging: (config) => createMyServiceMessaging(config),
});
```

If a setup form needs provider-backed select options, declare `choiceSource` on the field inside `ui.manifest` and implement `listChoices` on the adapter.

## Development

```bash
# Install dependencies
bun install

# Build all packages
bun run build

# Type-check all packages
bun run typecheck

# Run tests
bun run test

# Dev mode (watch)
bun run dev

# Clean all build artifacts
bun run clean
```

## Architecture

```text
@apollo-deploy/integrations            ← Core hub, types, defineAdapter(), crypto
        ↑
@apollo-deploy/adapter-*               ← Provider-specific adapters
```

All packages are built with TypeScript, publish ESM to `dist/`, and include full type declarations.

## License

MIT
