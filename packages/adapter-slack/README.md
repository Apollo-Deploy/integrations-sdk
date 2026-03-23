# @apollo-deploy/adapter-slack

Slack adapter for the Apollo Deploy integration hub — messaging with OAuth 2.0 and HMAC-SHA256 + timestamp anti-replay webhook verification.

> **Note:** This adapter was originally built for the [Apollo Deploy](https://apollodeploy.com) platform. We are converting the SDK into a fully generalized, provider-agnostic integration framework that any team can use — independent of Apollo Deploy. The adapter API is designed to be portable and usable standalone or with any hub implementation.

## Installation

```bash
bun add @apollo-deploy/adapter-slack
```

## Prerequisites

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App → From scratch**
2. Under **OAuth & Permissions**, add your **Redirect URL** and the required **Bot Token Scopes** (e.g. `channels:read`, `chat:write`, `chat:write.public`)
3. Under **Basic Information**, copy the **Client ID**, **Client Secret**, and **Signing Secret**
4. For events: under **Event Subscriptions**, enable events and add your webhook URL

## Configuration

```typescript
import { createSlackAdapter } from '@apollo-deploy/adapter-slack';

const slack = createSlackAdapter({
  clientId: process.env.SLACK_CLIENT_ID!,
  clientSecret: process.env.SLACK_CLIENT_SECRET!,
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
  // scopes: ['channels:read', 'chat:write'],         // default bot scopes for OAuth flow
  // userScopes: ['channels:history'],                 // optional user scopes
});
```

### Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `clientId` | `string` | ✅ | Slack App Client ID |
| `clientSecret` | `string` | ✅ | Slack App Client Secret |
| `signingSecret` | `string` | ✅ | Slack App Signing Secret — used to verify `X-Slack-Signature` |
| `scopes` | `string[]` | No | Default bot token scopes to request during OAuth |
| `userScopes` | `string[]` | No | Default user token scopes to request during OAuth |

## Environment variables

```bash
SLACK_CLIENT_ID=1234567890.9876543210
SLACK_CLIENT_SECRET=abc123def456ghi789
SLACK_SIGNING_SECRET=xyz987...
```

## Registering with the hub

```typescript
import { IntegrationHub } from '@apollo-deploy/integrations';
import { createSlackAdapter } from '@apollo-deploy/adapter-slack';

const hub = new IntegrationHub();

hub.register('slack', createSlackAdapter({
  clientId: process.env.SLACK_CLIENT_ID!,
  clientSecret: process.env.SLACK_CLIENT_SECRET!,
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
}));

await hub.initialize();
```

## Webhook handler

```typescript
export async function POST(req: Request) {
  const rawBody = Buffer.from(await req.arrayBuffer());
  const headers = Object.fromEntries(req.headers.entries());

  // Slack sends a url_verification challenge on first setup — handled automatically
  const result = await hub.webhooks.slack({ rawBody, headers });

  if (result.body) {
    return new Response(JSON.stringify(result.body), {
      status: result.statusCode ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return Response.json({ ok: true }, { status: 200 });
}
```

**Signature:** `X-Slack-Signature: v0=<hmac-sha256>` with `X-Slack-Request-Timestamp` anti-replay (5-minute window)

## Token lifecycle

| Field | Value |
|-------|-------|
| Expiry | Never (unless token rotation is enabled) |
| Refreshable | No |
| Rotates refresh token | No |
| Requires distributed lock | No |

Slack bot tokens (`xoxb-...`) do not expire unless you explicitly enable token rotation in your app settings.

## Capability: `messaging`

```typescript
const msg = hub.getAdapter('slack').messaging!;

// List channels
const channels = await msg.listChannels(tokens);

// Send a plain text message
await msg.sendMessage(tokens, {
  channelId: 'C01234567',
  text: 'Deployment to production succeeded ✅',
});

// Send a rich Block Kit message
await msg.sendRichMessage(tokens, {
  channelId: 'C01234567',
  blocks: [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*Deploy complete* — v1.2.3 is live' },
    },
  ],
});

// Update an existing message
await msg.updateMessage(tokens, {
  channelId: 'C01234567',
  messageId: '1720000000.123456',
  text: 'Updated text',
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
