export interface GooglePlayAdapterConfig {
  /** Service Account credentials — the contents of the downloaded JSON key file */
  serviceAccountCredentials: ServiceAccountCredentials;
  /** Optional: For Pub/Sub push verification */
  pubsubVerificationToken?: string;
  /**
   * Your Google Play developer account ID (numeric).
   * Visible in the Play Console URL:
   *   https://play.google.com/console/u/0/developers/{DEVELOPER_ACCOUNT_ID}/...
   *
   * Required for `getInstallStats` — used to locate the Cloud Storage bucket:
   *   `gs://pubsite_prod_rev_{developerAccountId}/stats/installs/`
   */
  developerAccountId?: string;
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
