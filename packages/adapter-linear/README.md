# @apollo-deploy/adapter-linear

Linear adapter for the Apollo Deploy integration hub — issue tracking with OAuth 2.0 and HMAC-SHA256 webhook verification.

> **Note:** This adapter was originally built for the [Apollo Deploy](https://apollodeploy.com) platform. We are converting the SDK into a fully generalized, provider-agnostic integration framework that any team can use — independent of Apollo Deploy. The adapter API is designed to be portable and usable standalone or with any hub implementation.

> ⚠️ **Linear rotates refresh tokens.** You must use a distributed lock when refreshing tokens. See [Token lifecycle](#token-lifecycle).

## Installation

```bash
bun add @apollo-deploy/adapter-linear
```

## Prerequisites

1. Go to [linear.app](https://linear.app) → **Settings → API → OAuth Applications → Create new application**
2. Set **Application name**, **Description**, and **Redirect URI** (e.g. `https://yourapp.com/oauth/callback/linear`)
3. Copy the **Client ID** and **Client Secret**
4. For webhooks: go to **Settings → API → Webhooks → New Webhook**, add your URL and set a **Signing secret**

## Configuration

```typescript
import { createLinearAdapter } from '@apollo-deploy/adapter-linear';

const linear = createLinearAdapter({
  clientId: process.env.LINEAR_CLIENT_ID!,
  clientSecret: process.env.LINEAR_CLIENT_SECRET!,
  webhookSecret: process.env.LINEAR_WEBHOOK_SECRET!,
  // redirectUri: 'https://yourapp.com/oauth/callback/linear',
});
```

### Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `clientId` | `string` | ✅ | Linear OAuth Application Client ID |
| `clientSecret` | `string` | ✅ | Linear OAuth Application Client Secret |
| `webhookSecret` | `string` | ✅ | Signing secret from Linear webhook settings — used to verify `linear-signature` |
| `redirectUri` | `string` | No | OAuth redirect URI |

## Environment variables

```bash
LINEAR_CLIENT_ID=abc123def456ghi789
LINEAR_CLIENT_SECRET=lin_api_your_secret_here
LINEAR_WEBHOOK_SECRET=whsec_at_least_32_chars
```

## Registering with the hub

```typescript
import { IntegrationHub } from '@apollo-deploy/integrations';
import { createLinearAdapter } from '@apollo-deploy/adapter-linear';

const hub = new IntegrationHub();

hub.register('linear', createLinearAdapter({
  clientId: process.env.LINEAR_CLIENT_ID!,
  clientSecret: process.env.LINEAR_CLIENT_SECRET!,
  webhookSecret: process.env.LINEAR_WEBHOOK_SECRET!,
}));

await hub.initialize();
```

## Webhook handler

```typescript
export async function POST(req: Request) {
  const rawBody = Buffer.from(await req.arrayBuffer());
  const headers = Object.fromEntries(req.headers.entries());

  const result = await hub.webhooks.linear({ rawBody, headers });
  return Response.json({ ok: true }, { status: result.statusCode ?? 200 });
}
```

**Signature:** `linear-signature: <hmac-sha256>`

**Supported events:** `Issue.create`, `Issue.update`, `Issue.remove`, `Comment.create`, `Comment.update`, `Comment.remove`, `Project.update`, `ProjectUpdate.create`, `Cycle.update`, `Reaction.create`

## Token lifecycle

| Field | Value |
|-------|-------|
| Expiry | 24 hours |
| Refreshable | Yes |
| Rotates refresh token | **Yes ⚠️** |
| Requires distributed lock | **Yes ⚠️** |

Linear issues a new refresh token on every refresh call (RFC 6749 token rotation). You must:

1. Acquire a distributed lock before calling `refreshToken`
2. Atomically write both `accessToken` and `refreshToken` to your database
3. Release the lock

```typescript
async function refreshLinearTokens(userId: string) {
  const lock = await acquireLock(`linear:refresh:${userId}`);
  try {
    const stored = await db.tokens.findOne({ userId, provider: 'linear' });
    const refreshed = await linearAdapter.oauth.refreshToken(stored.refreshToken);
    await db.tokens.update({ userId, provider: 'linear' }, {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      expiresAt: refreshed.expiresAt,
    });
    return refreshed;
  } finally {
    await lock.release();
  }
}
```

## Capability: `issue-tracking`

```typescript
const it = hub.getAdapter('linear').issueTracking!;

// List issues
const issues = await it.listIssues(tokens, { teamId: 'TEAM-ID', limit: 25 });

// Get a single issue
const issue = await it.getIssue(tokens, { issueId: 'ISSUE-ID' });

// Create an issue
const created = await it.createIssue(tokens, {
  teamId: 'TEAM-ID',
  title: 'Bug: checkout fails on mobile',
  description: 'Steps to reproduce...',
  priority: 2,
});

// Update an issue
await it.updateIssue(tokens, {
  issueId: 'ISSUE-ID',
  stateId: 'STATE-ID',
  assigneeId: 'USER-ID',
});

// Add a comment
await it.addComment(tokens, {
  issueId: 'ISSUE-ID',
  body: 'Fixed in v1.2.3',
});
```

## Development

```bash
bun run build
bun run typecheck
bun run test
bun run dev
bun run clean
```
