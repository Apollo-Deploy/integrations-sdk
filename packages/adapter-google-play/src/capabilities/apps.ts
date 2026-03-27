import type {
  AppStoreCapability,
  TokenSet,
  Paginated,
  StoreApp,
} from "@apollo-deploy/integrations";
import { CapabilityError } from "@apollo-deploy/integrations";
import { mapGoogleApp } from "../mappers/models.js";
import type { GooglePlayContext } from "./_context.js";

export function createGooglePlayApps(
  ctx: GooglePlayContext,
): Pick<AppStoreCapability, "listApps" | "getApp"> {
  return {
    async listApps(_tokens: TokenSet): Promise<Paginated<StoreApp>> {
      throw new CapabilityError(
        "google-play",
        "Google Play API does not support listing all apps. Store managed package names in connection metadata.",
        false,
      );
    },

    async getApp(tokens: TokenSet, packageName: string): Promise<StoreApp> {
      return ctx.withEdit(packageName, () =>
        Promise.resolve(mapGoogleApp(packageName, {})),
      );
    },
  };
}
