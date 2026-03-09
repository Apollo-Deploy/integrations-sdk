---
"@apollo-deploy/adapter-discord": patch
"@apollo-deploy/adapter-github": patch
"@apollo-deploy/adapter-gitlab": patch
"@apollo-deploy/adapter-jira": patch
"@apollo-deploy/adapter-linear": patch
"@apollo-deploy/adapter-slack": patch
"@apollo-deploy/adapter-apple": patch
"@apollo-deploy/adapter-google-play": patch
---

Improve error handling robustness across all adapters:

- Mark HTTP 5xx responses as retryable (previously only 429 was retryable)
- Add `OAuthError` throw on `getIdentity()` HTTP failures (GitLab, Jira, Linear, Discord)
- Centralize GitLab error handling in `glFetch` with retryable `CapabilityError`
- Categorize Slack errors into retryable (`rate_limited`, `internal_error`, `request_timeout`, etc.) and auth errors (`invalid_auth`, `token_expired`, etc.)
- Improve Discord `botFetch` with graceful non-JSON error body handling
- Update GitHub `isRetryable` to check Octokit's `.status` property for 429/5xx
