export interface GooglePlayAdapterConfig {
  /** Service Account credentials — the contents of the downloaded JSON key file */
  serviceAccountCredentials: ServiceAccountCredentials;
  /** Optional: For Pub/Sub push verification */
  pubsubVerificationToken?: string;
}

export interface ServiceAccountCredentials {
  type: "service_account";
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
}
