# @apollo-deploy/adapter-google-play

Google Play Console adapter for the Apollo Deploy integration hub — app releases, track management, rollouts, reviews, ratings, and vitals via the Google Play Developer API.

> **Note:** This adapter was originally built for the [Apollo Deploy](https://apollodeploy.com) platform. We are converting the SDK into a fully generalized, provider-agnostic integration framework that any team can use — independent of Apollo Deploy. The adapter API is designed to be portable and usable standalone or with any hub implementation.

## Installation

```bash
bun add @apollo-deploy/adapter-google-play
```

## Prerequisites

1. Go to **Google Play Console → Setup → API access**
2. Link to a Google Cloud project and enable the **Google Play Android Developer API**
3. Create a **Service Account** in Google Cloud IAM with **Service Account Token Creator** role, then grant it permissions in Play Console
4. Download the **JSON key file** for the service account
5. In Play Console, grant the service account the necessary permissions (at minimum: **Release manager** for track/release operations)

## Configuration

```typescript
import { createGooglePlayAdapter } from '@apollo-deploy/adapter-google-play';

const googlePlay = createGooglePlayAdapter({
  serviceAccountCredentials: JSON.parse(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON!),
  // pubsubVerificationToken: process.env.GOOGLE_PLAY_PUBSUB_TOKEN,
});
```

### Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `serviceAccountCredentials` | `ServiceAccountCredentials` | ✅ | Parsed JSON key file for the Google Cloud service account |
| `pubsubVerificationToken` | `string` | No | Token for verifying Pub/Sub push subscription messages |

### `ServiceAccountCredentials` shape

```typescript
{
  type: 'service_account';
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
}
```

## Environment variables

```bash
# Store the entire JSON key file as a single env var
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key":"...",...}'
GOOGLE_PLAY_PUBSUB_TOKEN=your_verification_token   # optional
```

## Registering with the hub

```typescript
import { IntegrationHub } from '@apollo-deploy/integrations';
import { createGooglePlayAdapter } from '@apollo-deploy/adapter-google-play';

const hub = new IntegrationHub();

hub.register('google-play', createGooglePlayAdapter({
  serviceAccountCredentials: JSON.parse(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON!),
}));

await hub.initialize();
```

## Webhook handler (Pub/Sub)

Google Play sends notifications via **Google Cloud Pub/Sub** push subscriptions rather than traditional webhooks:

```typescript
export async function POST(req: Request) {
  const rawBody = Buffer.from(await req.arrayBuffer());
  const headers = Object.fromEntries(req.headers.entries());

  const result = await hub.webhooks['google-play']({ rawBody, headers });
  return Response.json({ ok: true }, { status: result.statusCode ?? 200 });
}
```

**Verification:** Pub/Sub envelope message token comparison

## Token lifecycle

| Field | Value |
|-------|-------|
| Expiry | 1 hour (Google OAuth2 access tokens) |
| Refreshable | Yes — hub schedules refresh at ~80% lifetime |
| Rotates refresh token | No |
| Requires distributed lock | No |

Service account credentials are long-lived. The adapter uses them to obtain short-lived access tokens via the Google token endpoint.

## Capability: `app-store`

```typescript
const store = hub.getAdapter('google-play').appStore!;

// Builds (APKs/AABs)
const builds = await store.listBuilds(tokens, 'com.example.myapp');
const build = await store.getBuild(tokens, 'com.example.myapp', buildId);

// Tracks & releases
const releases = await store.listReleases(tokens, 'com.example.myapp');

// Promote a build to a track
await store.releaseToTrack(tokens, 'com.example.myapp', {
  track: 'production',
  versionCodes: [42],
  rolloutFraction: 0.1,   // 10% staged rollout
});

// Update rollout percentage
await store.updateRollout(tokens, 'com.example.myapp', {
  track: 'production',
  rolloutFraction: 1.0,   // full rollout
});

// Halt a staged rollout
await store.haltRollout(tokens, 'com.example.myapp', { track: 'production' });

// Reviews & ratings
const reviews = await store.listReviews(tokens, 'com.example.myapp');
await store.replyToReview(tokens, 'com.example.myapp', reviewId, { replyText: 'Thanks!' });
const ratings = await store.getRatingSummary(tokens, 'com.example.myapp');

// Vitals & ANRs
const vitals = await store.listVitals(tokens, 'com.example.myapp');
const anrs = await store.listAnrClusters(tokens, 'com.example.myapp');

// Binary upload (AAB)
const result = await store.uploadBinary(tokens, 'com.example.myapp', {
  fileType: 'aab',
  fileBuffer: fs.readFileSync('app-release.aab'),
  track: 'internal',
});
```

> **Note:** Google Play does not support `listApps`. Store package names (`com.example.myapp`) in your own database.

## Development

```bash
bun run build
bun run typecheck
bun run test
bun run dev
bun run clean
```
