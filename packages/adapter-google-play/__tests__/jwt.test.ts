import { describe, test, expect } from 'bun:test';
import crypto from 'node:crypto';
import { generateGoogleJWT } from '../src/oauth';
import type { ServiceAccountCredentials } from '../src/types';

function generateTestRSAKeyPair() {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

function base64urlDecode(str: string): unknown {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
}

function makeCreds(privateKey: string): ServiceAccountCredentials {
  return {
    type: 'service_account',
    project_id: 'my-project-123',
    private_key_id: 'key-001',
    private_key: privateKey,
    client_email: 'service@my-project-123.iam.gserviceaccount.com',
    client_id: '123456789',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
  };
}

describe('generateGoogleJWT', () => {
  test('produces a valid 3-part JWT', () => {
    const { privateKey } = generateTestRSAKeyPair();
    const jwt = generateGoogleJWT(makeCreds(privateKey));
    const parts = jwt.split('.');
    expect(parts).toHaveLength(3);
  });

  test('header contains alg: RS256 and typ: JWT', () => {
    const { privateKey } = generateTestRSAKeyPair();
    const jwt = generateGoogleJWT(makeCreds(privateKey));
    const [header] = jwt.split('.');
    const decoded = base64urlDecode(header) as Record<string, string>;
    expect(decoded.alg).toBe('RS256');
    expect(decoded.typ).toBe('JWT');
  });

  test('payload contains correct iss, scope, aud, iat, exp', () => {
    const { privateKey } = generateTestRSAKeyPair();
    const creds = makeCreds(privateKey);
    const before = Math.floor(Date.now() / 1000);
    const jwt = generateGoogleJWT(creds);
    const after = Math.floor(Date.now() / 1000);

    const [, payloadPart] = jwt.split('.');
    const payload = base64urlDecode(payloadPart) as Record<string, unknown>;

    expect(payload.iss).toBe(creds.client_email);
    expect(payload.scope).toBe('https://www.googleapis.com/auth/androidpublisher');
    expect(payload.aud).toBe('https://oauth2.googleapis.com/token');
    expect(payload.iat as number).toBeGreaterThanOrEqual(before);
    expect(payload.iat as number).toBeLessThanOrEqual(after);
    expect((payload.exp as number) - (payload.iat as number)).toBe(3600); // 1 hour
  });

  test('signature is verifiable with corresponding RSA public key', () => {
    const { privateKey, publicKey } = generateTestRSAKeyPair();
    const jwt = generateGoogleJWT(makeCreds(privateKey));

    const [header, payloadPart, sig] = jwt.split('.');
    const signingInput = `${header}.${payloadPart}`;

    const padded = sig + '='.repeat((4 - (sig.length % 4)) % 4);
    const sigBuf = Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(signingInput);
    expect(verify.verify(publicKey, sigBuf)).toBe(true);
  });

  test('different client emails produce different JWTs', () => {
    const { privateKey } = generateTestRSAKeyPair();
    const creds1 = makeCreds(privateKey);
    const creds2 = { ...creds1, client_email: 'other@project.iam.gserviceaccount.com' };
    const jwt1 = generateGoogleJWT(creds1);
    const jwt2 = generateGoogleJWT(creds2);
    expect(jwt1).not.toBe(jwt2);
  });
});
