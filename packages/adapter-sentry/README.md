# @apollo-deploy/adapter-sentry

Sentry adapter for the Apollo Deploy integration hub — crash monitoring, performance vitals, logs, replays, alerts, crons, and more. Supports both static auth tokens and OAuth 2.0.

> **Note:** This adapter was originally built for the [Apollo Deploy](https://apollodeploy.com) platform. We are converting the SDK into a fully generalized, provider-agnostic integration framework that any team can use — independent of Apollo Deploy. The adapter API is designed to be portable and usable standalone or with any hub implementation.

## Installation

```bash
bun add @apollo-deploy/adapter-sentry
```

## Prerequisites

### Static auth token (recommended)

1. Go to [sentry.io](https://sentry.io) → **Settings → Account → API → Auth Tokens → Create New Token**
2. Select required scopes: `org:read`, `project:read`, `event:read`, `alerts:read`, `releases`
3. Copy the token (starts with `sntrys_`)
4. For webhooks: go to **Settings → Integrations → your integration → Webhooks** and copy the **Signing Secret**

### OAuth 2.0 (per-user authorization)

1. Go to **Settings → Developer Settings → New Internal Integration** or **New Public Integration**
2. Set **Name**, **Webhook URL**, and **Redirect URIs**
3. Copy the **Client ID** and **Client Secret**

## Configuration

### Static auth token mode

```typescript
import { createSentryAdapter } from '@apollo-deploy/adapter-sentry';

const sentry = createSentryAdapter({
  authToken: process.env.SENTRY_AUTH_TOKEN!,
  defaultOrgSlug: process.env.SENTRY_ORG_SLUG,
  webhookSecret: process.env.SENTRY_WEBHOOK_SECRET,
  // baseUrl: 'https://sentry.example.com', // self-hosted only
});
```

### OAuth 2.0 mode

```typescript
const sentry = createSentryAdapter({
  clientId: process.env.SENTRY_CLIENT_ID!,
  clientSecret: process.env.SENTRY_CLIENT_SECRET!,
  defaultOrgSlug: process.env.SENTRY_ORG_SLUG,
  webhookSecret: process.env.SENTRY_WEBHOOK_SECRET,
});
```

### Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `authToken` | `string` | Static mode | Bearer token (`sntrys_...`) from Sentry → Settings → Auth Tokens |
| `clientId` | `string` | OAuth mode | Client ID for Sentry internal/public integration |
| `clientSecret` | `string` | OAuth mode | Client Secret for Sentry internal/public integration |
| `defaultOrgSlug` | `string` | No | Default organization slug used when not provided to capability methods |
| `webhookSecret` | `string` | No | HMAC-SHA256 signing secret for verifying inbound webhooks |
| `baseUrl` | `string` | No | Base URL for self-hosted Sentry (default: `https://sentry.io`) |

## Environment variables

```bash
# Static token mode
SENTRY_AUTH_TOKEN=sntrys_your_token_here
SENTRY_ORG_SLUG=my-company
SENTRY_WEBHOOK_SECRET=whsec_at_least_32_chars

# OAuth mode (instead of SENTRY_AUTH_TOKEN)
# SENTRY_CLIENT_ID=abc123
# SENTRY_CLIENT_SECRET=def456
```

## Registering with the hub

```typescript
import { IntegrationHub } from '@apollo-deploy/integrations';
import { createSentryAdapter } from '@apollo-deploy/adapter-sentry';

const hub = new IntegrationHub();

hub.register('sentry', createSentryAdapter({
  authToken: process.env.SENTRY_AUTH_TOKEN!,
  defaultOrgSlug: process.env.SENTRY_ORG_SLUG,
  webhookSecret: process.env.SENTRY_WEBHOOK_SECRET,
}));

await hub.initialize();

hub.onEvent('sentry', (event) => {
  if (event.eventType === 'monitor.issue.created') {
    // page on-call
  }
  if (event.eventType === 'monitor.alert.triggered') {
    // fire notification
  }
});
```

## Webhook handler

```typescript
export async function POST(req: Request) {
  const rawBody = Buffer.from(await req.arrayBuffer());
  const headers = Object.fromEntries(req.headers.entries());

  const result = await hub.webhooks.sentry({ rawBody, headers });
  return Response.json({ ok: true }, { status: result.statusCode ?? 200 });
}
```

**Signature:** `sentry-hook-signature: <hmac-sha256-hex>`

**Supported events:** `issue.created/resolved/assigned/ignored/unresolved/archived/escalating`, `error.created`, `event_alert.triggered`, `metric_alert.open/resolved/warning`, `comment.created/updated/deleted`, `installation.created/deleted`

## Token lifecycle

| Field | Value |
|-------|-------|
| Expiry | ~30 days (OAuth) / never (static token) |
| Refreshable | Yes (OAuth) / No (static — `TokenRefreshError` thrown) |
| Rotates refresh token | No |
| Requires distributed lock | No |

## Capability: `monitoring`

```typescript
const monitoring = hub.getAdapter('sentry').monitoring!;

// Issues
const issues = await monitoring.listIssues(tokens, {
  orgSlug: 'my-company',
  projectSlug: 'my-project',
  query: 'is:unresolved',
});
await monitoring.updateIssue(tokens, { issueId: '12345', status: 'resolved' });

// Events
const events = await monitoring.listEvents(tokens, { orgSlug: 'my-company', issueId: '12345' });

// Releases
await monitoring.createRelease(tokens, {
  orgSlug: 'my-company',
  version: 'v1.2.3',
  projects: ['my-project'],
  ref: 'abc123def',
});

// Alerts, crons, replays, logs, vitals, metrics, feedback
const alerts = await monitoring.listAlertRules(tokens, { orgSlug: 'my-company', projectSlug: 'my-project' });
const replays = await monitoring.listReplays(tokens, { orgSlug: 'my-company', projectSlug: 'my-project' });
const crons = await monitoring.listCronMonitors(tokens, { orgSlug: 'my-company', projectSlug: 'my-project' });
```

### Sentry-specific extras

```typescript
import type { SentryMonitoringCapability } from '@apollo-deploy/adapter-sentry';

const monitoring = hub.getAdapter('sentry').monitoring as SentryMonitoringCapability;

// DSN management
const keys = await monitoring.listDsnKeys(tokens, 'my-company', 'my-project');
const key = await monitoring.createDsnKey(tokens, 'my-company', 'my-project', 'Production');

// Ingestion statistics
const stats = await monitoring.getStats(tokens, 'my-company', { stat: 'received', resolution: '1h' });

// Debug information files (dSYMs, ProGuard, source maps)
const files = await monitoring.listDebugFiles(tokens, 'my-company', 'my-project');
await monitoring.deleteDebugFile(tokens, 'my-company', 'my-project', 'file-id');
```

## Development

```bash
bun run build
bun run typecheck
bun run test
bun run dev
bun run clean
```
