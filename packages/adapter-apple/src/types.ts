export interface AppleAdapterConfig {
  /** Issuer ID from App Store Connect → Users and Access → Integrations → Keys */
  issuerId: string;
  /** Key ID from the API key you generated */
  keyId: string;
  /** Contents of the .p8 private key file (PEM-encoded ES256 key) */
  privateKey: string;
  /** Optional: Webhook secret for verifying App Store Connect webhook signatures */
  webhookSecret?: string;
}
