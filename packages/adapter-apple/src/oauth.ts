import crypto from 'node:crypto';
import type { OAuthHandler, TokenSet, ProviderIdentity } from '@apollo-deploy/integrations';
import { OAuthError } from '@apollo-deploy/integrations';
import type { AppleAdapterConfig } from './types.js';

export function createAppleOAuth(config: AppleAdapterConfig): OAuthHandler {
  return {
    getAuthorizationUrl() {
      // Apple uses API keys, not OAuth. The UI should render a credential
      // form (Issuer ID, Key ID, Private Key) instead of redirecting.
      throw new OAuthError('apple', 'Apple App Store Connect uses API key authentication, not OAuth');
    },

    async exchangeCode() {
      // Not used — connection is created via direct credential submission.
      throw new OAuthError('apple', 'Apple App Store Connect uses API key authentication, not OAuth');
    },

    async refreshToken(_refreshToken: string): Promise<TokenSet> {
      // Generate a fresh JWT — this is a new token, not a refresh.
      const jwt = generateAppleJWT(config);
      return {
        accessToken: jwt,
        expiresAt: new Date(Date.now() + 20 * 60 * 1000), // 20 minutes
        scope: 'app-store-connect',
        providerData: {
          issuerId: config.issuerId,
          keyId: config.keyId,
        },
      };
    },

    async getIdentity(accessToken: string): Promise<ProviderIdentity> {
      // Verify credentials by listing apps
      const res = await fetch('https://api.appstoreconnect.apple.com/v1/apps?limit=1', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        throw new OAuthError('apple', `Failed to verify Apple credentials: ${res.status}`);
      }

      return {
        providerAccountId: config.issuerId,
        displayName: `Apple Developer (${config.keyId})`,
        email: undefined,
        avatarUrl: undefined,
        metadata: {
          issuerId: config.issuerId,
          keyId: config.keyId,
        },
      };
    },
  };
}

/**
 * Generate a signed JWT for App Store Connect API.
 *
 * Header: { alg: 'ES256', kid: keyId, typ: 'JWT' }
 * Payload: { iss: issuerId, iat: now, exp: now + 20min, aud: 'appstoreconnect-v1' }
 * Signed with: ES256 using the .p8 private key
 */
export function generateAppleJWT(config: AppleAdapterConfig): string {
  const header = {
    alg: 'ES256',
    kid: config.keyId,
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: config.issuerId,
    iat: now,
    exp: now + 20 * 60, // 20 minutes
    aud: 'appstoreconnect-v1',
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const sign = crypto.createSign('SHA256');
  sign.update(signingInput);
  const signature = sign.sign(config.privateKey, 'base64url');

  return `${signingInput}.${signature}`;
}

function base64url(str: string): string {
  return Buffer.from(str).toString('base64url');
}
