# @apollo-deploy/adapter-discord

Discord adapter for the Apollo Deploy integration hub — messaging with OAuth 2.0 and Ed25519 asymmetric webhook signature verification.

> **Note:** This adapter was originally built for the [Apollo Deploy](https://apollodeploy.com) platform. We are converting the SDK into a fully generalized, provider-agnostic integration framework that any team can use — independent of Apollo Deploy. The adapter API is designed to be portable and usable standalone or with any hub implementation.

## Installation

```bash
bun add @apollo-deploy/adapter-discord
```

## Prerequisites

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications) → **New Application**
2. Under **OAuth2**, copy the **Client ID** and **Client Secret**, and add your **Redirect URI**
3. Under **Bot**, click **Add Bot**, copy the **Bot Token**, and configure the required **Privileged Gateway Intents** if needed
4. Under **General Information**, copy the **Public Key** (Ed25519) for webhook signature verification
5. Invite the bot to your server using the OAuth2 URL Generator with the required scopes (`bot`, `applications.commands`)

## Configuration

```typescript
import { createDiscordAdapter } from '@apollo-deploy/adapter-discord';

const discord = createDiscordAdapter({
  clientId: process.env.DISCORD_CLIENT_ID!,
  clientSecret: process.env.DISCORD_CLIENT_SECRET!,
  publicKey: process.env.DISCORD_PUBLIC_KEY!,
  botToken: process.env.DISCORD_BOT_TOKEN!,
  // guildId: process.env.DISCORD_GUILD_ID,      // default server for channel operations
  // redirectUri: 'https://yourapp.com/oauth/callback/discord',
});
```

### Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `clientId` | `string` | ✅ | Discord Application Client ID |
| `clientSecret` | `string` | ✅ | Discord Application Client Secret |
| `publicKey` | `string` | ✅ | Ed25519 public key from the Discord developer portal — used to verify webhook signatures |
| `botToken` | `string` | ✅ | Discord Bot Token (`Bot xxxx...`) for API calls |
| `guildId` | `string` | No | Default guild (server) ID for channel operations |
| `redirectUri` | `string` | No | OAuth2 redirect URI |

## Environment variables

```bash
DISCORD_CLIENT_ID=123456789012345678
DISCORD_CLIENT_SECRET=abc123def456ghi789
DISCORD_PUBLIC_KEY=a1b2c3d4e5f6...
DISCORD_BOT_TOKEN=Bot MTIz...
DISCORD_GUILD_ID=987654321098765432
```

## Registering with the hub

```typescript
import { IntegrationHub } from '@apollo-deploy/integrations';
import { createDiscordAdapter } from '@apollo-deploy/adapter-discord';

const hub = new IntegrationHub();

hub.register('discord', createDiscordAdapter({
  clientId: process.env.DISCORD_CLIENT_ID!,
  clientSecret: process.env.DISCORD_CLIENT_SECRET!,
  publicKey: process.env.DISCORD_PUBLIC_KEY!,
  botToken: process.env.DISCORD_BOT_TOKEN!,
}));

await hub.initialize();
```

## Webhook handler

```typescript
export async function POST(req: Request) {
  const rawBody = Buffer.from(await req.arrayBuffer());
  const headers = Object.fromEntries(req.headers.entries());

  // Discord sends PING interactions — handled automatically with a PONG response
  const result = await hub.webhooks.discord({ rawBody, headers });

  return new Response(
    result.body ? JSON.stringify(result.body) : '{"ok":true}',
    {
      status: result.statusCode ?? 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}
```

**Signature:** `X-Signature-Ed25519` + `X-Signature-Timestamp` (asymmetric Ed25519 — no shared secret needed)

## Token lifecycle

| Field | Value |
|-------|-------|
| Expiry | 7 days (OAuth user tokens) |
| Refreshable | Yes |
| Rotates refresh token | No |
| Requires distributed lock | No |

## Capability: `messaging`

```typescript
const msg = hub.getAdapter('discord').messaging!;

// List channels in the default or specified guild
const channels = await msg.listChannels(tokens);

// Send a plain text message
await msg.sendMessage(tokens, {
  channelId: '1234567890123456789',
  text: 'Deployment to production succeeded ✅',
});

// Send an embed (rich message)
await msg.sendRichMessage(tokens, {
  channelId: '1234567890123456789',
  blocks: [
    {
      type: 'embed',
      title: 'Deploy complete',
      description: 'v1.2.3 is live in production',
      color: 0x57f287,
    },
  ],
});

// Update an existing message
await msg.updateMessage(tokens, {
  channelId: '1234567890123456789',
  messageId: '9876543210987654321',
  text: 'Updated content',
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
