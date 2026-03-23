# @apollo-deploy/adapter-apple

Apple App Store Connect adapter for the Apollo Deploy integration hub — app management, TestFlight builds, releases, reviews, ratings, phased releases, and more via the App Store Connect API.

> **Note:** This adapter was originally built for the [Apollo Deploy](https://apollodeploy.com) platform. We are converting the SDK into a fully generalized, provider-agnostic integration framework that any team can use — independent of Apollo Deploy. The adapter API is designed to be portable and usable standalone or with any hub implementation.

## Installation

```bash
bun add @apollo-deploy/adapter-apple
```

## Prerequisites

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **Users and Access → Integrations → Team Keys**
2. Click **+** to generate a new API key with the appropriate role (at minimum **Developer** for read access; **App Manager** for releases)
3. Download the `.p8` private key file (you can only download it once)
4. Note the **Issuer ID** (shown at the top of the page) and the **Key ID** for your key

## Configuration

```typescript
import { createAppleAdapter } from '@apollo-deploy/adapter-apple';

const apple = createAppleAdapter({
  issuerId: process.env.APPLE_ISSUER_ID!,
  keyId: process.env.APPLE_KEY_ID!,
  privateKey: process.env.APPLE_PRIVATE_KEY!,    // contents of the .p8 file
  // webhookSecret: process.env.APPLE_WEBHOOK_SECRET,
});
```

### Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `issuerId` | `string` | ✅ | Issuer ID from App Store Connect → Users and Access → Integrations → Team Keys |
| `keyId` | `string` | ✅ | 10-character API key identifier (e.g. `2X9R4HXF34`) |
| `privateKey` | `string` | ✅ | PEM-encoded ES256 private key — the contents of your `.p8` file |
| `webhookSecret` | `string` | No | Webhook signing secret for verifying App Store Connect webhook signatures |

## Environment variables

```bash
APPLE_ISSUER_ID=57246542-96fe-1a63-e053-0824d011072a
APPLE_KEY_ID=2X9R4HXF34
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

To store the private key as a single-line env var:

```bash
APPLE_PRIVATE_KEY=$(cat AuthKey_2X9R4HXF34.p8 | base64)
# Then decode in your app: Buffer.from(process.env.APPLE_PRIVATE_KEY!, 'base64').toString()
```

## Registering with the hub

```typescript
import { IntegrationHub } from '@apollo-deploy/integrations';
import { createAppleAdapter } from '@apollo-deploy/adapter-apple';

const hub = new IntegrationHub();

hub.register('apple', createAppleAdapter({
  issuerId: process.env.APPLE_ISSUER_ID!,
  keyId: process.env.APPLE_KEY_ID!,
  privateKey: process.env.APPLE_PRIVATE_KEY!,
}));

await hub.initialize();
```

## Webhook handler

```typescript
export async function POST(req: Request) {
  const rawBody = Buffer.from(await req.arrayBuffer());
  const headers = Object.fromEntries(req.headers.entries());

  const result = await hub.webhooks.apple({ rawBody, headers });
  return Response.json({ ok: true }, { status: result.statusCode ?? 200 });
}
```

**Signature:** `signedPayload` field in the JSON body (signed JWT — no `X-` header)

## Token lifecycle

Authentication uses short-lived **JWTs** (up to 20 minutes) generated from your private key — no OAuth flow or refresh token:

| Field | Value |
|-------|-------|
| Expiry | 20 minutes (JWT) |
| Refreshable | No — a new JWT is generated per request |
| Rotates refresh token | No |
| Requires distributed lock | No |

## Capability: `app-store`

```typescript
const store = hub.getAdapter('apple').appStore!;

// List apps
const apps = await store.listApps(tokens);
const app = await store.getApp(tokens, 'com.example.myapp');

// Builds
const builds = await store.listBuilds(tokens, appId, { version: '2.1.0' });
const build = await store.getBuild(tokens, appId, buildId);

// Releases (App Store versions)
const releases = await store.listReleases(tokens, appId);
await store.submitForReview(tokens, appId, { versionId });
await store.releaseToTrack(tokens, appId, { versionId, phased: true });

// TestFlight
const betaGroups = await store.listBetaGroups(tokens, appId);
await store.addBetaTester(tokens, appId, betaGroupId, { email: 'tester@example.com' });

// Reviews & ratings
const reviews = await store.listReviews(tokens, appId, { territory: 'US' });
await store.replyToReview(tokens, appId, reviewId, { body: 'Thank you for your feedback!' });
const ratings = await store.getRatingSummary(tokens, appId);

// Vitals & crashes
const vitals = await store.listVitals(tokens, appId);
const crashes = await store.listCrashClusters(tokens, appId);

// Phased releases
await store.createPhasedRelease(tokens, appId, versionId, { phasedReleaseState: 'ACTIVE' });

// Artifacts (dSYMs)
const artifacts = await store.listBuildArtifacts(tokens, appId, buildId);
const { url } = await store.getArtifactDownloadUrl(tokens, appId, buildId, artifactId);
```

## Development

```bash
bun run build
bun run typecheck
bun run test
bun run dev
bun run clean
```
