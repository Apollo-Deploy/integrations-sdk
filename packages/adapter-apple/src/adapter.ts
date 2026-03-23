import { defineAdapter } from "@apollo-deploy/integrations";
import { createAppleOAuth } from "./oauth.js";
import { createAppleWebhook } from "./webhook.js";
import { createAppleAppStore } from "./capabilities/index.js";
import type { AppleAdapterConfig } from "./types.js";
import type { AdapterAuthConfig } from "@apollo-deploy/integrations";

const auth: AdapterAuthConfig = {
  type: "credential_form",
  fields: [
    {
      key: "issuerId",
      label: "Issuer ID",
      type: "text",
      required: true,
      placeholder: "57246542-96fe-1a63-e053-0824d011072a",
      helpText:
        "Found in App Store Connect → Users and Access → Integrations → Team Keys.",
    },
    {
      key: "keyId",
      label: "Key ID",
      type: "text",
      required: true,
      placeholder: "2X9R4HXF34",
      helpText: "The 10-character identifier for your API key.",
      pattern: "^[A-Z0-9]{10}$",
      minLength: 10,
      maxLength: 10,
    },
    {
      key: "privateKey",
      label: "Private Key (.p8)",
      type: "textarea",
      required: true,
      placeholder: "-----BEGIN PRIVATE KEY-----\n...",
      helpText:
        "Paste the contents of the .p8 key file downloaded from App Store Connect.",
    },
  ],
};

export const createAppleAdapter = defineAdapter<AppleAdapterConfig>({
  id: "apple",
  name: "Apple App Store Connect",
  metadata: {
    description:
      "Manage iOS and macOS app submissions, TestFlight builds, and App Store releases.",
    category: "App Stores",
    dateAdded: "2024-06-01",
    iconUrl: {
      light:
        "https://cdn.apollodeploy.com/integrations/apple_integration_light.svg",
      dark: "https://cdn.apollodeploy.com/integrations/apple_integration_dark.svg",
    },
    websiteUrl: "https://appstoreconnect.apple.com",
    docsUrl: "https://developer.apple.com/documentation/appstoreconnectapi",
    auth,
  },
  capabilities: ["app-store"] as const,

  tokenMetadata: {
    expiresInSeconds: 1200, // 20 minutes max
    refreshable: false, // NOT refreshable — regenerate JWT each time
    rotatesRefreshToken: false,
    requiresRefreshLock: false,
  },

  createOAuthHandler: (config) => createAppleOAuth(config),
  createWebhookHandler: (config) => createAppleWebhook(config),
  createAppStore: (config) => createAppleAppStore(config),
});
