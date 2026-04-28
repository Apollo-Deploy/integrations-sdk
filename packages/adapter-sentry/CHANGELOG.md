# @apollo-deploy/adapter-sentry

## 2.0.0

### Major Changes

- Replace the old adapter manifest auth/config schema surface with the new UI manifest and choice-loading API.

  This removes the legacy `metadata.auth`, `configSchema`, and related exported auth/config types in favor of `ui.manifest`, `listChoices`, and the new UI field/choice types.

### Patch Changes

- Updated dependencies
  - @apollo-deploy/integrations@2.0.0

## 1.0.3

### Patch Changes

- 4493c75: fix: replace workspace:\* with ^1.3.1 for external consumers

## 1.0.2

### Patch Changes

- Updated dependencies [f886161]
  - @apollo-deploy/integrations@1.3.1

## 1.0.1

### Patch Changes

- Updated dependencies [d38aa7d]
  - @apollo-deploy/integrations@1.3.0
