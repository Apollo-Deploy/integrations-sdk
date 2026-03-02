/** Configuration for the GitHub App adapter. */
export interface GithubAdapterConfig {
  /** GitHub App ID (numeric string). */
  appId: string;
  /** RSA private key (PEM) for JWT signing. */
  privateKey: string;
  /** OAuth App client ID. */
  clientId: string;
  /** OAuth App client secret. */
  clientSecret: string;
  /** Webhook secret for HMAC-SHA256 signature verification. */
  webhookSecret: string;
}
