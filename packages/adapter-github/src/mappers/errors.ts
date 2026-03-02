/**
 * GitHub error → AdapterError mapper.
 */
import { CapabilityError } from '@apollo-deploy/integrations';

export function mapGithubError(err: unknown): CapabilityError {
  const message = err instanceof Error ? err.message : String(err);
  const retryable = isRetryable(err);
  return new CapabilityError('github', message, retryable);
}

function isRetryable(err: unknown): boolean {
  if (err instanceof Error) {
    // GitHub 429 / 503 are retryable
    const msg = err.message.toLowerCase();
    return msg.includes('rate limit') || msg.includes('503') || msg.includes('secondary rate');
  }
  return false;
}
