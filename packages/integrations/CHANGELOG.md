# @apollo-deploy/integrations

## 1.6.0

### Minor Changes

- 3796a94: feat(apple): add per-version install stats via APP_INSTALLS report

### Patch Changes

- b8ea15f: Merge pull request #13 from Apollo-Deploy/changeset-release/main

## 1.5.5

### Patch Changes

- 36f80a9: Merge pull request #12 from Apollo-Deploy/changeset-release/main

## 1.5.4

### Patch Changes

- 4374a3d: Merge branch 'main' of https://github.com/Apollo-Deploy/integrations-sdk
- a044d93: Merge pull request #11 from Apollo-Deploy/changeset-release/main

## 1.5.3

### Patch Changes

- ac32858: Merge pull request #10 from Apollo-Deploy/changeset-release/main

## 1.5.2

### Patch Changes

- d64e481: Chore: Bump Versions
- 8ae0c88: docs: add Sentry adapter docs, monitoring capability, and package READMEs

## 1.5.1

### Patch Changes

- 0e39c54: Merge pull request #8 from Apollo-Deploy/changeset-release/main

## 1.5.0

### Minor Changes

- 20d57dd: feat: move compareReleaseWindows to monitoring capability
- 5f506a8: feat: centralise OAuth2 in core with createOAuthHandler factory
- 3f7bce1: feat: add getChangedFiles to source control capability

### Patch Changes

- 9deb1f1: refactor: move ReleaseWindow exports to monitoring section in index.ts
- 943eac6: Merge pull request #6 from Apollo-Deploy/changeset-release/main

## 1.4.1

### Patch Changes

- 7ec2981: Merge pull request #5 from Apollo-Deploy/changeset-release/main

## 1.4.0

### Minor Changes

- 63130a8: feat: replace SetupFlow string with SetupFlowStep[] array
- a6920f7: feat: add changed files, code scanning, and commit status reads to source control
- 53bb681: feat: add ConfigField and configSchema to adapter metadata
- a5c584a: feat: add compareReleaseWindows to source control capability

## 1.3.1

### Patch Changes

- f886161: Merge pull request #1 from Apollo-Deploy/changeset-release/main

## 1.3.0

### Minor Changes

- d38aa7d: feat: expand adapters and stabilize build/lint

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
