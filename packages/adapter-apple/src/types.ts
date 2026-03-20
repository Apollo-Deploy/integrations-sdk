// ─── Apple Connect API response shapes ───────────────────────────────────────

export type AppleApiAttributes = Record<
  string,
  any
>;

export interface AppleApiRelationshipData {
  id: string;
  type: string;
}

export interface AppleApiRelationship {
  data?: AppleApiRelationshipData | AppleApiRelationshipData[];
  links?: { related?: string; self?: string };
}

export interface AppleApiResource {
  id: string;
  type: string;
  attributes: AppleApiAttributes;
  relationships?: Partial<Record<string, AppleApiRelationship>>;
  links?: Record<string, string>;
}

export interface AppleApiListResponse {
  data: AppleApiResource[];
  links?: { self?: string; next?: string; first?: string; last?: string };
  meta?: { paging?: { total?: number; limit?: number } };
}

export interface AppleApiItemResponse {
  data: AppleApiResource;
  included?: AppleApiResource[];
  links?: Record<string, string>;
}

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
