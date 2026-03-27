import { JWT } from "google-auth-library";
import type {
  OAuthHandler,
  TokenSet,
  ProviderIdentity,
  AuthorizationParams,
  CodeExchangeParams,
} from "@apollo-deploy/integrations";
import { OAuthError } from "@apollo-deploy/integrations";
import type {
  GooglePlayAdapterConfig,
} from "./types.js";

const SCOPE = "https://www.googleapis.com/auth/androidpublisher";

export function createGooglePlayOAuth(
  config: GooglePlayAdapterConfig,
): OAuthHandler {
  const creds = config.serviceAccountCredentials;

  return {
    getAuthorizationUrl(_params: AuthorizationParams) {
      throw new OAuthError(
        "google-play",
        "Google Play uses service account authentication, not OAuth",
      );
    },

    async exchangeCode(_params: CodeExchangeParams): Promise<TokenSet> {
      throw new OAuthError(
        "google-play",
        "Google Play uses service account authentication, not OAuth",
      );
    },

    async refreshToken(_refreshToken: string): Promise<TokenSet> {
      const client = new JWT({
        email: creds.client_email,
        key: creds.private_key,
        scopes: [SCOPE],
      });

      const { token, res } = await client.getAccessToken();
      if (token == null) {
        throw new OAuthError("google-play", "Failed to obtain access token from Google");
      }

      const expiresAt = res?.data?.expiry_date != null
        ? new Date(res.data.expiry_date as number)
        : new Date(Date.now() + 3600 * 1000);

      return {
        accessToken: token,
        expiresAt,
        scope: SCOPE,
        providerData: {
          clientEmail: creds.client_email,
          projectId: creds.project_id,
        },
      };
    },

    async getIdentity(_accessToken: string): Promise<ProviderIdentity> {
      return {
        providerAccountId: creds.client_email,
        displayName: `Google Play (${creds.project_id})`,
        email: creds.client_email,
        avatarUrl: undefined,
        metadata: {
          projectId: creds.project_id,
          clientEmail: creds.client_email,
        },
      };
    },
  };
}
