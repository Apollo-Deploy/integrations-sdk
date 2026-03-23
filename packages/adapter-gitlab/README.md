# @apollo-deploy/adapter-gitlab

GitLab adapter for the Apollo Deploy integration hub — source control and issue tracking with OAuth 2.0 and constant-time webhook token verification.

> **Note:** This adapter was originally built for the [Apollo Deploy](https://apollodeploy.com) platform. We are converting the SDK into a fully generalized, provider-agnostic integration framework that any team can use — independent of Apollo Deploy. The adapter API is designed to be portable and usable standalone or with any hub implementation.

## Installation

```bash
bun add @apollo-deploy/adapter-gitlab
```

## Prerequisites

1. Go to **GitLab → Settings → Applications** (or group/project Applications)
2. Create a new application with your **Redirect URI** (e.g. `https://yourapp.com/oauth/callback/gitlab`)
3. Grant scopes: `api`, `read_user`, `read_repository`
4. Copy the **Application ID** (Client ID) and **Secret**
5. For webhooks: in any project go to **Settings → Webhooks**, add your URL and set a **Secret token**

## Configuration

```typescript
import { createGitlabAdapter } from '@apollo-deploy/adapter-gitlab';

const gitlab = createGitlabAdapter({
  clientId: process.env.GITLAB_CLIENT_ID!,
  clientSecret: process.env.GITLAB_CLIENT_SECRET!,
  // instanceUrl: 'https://gitlab.example.com', // self-hosted only
  // redirectUri: 'https://yourapp.com/oauth/callback/gitlab',
});
```

### Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `clientId` | `string` | ✅ | GitLab OAuth Application ID |
| `clientSecret` | `string` | ✅ | GitLab OAuth Application Secret |
| `instanceUrl` | `string` | No | Base URL for self-hosted GitLab (default: `https://gitlab.com`) |
| `redirectUri` | `string` | No | OAuth redirect URI |

## Environment variables

```bash
GITLAB_CLIENT_ID=abc123def456
GITLAB_CLIENT_SECRET=gloas-...
```

## Registering with the hub

```typescript
import { IntegrationHub } from '@apollo-deploy/integrations';
import { createGitlabAdapter } from '@apollo-deploy/adapter-gitlab';

const hub = new IntegrationHub();

hub.register('gitlab', createGitlabAdapter({
  clientId: process.env.GITLAB_CLIENT_ID!,
  clientSecret: process.env.GITLAB_CLIENT_SECRET!,
}));

await hub.initialize();
```

## Webhook handler

```typescript
export async function POST(req: Request) {
  const rawBody = Buffer.from(await req.arrayBuffer());
  const headers = Object.fromEntries(req.headers.entries());

  const result = await hub.webhooks.gitlab({ rawBody, headers });
  return Response.json({ ok: true }, { status: result.statusCode ?? 200 });
}
```

**Signature:** `X-Gitlab-Token: <secret>` (constant-time equality check — no HMAC)

**Supported events:** `Push Hook`, `Tag Push Hook`, `Merge Request Hook`, `Issue Hook`, `Note Hook`, `Pipeline Hook`, `Job Hook`, `Release Hook`, `Deployment Hook`

## Token lifecycle

| Field | Value |
|-------|-------|
| Expiry | 2 hours |
| Refreshable | Yes |
| Rotates refresh token | **Yes ⚠️** |
| Requires distributed lock | **Yes ⚠️** |

GitLab invalidates the existing refresh token on every use. You **must** wrap refresh calls in a distributed lock and atomically write both the new `accessToken` and `refreshToken` to your database.

## Capabilities

### `source-control`

```typescript
const sc = hub.getAdapter('gitlab').sourceControl!;

const repos = await sc.listRepositories(tokens);
const repo = await sc.getRepository(tokens, { projectId: '12345' });
const branches = await sc.listBranches(tokens, { projectId: '12345' });
const pr = await sc.getPullRequest(tokens, { projectId: '12345', mergeRequestIid: 1 });
const commits = await sc.listCommits(tokens, { projectId: '12345' });
```

### `issue-tracking`

```typescript
const it = hub.getAdapter('gitlab').issueTracking!;

const issues = await it.listIssues(tokens, { projectId: '12345' });
const issue = await it.getIssue(tokens, { projectId: '12345', issueIid: 1 });
await it.createIssue(tokens, { projectId: '12345', title: 'Bug in checkout', description: '...' });
await it.updateIssue(tokens, { projectId: '12345', issueIid: 1, stateEvent: 'close' });
await it.addComment(tokens, { projectId: '12345', issueIid: 1, body: 'Fixed in v1.2.3' });
```

## Development

```bash
bun run build
bun run typecheck
bun run test
bun run dev
bun run clean
```
