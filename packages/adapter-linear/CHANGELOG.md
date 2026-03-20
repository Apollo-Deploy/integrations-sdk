# @apollo-deploy/adapter-linear

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
