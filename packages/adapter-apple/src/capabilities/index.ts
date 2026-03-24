import type { AppStoreCapability } from "@apollo-deploy/integrations";
import type { AppleAdapterConfig } from "../types.js";
import { createAppleContext } from "./_context.js";
import { createAppleApps } from "./apps.js";
import { createAppleBuilds } from "./builds.js";
import { createAppleReleases } from "./releases.js";
import { createAppleReviews } from "./reviews.js";
import { createAppleBeta } from "./beta.js";
import { createAppleVitals } from "./vitals.js";
import { createAppleRecovery } from "./recovery.js";
import { createApplePhasedReleases } from "./phased-releases.js";
import { createAppleGeneratedArtifacts } from "./generated-artifacts.js";
import { createAppleInstalls } from "./installs.js";

export function createAppleAppStore(
  config: AppleAdapterConfig,
): AppStoreCapability {
  const ctx = createAppleContext(config);

  return {
    ...createAppleApps(ctx),
    ...createAppleBuilds(ctx),
    ...createAppleReleases(ctx),
    ...createAppleReviews(ctx),
    ...createAppleBeta(ctx),
    ...createAppleVitals(ctx),
    ...createAppleRecovery(),
    ...createApplePhasedReleases(ctx),
    ...createAppleGeneratedArtifacts(ctx),
    ...createAppleInstalls(ctx),
  };
}
