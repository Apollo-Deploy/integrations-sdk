import crypto from "node:crypto";
import type {
  OAuthHandler,
  TokenSet,
  ProviderIdentity,
} from "@apollo-deploy/integrations";
import { OAuthError } from "@apollo-deploy/integrations";
import type {
  GooglePlayAdapterConfig,
  ServiceAccountCredentials,
} from "./types.js";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";
export const GCS_SCOPE = "https://www.googleapis.com/auth/devstorage.read_only";

export function createGooglePlayOAuth(
  config: GooglePlayAdapterConfig,
): OAuthHandler {
  const creds = config.serviceAccountCredentials;

  return {
    getAuthorizationUrl() {
      throw new OAuthError(
        "google-play",
        "Google Play uses service account authentication, not OAuth",
      );
    },

    async exchangeCode(): Promise<TokenSet> {
      throw new OAuthError(
        "google-play",
        "Google Play uses service account authentication, not OAuth",
      );
    },

    async refreshToken(_refreshToken: string): Promise<TokenSet> {
      const jwt = generateGoogleJWT(creds);

      const res = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion: jwt,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new OAuthError(
          "google-play",
          `Token exchange failed: ${res.status} ${body}`,
        );
      }

      const data = (await res.json()) as {
        access_token: string;
        expires_in: number;
      };
      return {
        accessToken: data.access_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
        scope: SCOPE,
        providerData: {
          clientEmail: creds.client_email,
          projectId: creds.project_id,
        },
      };
    },

    async getIdentity(_accessToken: string): Promise<ProviderIdentity> {
      return Promise.resolve({
        providerAccountId: creds.client_email,
        displayName: `Google Play (${creds.project_id})`,
        email: creds.client_email,
        avatarUrl: undefined,
        metadata: {
          projectId: creds.project_id,
          clientEmail: creds.client_email,
        },
      });
    },
  };
}

/**
 * Generate a JWT for Google's OAuth2 token endpoint.
 *
 * Header: { alg: 'RS256', typ: 'JWT' }
 * Payload: { iss, scope, aud, iat, exp }
 * Signed with: RS256 using service account private key
 *
 * @param scope - OAuth2 scope(s) to request. Defaults to the Android Publisher
 *   scope. Pass {@link GCS_SCOPE} (or a space-separated list) to mint a token
 *   for Cloud Storage access.
 */
export function generateGoogleJWT(
  creds: ServiceAccountCredentials,
  scope: string = SCOPE,
): string {
  const header = { alg: "RS256", typ: "JWT" };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: creds.client_email,
    scope,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signingInput);
  const signature = sign.sign(creds.private_key, "base64url");

  return `${signingInput}.${signature}`;
}

/**
 * Exchange a service-account JWT for a short-lived access token scoped to
 * Google Cloud Storage (read-only). Use this wherever GCS API calls are needed
 * rather than re-using the Android Publisher token.
 */
export async function mintGcsAccessToken(
  creds: ServiceAccountCredentials,
): Promise<string> {
  const jwt = generateGoogleJWT(creds, GCS_SCOPE);

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new OAuthError(
      "google-play",
      `GCS token exchange failed: ${res.status} ${body}`,
    );
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

function base64url(str: string): string {
  return Buffer.from(str).toString("base64url");
}
