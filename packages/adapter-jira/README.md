# @apollo-deploy/adapter-jira

Jira adapter for the Apollo Deploy integration hub — issue tracking with OAuth 2.0 and HMAC-SHA256 webhook verification.

> **Note:** This adapter was originally built for the [Apollo Deploy](https://apollodeploy.com) platform. We are converting the SDK into a fully generalized, provider-agnostic integration framework that any team can use — independent of Apollo Deploy. The adapter API is designed to be portable and usable standalone or with any hub implementation.

> ⚠️ **Jira rotates refresh tokens.** You must use a distributed lock when refreshing tokens. See [Token lifecycle](#token-lifecycle).

## Installation

```bash
bun add @apollo-deploy/adapter-jira
```

## Prerequisites

1. Go to [developer.atlassian.com/console/myapps](https://developer.atlassian.com/console/myapps) → **Create** → **OAuth 2.0 integration**
2. Under **Authorization**, add your **Callback URL** (e.g. `https://yourapp.com/oauth/callback/jira`)
3. Under **Permissions**, add the **Jira API** and grant the required scopes: `read:jira-user`, `read:jira-work`, `write:jira-work`
4. Copy the **Client ID** and **Secret**
5. For webhooks: in your Jira project → **Project Settings → Webhooks**, add your URL and a secret

## Configuration

```typescript
import { createJiraAdapter } from '@apollo-deploy/adapter-jira';

const jira = createJiraAdapter({
  clientId: process.env.JIRA_CLIENT_ID!,
  clientSecret: process.env.JIRA_CLIENT_SECRET!,
  redirectUri: process.env.JIRA_REDIRECT_URI!,
});
```

### Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `clientId` | `string` | ✅ | Jira OAuth 2.0 Client ID |
| `clientSecret` | `string` | ✅ | Jira OAuth 2.0 Client Secret |
| `redirectUri` | `string` | ✅ | OAuth Callback URL registered in the Atlassian developer console |

## Environment variables

```bash
JIRA_CLIENT_ID=abc123def456ghi789
JIRA_CLIENT_SECRET=jira_secret_...
JIRA_REDIRECT_URI=https://yourapp.com/oauth/callback/jira
```

## Registering with the hub

```typescript
import { IntegrationHub } from '@apollo-deploy/integrations';
import { createJiraAdapter } from '@apollo-deploy/adapter-jira';

const hub = new IntegrationHub();

hub.register('jira', createJiraAdapter({
  clientId: process.env.JIRA_CLIENT_ID!,
  clientSecret: process.env.JIRA_CLIENT_SECRET!,
  redirectUri: process.env.JIRA_REDIRECT_URI!,
}));

await hub.initialize();
```

## Webhook handler

```typescript
export async function POST(req: Request) {
  const rawBody = Buffer.from(await req.arrayBuffer());
  const headers = Object.fromEntries(req.headers.entries());

  const result = await hub.webhooks.jira({ rawBody, headers });
  return Response.json({ ok: true }, { status: result.statusCode ?? 200 });
}
```

**Signature:** `X-Hub-Signature: sha256=<hmac-sha256>`

## Token lifecycle

| Field | Value |
|-------|-------|
| Expiry | 1 hour |
| Refreshable | Yes |
| Rotates refresh token | **Yes ⚠️** |
| Requires distributed lock | **Yes ⚠️** |

Jira uses single-use refresh tokens. Each refresh call returns a new `accessToken` **and** a new `refreshToken` while invalidating the old one. You must:

1. Acquire a distributed lock (e.g. Redis `SET NX`) before calling `refreshToken`
2. Atomically write **both** `accessToken` and `refreshToken` to your database
3. Release the lock

```typescript
async function refreshJiraTokens(userId: string) {
  const lock = await acquireLock(`jira:refresh:${userId}`);
  try {
    const stored = await db.tokens.findOne({ userId, provider: 'jira' });
    const refreshed = await jiraAdapter.oauth.refreshToken(stored.refreshToken);
    await db.tokens.update({ userId, provider: 'jira' }, {
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
const it = hub.getAdapter('jira').issueTracking!;

// List projects
const projects = await it.listProjects(tokens);

// List issues
const issues = await it.listIssues(tokens, {
  projectKey: 'MYPROJ',
  query: 'status = "In Progress"',
  limit: 50,
});

// Get a single issue
const issue = await it.getIssue(tokens, { issueKey: 'MYPROJ-42' });

// Create an issue
const created = await it.createIssue(tokens, {
  projectKey: 'MYPROJ',
  summary: 'Bug: checkout fails on mobile',
  description: 'Steps to reproduce...',
  issueType: 'Bug',
});

// Update an issue
await it.updateIssue(tokens, {
  issueKey: 'MYPROJ-42',
  status: 'Done',
  assignee: 'user@example.com',
});

// Add a comment
await it.addComment(tokens, {
  issueKey: 'MYPROJ-42',
  body: 'Fixed in v1.2.3 — see PR #456',
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
