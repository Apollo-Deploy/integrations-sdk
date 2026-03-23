# @apollo-deploy/adapter-github

GitHub adapter for the Apollo Deploy integration hub — source control via GitHub Apps with HMAC-SHA256 webhook verification.

> **Note:** This adapter was originally built for the [Apollo Deploy](https://apollodeploy.com) platform. We are converting the SDK into a fully generalized, provider-agnostic integration framework that any team can use — independent of Apollo Deploy. The adapter API is designed to be portable and usable standalone or with any hub implementation.

## Installation

```bash
bun add @apollo-deploy/adapter-github
```

## Prerequisites

1. Create a **GitHub App** at [github.com/settings/apps/new](https://github.com/settings/apps/new)
2. Set a **Webhook URL** and generate a **Webhook secret**
3. Generate a **Private key** (RSA) and download the `.pem` file
4. Under **OAuth** settings, copy the **Client ID** and **Client Secret**
5. Install the app on the repositories or organization you want to monitor

## Configuration

```typescript
import { createGithubAdapter } from '@apollo-deploy/adapter-github';

const github = createGithubAdapter({
  appId: process.env.GITHUB_APP_ID!,
  privateKey: process.env.GITHUB_PRIVATE_KEY!,
  clientId: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  webhookSecret: process.env.GITHUB_WEBHOOK_SECRET!,
});
```

### Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `appId` | `string` | ✅ | GitHub App ID (numeric string) |
| `privateKey` | `string` | ✅ | RSA private key (PEM) for JWT signing and installation token generation |
| `clientId` | `string` | ✅ | GitHub OAuth App Client ID |
| `clientSecret` | `string` | ✅ | GitHub OAuth App Client Secret |
| `webhookSecret` | `string` | ✅ | HMAC-SHA256 webhook signing secret |

## Environment variables

```bash
GITHUB_APP_ID=123456
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
GITHUB_CLIENT_ID=Iv1.abc123def456
GITHUB_CLIENT_SECRET=ghsec_...
GITHUB_WEBHOOK_SECRET=whsec_at_least_32_chars
```

## Registering with the hub

```typescript
import { IntegrationHub } from '@apollo-deploy/integrations';
import { createGithubAdapter } from '@apollo-deploy/adapter-github';

const hub = new IntegrationHub();

hub.register('github', createGithubAdapter({
  appId: process.env.GITHUB_APP_ID!,
  privateKey: process.env.GITHUB_PRIVATE_KEY!,
  clientId: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  webhookSecret: process.env.GITHUB_WEBHOOK_SECRET!,
}));

await hub.initialize();
```

## Webhook handler

```typescript
// Next.js route handler
export async function POST(req: Request) {
  const rawBody = Buffer.from(await req.arrayBuffer());
  const headers = Object.fromEntries(req.headers.entries());

  const result = await hub.webhooks.github({ rawBody, headers });
  return Response.json({ ok: true }, { status: result.statusCode ?? 200 });
}
```

**Signature:** `X-Hub-Signature-256: sha256=<hmac-sha256>`

**Supported events:** `push`, `pull_request`, `pull_request_review`, `deployment`, `deployment_status`, `release`, `workflow_run`, `check_run`, `status`, `create`, `delete`

## Token lifecycle

| Field | Value |
|-------|-------|
| Expiry | 1 hour (installation tokens) |
| Refreshable | Yes (JWT re-sign + `/app/installations/{id}/access_tokens`) |
| Rotates refresh token | No |
| Requires distributed lock | No |

Installation tokens are short-lived. The hub automatically re-signs a GitHub App JWT and calls the access token endpoint to refresh them — no standard refresh token is involved.

## Capability: `source-control`

```typescript
const sc = hub.getAdapter('github').sourceControl!;

const repos = await sc.listRepositories(tokens);
const repo = await sc.getRepository(tokens, { owner: 'my-org', repo: 'my-repo' });
const branches = await sc.listBranches(tokens, { owner: 'my-org', repo: 'my-repo' });
const pr = await sc.getPullRequest(tokens, { owner: 'my-org', repo: 'my-repo', number: 42 });
const commits = await sc.listCommits(tokens, { owner: 'my-org', repo: 'my-repo' });

await sc.createCommitStatus(tokens, {
  owner: 'my-org',
  repo: 'my-repo',
  sha: 'abc123',
  state: 'success',
  context: 'ci/deploy',
  description: 'Deployment succeeded',
  targetUrl: 'https://yourapp.com/deployments/42',
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
