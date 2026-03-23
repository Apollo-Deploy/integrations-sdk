# @apollo-deploy/adapter-github

## 1.4.3

### Patch Changes

- ac32858: Merge pull request #10 from Apollo-Deploy/changeset-release/main
- Updated dependencies [ac32858]
  - @apollo-deploy/integrations@1.5.3

## 1.4.2

### Patch Changes

- d64e481: Chore: Bump Versions
- 8ae0c88: docs: add Sentry adapter docs, monitoring capability, and package READMEs
- Updated dependencies [d64e481]
- Updated dependencies [8ae0c88]
  - @apollo-deploy/integrations@1.5.2

## 1.4.1

### Patch Changes

- 0e39c54: Merge pull request #8 from Apollo-Deploy/changeset-release/main
- Updated dependencies [0e39c54]
  - @apollo-deploy/integrations@1.5.1

## 1.4.0

### Minor Changes

- 20d57dd: feat: move compareReleaseWindows to monitoring capability
- 3f7bce1: feat: add getChangedFiles to source control capability

### Patch Changes

- 943eac6: Merge pull request #6 from Apollo-Deploy/changeset-release/main
- Updated dependencies [20d57dd]
- Updated dependencies [9deb1f1]
- Updated dependencies [943eac6]
- Updated dependencies [5f506a8]
- Updated dependencies [3f7bce1]
  - @apollo-deploy/integrations@1.5.0

## 1.3.1

### Patch Changes

- 7ec2981: Merge pull request #5 from Apollo-Deploy/changeset-release/main
- Updated dependencies [7ec2981]
  - @apollo-deploy/integrations@1.4.1

## 1.3.0

### Minor Changes

- a6920f7: feat: add changed files, code scanning, and commit status reads to source control
- a5c584a: feat: add compareReleaseWindows to source control capability

### Patch Changes

- a58ee75: Merge pull request #4 from Apollo-Deploy/changeset-release/main
- Updated dependencies [63130a8]
- Updated dependencies [a6920f7]
- Updated dependencies [53bb681]
- Updated dependencies [a5c584a]
  - @apollo-deploy/integrations@1.4.0

## 1.2.2

### Patch Changes

- 4493c75: fix: replace workspace:\* with ^1.3.1 for external consumers

## 1.2.1

### Patch Changes

- f886161: Merge pull request #1 from Apollo-Deploy/changeset-release/main
- Updated dependencies [f886161]
  - @apollo-deploy/integrations@1.3.1

## 1.2.0

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

## 1.1.1

### Patch Changes

- Updated dependencies
  - @apollo-deploy/integrations@1.2.0
