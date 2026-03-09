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
  if (err && typeof err === 'object' && 'status' in err) {
    const status = (err as { status: number }).status;
    if (status === 429 || status >= 500) return true;
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes('rate limit') || msg.includes('secondary rate')
      || msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504');
  }
  return false;
}
