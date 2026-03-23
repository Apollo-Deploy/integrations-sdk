# @apollo-deploy/adapter-google-play

## 1.4.3

### Patch Changes

- 8ae0c88: docs: add Sentry adapter docs, monitoring capability, and package READMEs
- 0e39c54: Merge pull request #8 from Apollo-Deploy/changeset-release/main
- Updated dependencies [8ae0c88]
- Updated dependencies [0e39c54]
  - @apollo-deploy/integrations@1.5.1

## 1.4.2

### Patch Changes

- 943eac6: Merge pull request #6 from Apollo-Deploy/changeset-release/main
- Updated dependencies [20d57dd]
- Updated dependencies [9deb1f1]
- Updated dependencies [943eac6]
- Updated dependencies [5f506a8]
- Updated dependencies [3f7bce1]
  - @apollo-deploy/integrations@1.5.0

## 1.4.1

### Patch Changes

- 7ec2981: Merge pull request #5 from Apollo-Deploy/changeset-release/main
- Updated dependencies [7ec2981]
  - @apollo-deploy/integrations@1.4.1

## 1.4.0

### Minor Changes

- 63130a8: feat: replace SetupFlow string with SetupFlowStep[] array

### Patch Changes

- a58ee75: Merge pull request #4 from Apollo-Deploy/changeset-release/main
- Updated dependencies [63130a8]
- Updated dependencies [a6920f7]
- Updated dependencies [53bb681]
- Updated dependencies [a5c584a]
  - @apollo-deploy/integrations@1.4.0

## 1.3.2

### Patch Changes

- 4493c75: fix: replace workspace:\* with ^1.3.1 for external consumers

## 1.3.1

### Patch Changes

- f886161: Merge pull request #1 from Apollo-Deploy/changeset-release/main
- bfaa81e: fix: correct dist output paths and prevent auto-changeset loop
- Updated dependencies [f886161]
  - @apollo-deploy/integrations@1.3.1

## 1.3.0

### Minor Changes

- d38aa7d: feat: expand adapters and stabilize build/lint

### Patch Changes

- 51cb2a6: fix: improve error handling robustness across all adapters
- d0f3421: Improve error handling robustness across all adapters:
  - Mark HTTP 5xx responses as retryable (previously only 429 was retryable)
  - Add `OAuthError` throw on `getIdentity()` HTTP failures (GitLab, Jira, Linear, Discord)
  - Centralize GitLab error handling in `glFetch` with retryable `CapabilityError`
  - Categorize Slack errors into retryable (`rate_limited`, `internal_error`, `request_timeout`, etc.) and auth errors (`invalid_auth`, `token_expired`, etc.)
  - Improve Discord `botFetch` with graceful non-JSON error body handling
  - Update GitHub `isRetryable` to check Octokit's `.status` property for 429/5xx

- Updated dependencies [d38aa7d]
  - @apollo-deploy/integrations@1.3.0

## 1.2.0

### Minor Changes

- Add modular capability architecture, auth config types, and generated artifacts support

  **`@apollo-deploy/integrations`**
  - Split `types/models.ts` into domain-specific files (`models/shared`, `models/app-store`, `models/source-control`, `models/messaging`, `models/issue-tracking`) with a barrel `models/index.ts`
  - Add auth config types: `AuthMethod`, `SetupFlow`, `CredentialInputField`, `AdapterAuthConfig`, `ClientAuthConfig`
  - Add `AdapterFactory<TConfig>` with a static `.definition` property exposing adapter metadata without requiring credentials
  - Extend `AppStoreCapability` with six new sections:
    - **Binary uploads** — `uploadBinary` (AAB, APK, IPA; store + internal-sharing channels)
    - **App Recovery** — `listAppRecoveryActions`, `createAppRecoveryAction`, `deployAppRecoveryAction`, `cancelAppRecoveryAction`, `addAppRecoveryTargeting` (Google Play only)
    - **Phased releases** — `createPhasedRelease`, `getPhasedRelease`, `updatePhasedRelease`, `deletePhasedRelease`
    - **Manual release requests** — `createReleaseRequest`
    - **Generated artifacts** — `listGeneratedArtifacts`, `downloadGeneratedArtifact`, `listBuildDeliverables`
  - `hub.listAdapters()` now includes a `ClientAuthConfig auth` field derived from each adapter's `AdapterAuthConfig`

  **`@apollo-deploy/adapter-apple`**
  - Replace monolithic `capabilities/app-store.ts` with domain-specific modules: `_context`, `apps`, `builds`, `releases`, `reviews`, `beta`, `vitals`, `recovery`, `phased-releases`, `generated-artifacts`
  - Implement all new `AppStoreCapability` methods (recovery methods throw `CapabilityError` — Google Play only)
  - `generated-artifacts`: queries Build Bundles, app thinning file sizes, and dSYMs via App Store Connect API
  - Add `AdapterAuthConfig` credential form (Issuer ID, Key ID, private key .p8)

  **`@apollo-deploy/adapter-google-play`**
  - Replace monolithic `capabilities/app-store.ts` with domain-specific modules: `_context`, `apps`, `builds`, `releases`, `reviews`, `beta`, `vitals`, `recovery`, `phased-releases`, `generated-artifacts`
  - Implement all new `AppStoreCapability` methods including full App Recovery support
  - `generated-artifacts`: implements `generatedapks.list` and `generatedapks.download` from the Android Publisher API
  - Add `AdapterAuthConfig` credential form (service account JSON)

### Patch Changes

- Updated dependencies
  - @apollo-deploy/integrations@1.2.0
