export interface SlackAdapterConfig {
  clientId: string;
  clientSecret: string;
  signingSecret: string;
  /** Optional: default bot token scopes to request. */
  scopes?: string[];
  /** Optional: default user token scopes to request. */
  userScopes?: string[];
}
