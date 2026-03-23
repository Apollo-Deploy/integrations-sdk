# @apollo-deploy/integrations

Core SDK for the Apollo Deploy integration hub — `IntegrationHub`, `defineAdapter()`, capability interfaces, OAuth utilities, webhook types, and AES-256-GCM crypto.

> **Note:** This SDK was originally built as an internal component of the [Apollo Deploy](https://apollodeploy.com) platform. We are in the process of converting it into a fully generalized, provider-agnostic integration framework that any team can adopt — independent of Apollo Deploy. The public API, adapter contracts, and capability interfaces are designed to be portable and extensible beyond the Apollo Deploy ecosystem.

## Installation

```bash
bun add @apollo-deploy/integrations
```

## Usage

```typescript
import { IntegrationHub, createCryptoProviderFromEnv } from '@apollo-deploy/integrations';
import { createGithubAdapter } from '@apollo-deploy/adapter-github';
import { createSlackAdapter } from '@apollo-deploy/adapter-slack';

export const hub = new IntegrationHub({
  adapters: {
    github: createGithubAdapter({
      appId: process.env.GITHUB_APP_ID!,
      privateKey: process.env.GITHUB_PRIVATE_KEY!,
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      webhookSecret: process.env.GITHUB_WEBHOOK_SECRET!,
    }),
    slack: createSlackAdapter({
      clientId: process.env.SLACK_CLIENT_ID!,
      clientSecret: process.env.SLACK_CLIENT_SECRET!,
      signingSecret: process.env.SLACK_SIGNING_SECRET!,
    }),
  },
  crypto: createCryptoProviderFromEnv(),
  logger: console,
});

await hub.initialize();
```

## API

### `IntegrationHub`

The main entry point. Routes webhooks, dispatches normalized events, and coordinates adapters.

```typescript
// Register additional adapters after construction
hub.register('jira', createJiraAdapter({ ... }));

// Route a webhook request
const res = await hub.webhooks.github({ rawBody, headers });

// Subscribe to normalized events from one provider
hub.onEvent('github', (event) => { ... });

// Subscribe to all events across all providers
hub.onAnyEvent((event, ctx) => { ... });

// List all registered adapters
const adapters = hub.listAdapters();

// Get a single adapter by key
const github = hub.getAdapter('github');

// Get adapters by capability
const trackers = hub.getAdaptersByCapability('issue-tracking');
```

### `defineAdapter()`

Helper for authoring provider adapters in a type-safe way:

```typescript
import { defineAdapter } from '@apollo-deploy/integrations';

export const createMyAdapter = defineAdapter<MyConfig>({
  id: 'my-service',
  name: 'My Service',
  capabilities: ['messaging'],
  tokenMetadata: { expiresInSeconds: 3600, refreshable: true, rotatesRefreshToken: false, requiresRefreshLock: false },
  createOAuthHandler: (config) => ({ ... }),
  createWebhookHandler: (config) => ({ ... }),
  createMessaging: (config) => ({ ... }),
});
```

### Crypto

AES-256-GCM encryption with HKDF-derived keys for at-rest token storage:

```typescript
import { createCryptoProviderFromEnv, encryptGCM, decryptGCM } from '@apollo-deploy/integrations';

// From KMS_ROOT_KEY_B64 env var
const crypto = createCryptoProviderFromEnv();

const encrypted = await crypto.encrypt(JSON.stringify(tokens), { userId: 'u_123' });
const decrypted = await crypto.decrypt(encrypted, { userId: 'u_123' });

// Low-level
const envelope = await encryptGCM(Buffer.from('secret'), rootKey, { userId: 'u_123' });
const plaintext = await decryptGCM(envelope, rootKey, { userId: 'u_123' });
```

Set `KMS_ROOT_KEY_B64` to a base64-encoded 32-byte key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Error types

```typescript
import {
  AdapterError,
  OAuthError,
  WebhookError,
  CapabilityError,
  TokenRefreshError,
  UnknownAdapterError,
} from '@apollo-deploy/integrations';
```

### Capability interfaces

All capability types are exported here and implemented by adapter packages:

| Interface | Capability key |
|-----------|---------------|
| `SourceControlCapability` | `source-control` |
| `MessagingCapability` | `messaging` |
| `IssueTrackingCapability` | `issue-tracking` |
| `AppStoreCapability` | `app-store` |
| `MonitoringCapability` | `monitoring` |

## Environment variables

| Variable | Description |
|----------|-------------|
| `KMS_ROOT_KEY_B64` | Base64-encoded 32-byte root key for AES-256-GCM token encryption |

## Development

```bash
bun run build      # compile TypeScript
bun run typecheck  # type-check without emitting
bun run test       # run tests
bun run dev        # watch mode
bun run clean      # remove build artifacts
```
