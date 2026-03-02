---
name: integrations-sdk
description: >
  Build third-party integrations with the Integrations SDK (`@apollo-deploy/integrations` npm package). Use when developers want to
  (1) Connect to GitHub, GitLab, Slack, Discord, Jira, Linear, Apple App Store Connect, or Google Play Console,
  (2) Use the IntegrationHub to route webhooks, handle OAuth, discover capabilities, and dispatch normalized events,
  (3) Set up webhook handlers for integration platforms,
  (4) Use source-control, messaging, issue-tracking, or app-store capabilities across providers.
  Triggers on "integrations sdk", "integration adapter", "github adapter", "slack adapter", "jira adapter",
  "webhook routing", "oauth flow", "@apollo-deploy/adapter-", building integrations that work across multiple platforms.
---

# Integrations SDK

Unified TypeScript SDK for building third-party integrations across GitHub, GitLab, Slack, Discord, Jira, Linear, Apple App Store Connect, and Google Play Console. Define your integration logic once, connect everywhere.

## Critical: Read the bundled types

Each `@apollo-deploy/*` package ships with full TypeScript declarations in `dist/`. **Always read these before writing code:**

```
node_modules/@apollo-deploy/integrations/dist/   # Core types + crypto (.d.ts files)
node_modules/@apollo-deploy/adapter-*/dist/       # Adapter types
```

Key type files to read based on task:
- `integrations/dist/hub.d.ts` — IntegrationHub, WebhookRouter, EventHandler, HubConfig
- `integrations/dist/define-adapter.d.ts` — defineAdapter factory, AdapterDefinition
- `integrations/dist/types/adapter.d.ts` — IntegrationAdapter interface, AdapterCapability, TokenMetadata
- `integrations/dist/types/oauth.d.ts` — OAuthHandler, TokenSet, ProviderIdentity, AuthorizationParams
- `integrations/dist/types/webhook.d.ts` — WebhookHandler, VerifyParams, ParseParams
- `integrations/dist/types/models.d.ts` — IntegrationEvent, Connection, Repository, PullRequest, Issue, Channel, 60+ domain models
- `integrations/dist/types/capabilities/*.d.ts` — SourceControlCapability, MessagingCapability, IssueTrackingCapability, AppStoreCapability
- `integrations/dist/crypto.d.ts` — CryptoProvider, EncryptedEnvelope, encryptGCM, decryptGCM

## Quick start

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

await hub.initialize();

// Type-safe webhook routing — hub.webhooks.github only exists if github adapter is registered
const response = await hub.webhooks.github(request, { secret: 'whsec_...' });

// Subscribe to normalized events across all providers
hub.onEvent('push', async (event, ctx) => {
  console.log(`Push to ${event.data.repository} by ${event.data.sender}`);
});
```

## Core concepts

- **IntegrationHub** — main entry point, coordinates adapters and routes events
- **Adapters** — platform-specific, created with `defineAdapter()` factory (GitHub, GitLab, Slack, Discord, Jira, Linear, Apple, Google Play)
- **Crypto** — built-in AES-256-GCM encryption for token storage (`CryptoProvider`, exported from core)
- **Capabilities** — typed interfaces for source-control, messaging, issue-tracking, app-store
- **IntegrationEvent** — normalized event shape with `provider`, `eventType`, `domain`, `correlationId`, `data`
- **TokenSet** — normalized OAuth tokens with `accessToken`, `refreshToken`, `expiresAt`, `providerData`

## Hub methods

| Method | Purpose |
|--------|---------|
| `hub.initialize()` | Call `onRegister` then `onReady` on all adapters |
| `hub.shutdown()` | Graceful shutdown — calls `onShutdown` on all adapters |
| `hub.webhooks.<adapter>(req, opts)` | Type-safe webhook routing (verify → parse → dispatch) |
| `hub.onEvent(type, handler)` | Subscribe to events by type (e.g. `'push'`, `'issue.created'`) |
| `hub.onAnyEvent(handler)` | Wildcard handler for all events |
| `hub.getAdapter(key)` | Get a specific adapter by registered key |
| `hub.getAdaptersByCapability(cap)` | Discover adapters by capability |
| `hub.getRegisteredAdapters()` | List all registered adapter IDs |

## Capabilities

Each adapter declares capabilities from the union: `source-control | messaging | issue-tracking | app-store | ci-cd`.

| Capability | Key Methods | Adapters |
|------------|------------|----------|
| `source-control` | `listRepositories`, `getRepository`, `listBranches`, `getPullRequest`, `createCommitStatus`, `listCommits` | GitHub, GitLab |
| `messaging` | `listChannels`, `sendMessage`, `updateMessage`, `sendRichMessage` | Slack, Discord |
| `issue-tracking` | `listIssues`, `getIssue`, `createIssue`, `updateIssue`, `addComment`, `listProjects` | Jira, GitLab, Linear |
| `app-store` | `listApps`, `listBuilds`, `listReleases`, `submitForReview`, `releaseToTrack`, `updateRollout`, `listReviews`, `listBetaGroups`, `getVitalsSummary` | Apple, Google Play |

All capability methods receive `tokens: TokenSet` as first parameter — adapters are stateless.

## OAuth

Every adapter implements `OAuthHandler`:

```typescript
const url = adapter.oauth.getAuthorizationUrl({ state, scopes, redirectUri });
const tokens = await adapter.oauth.exchangeCode({ code, redirectUri });
const refreshed = await adapter.oauth.refreshToken(refreshToken);
const identity = await adapter.oauth.getIdentity(accessToken);
```

Token metadata: `expiresInSeconds` (null = never), `refreshable`, `rotatesRefreshToken`, `requiresRefreshLock`.

## Crypto

```typescript
import { createCryptoProviderFromEnv, encryptGCM, decryptGCM } from '@apollo-deploy/integrations';

const crypto = createCryptoProviderFromEnv(); // reads KMS_ROOT_KEY_B64 or KMS_KEY_V1
const encrypted = await crypto.encrypt(plaintext, { orgId, entityId, purpose: 'token' });
const decrypted = await crypto.decrypt(encrypted, { orgId, entityId, purpose: 'token' });
```

- HKDF-SHA256 key derivation bound to org + entity + purpose
- AES-256-GCM with AAD support
- Auto-zeroize key buffers after use

## Packages

| Package | Purpose |
|---------|---------|
| `@apollo-deploy/integrations` | Core hub, `defineAdapter()`, types, capabilities, domain models, crypto |
| `@apollo-deploy/adapter-github` | GitHub (Octokit) — source-control |
| `@apollo-deploy/adapter-gitlab` | GitLab (Gitbeaker) — source-control + issue-tracking |
| `@apollo-deploy/adapter-slack` | Slack (Web API) — messaging |
| `@apollo-deploy/adapter-discord` | Discord (discord.js REST) — messaging |
| `@apollo-deploy/adapter-jira` | Jira (jira.js) — issue-tracking |
| `@apollo-deploy/adapter-linear` | Linear (Linear SDK) — issue-tracking |
| `@apollo-deploy/adapter-apple` | Apple App Store Connect (JWT auth) — app-store |
| `@apollo-deploy/adapter-google-play` | Google Play Console (service account JWT) — app-store |

## Webhook setup

Each adapter exposes a webhook handler via `hub.webhooks.{platform}`. Wire these to your HTTP framework's routes (e.g. Next.js API routes, Hono, Express).

```typescript
// Hono example
app.post('/webhooks/github', async (c) => {
  const response = await hub.webhooks.github(
    { rawBody: await c.req.arrayBuffer(), headers: Object.fromEntries(c.req.raw.headers), body: await c.req.json() },
    { secret: process.env.GITHUB_WEBHOOK_SECRET!, waitUntil: c.executionCtx.waitUntil }
  );
  return c.json(response.body, response.statusCode);
});
```

Hub handles: signature verification → synchronous challenges (e.g. Slack `url_verification`) → 200 response → async event dispatch via `waitUntil`.

## Error types

Import from `@apollo-deploy/integrations`:
- `AdapterError` — generic adapter failure (base class)
- `OAuthError` — OAuth flow failure
- `WebhookError` — webhook processing failure (includes `statusCode`)
- `CapabilityError` — capability method call failure (optionally retryable)
- `TokenRefreshError` — token refresh failure (retryable = false means re-auth needed)
- `UnknownAdapterError` — adapter not registered in hub

Also from `@apollo-deploy/integrations`:
- `DecryptError` — decryption/auth tag failure
- `CryptoConfigError` — missing or invalid encryption key
