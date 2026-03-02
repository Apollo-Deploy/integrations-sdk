export interface DiscordAdapterConfig {
  clientId: string;
  clientSecret: string;
  /** Ed25519 public key from the Discord developer portal */
  publicKey: string;
  /** Bot token (Bot xxxx…) */
  botToken: string;
  redirectUri?: string;
  /** Default guild (server) ID for channel operations */
  guildId?: string;
}
