/**
 * OAuth handler interface — every adapter provides one.
 * The hub manages state signing, persistence, and scheduling.
 * The adapter encapsulates provider-specific protocol details.
 */
export interface OAuthHandler {
  /**
   * Build the authorization URL the user's browser navigates to.
   * The hub manages state signing/validation — adapter just builds the URL.
   */
  getAuthorizationUrl(params: AuthorizationParams): string;

  /**
   * Exchange the authorization code for tokens.
   * Returns raw tokens — the hub encrypts and persists them.
   */
  exchangeCode(params: CodeExchangeParams): Promise<TokenSet>;

  /**
   * Refresh an expired access token.
   * Throws AdapterError if the provider does not support refresh.
   */
  refreshToken(refreshToken: string): Promise<TokenSet>;

  /**
   * Fetch the authenticated identity from the provider.
   * Used to populate connection metadata (org name, avatar, etc.)
   */
  getIdentity(accessToken: string): Promise<ProviderIdentity>;

  /**
   * Optional: post-authorization setup.
   * GitHub: discover installations.
   * Jira: discover accessible cloud sites.
   * Returns null if not applicable.
   */
  afterAuthorize?(tokens: TokenSet): Promise<PostAuthResult>;
}

export interface AuthorizationParams {
  state: string;
  scopes: string[];
  redirectUri: string;
  /** Provider-specific extras: Slack's user_scope, GitHub's login hint, etc. */
  extras?: Record<string, string>;
}

export interface CodeExchangeParams {
  code: string;
  redirectUri: string;
  /** For PKCE flows. */
  codeVerifier?: string;
}

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  /** Space-separated scope string from the provider. */
  scope: string;
  /**
   * Provider-specific extras stored in connection metadata JSONB.
   * GitHub:   { installationId, appId }
   * Slack:    { teamId, teamName, botUserId, userAccessToken }
   * Jira:     { cloudId, cloudName }
   * GitLab:   { instanceUrl }
   */
  providerData: Record<string, unknown>;
}

export interface ProviderIdentity {
  providerAccountId: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  metadata: Record<string, unknown>;
}

export interface PostAuthResult {
  /** Additional metadata to merge into the connection record. */
  metadata: Record<string, unknown>;
  /** Override scopes if the provider reports different scopes than requested. */
  scopes?: string[];
}
