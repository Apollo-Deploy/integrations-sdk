export interface GitlabAdapterConfig {
  clientId: string;
  clientSecret: string;
  /** Defaults to https://gitlab.com */
  instanceUrl?: string;
  redirectUri?: string;
}
