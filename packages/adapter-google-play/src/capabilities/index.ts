import type { AppStoreCapability } from "@apollo-deploy/integrations";
import type { GooglePlayAdapterConfig } from "../types.js";
import { createGooglePlayContext } from "./_context.js";
import { createGooglePlayApps } from "./apps.js";
import { createGooglePlayBuilds } from "./builds.js";
import { createGooglePlayReleases } from "./releases.js";
import { createGooglePlayReviews } from "./reviews.js";
import { createGooglePlayBeta } from "./beta.js";
import { createGooglePlayVitals } from "./vitals.js";
import { createGooglePlayRecovery } from "./recovery.js";
import { createGooglePlayPhasedReleases } from "./phased-releases.js";
import { createGooglePlayGeneratedArtifacts } from "./generated-artifacts.js";

export function createGooglePlayAppStore(
  config: GooglePlayAdapterConfig,
): AppStoreCapability {
  const ctx = createGooglePlayContext(config);

  return {
    ...createGooglePlayApps(ctx),
    ...createGooglePlayBuilds(ctx),
    ...createGooglePlayReleases(ctx),
    ...createGooglePlayReviews(ctx),
    ...createGooglePlayBeta(ctx),
    ...createGooglePlayVitals(ctx),
    ...createGooglePlayRecovery(ctx),
    ...createGooglePlayPhasedReleases(ctx),
    ...createGooglePlayGeneratedArtifacts(ctx),
  };
}
