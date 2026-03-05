# @apollo-deploy/adapter-google-play

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
