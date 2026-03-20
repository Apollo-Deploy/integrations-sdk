import type { SentryMonitoringCapability } from "../types.js";
import type { SentryAdapterConfig } from "../types.js";
import { createSentryContext } from "./_context.js";
import { createSentryOrgs } from "./orgs.js";
import { createSentryIssues } from "./issues.js";
import { createSentryEvents } from "./events.js";
import { createSentryReleases } from "./releases.js";
import { createSentryVitals } from "./vitals.js";
import { createSentryMetrics } from "./metrics.js";
import { createSentryLogs } from "./logs.js";
import { createSentryReplays } from "./replays.js";
import { createSentryAlerts } from "./alerts.js";
import { createSentryCrons } from "./crons.js";
import { createSentryTeams } from "./teams.js";
import { createSentryTags } from "./tags.js";
import { createSentryFeedback } from "./feedback.js";
import { createSentryExtras } from "./sentry-extras.js";

export function createSentryMonitoring(
  config: SentryAdapterConfig,
): SentryMonitoringCapability {
  const ctx = createSentryContext(config);

  return {
    ...createSentryOrgs(ctx),
    ...createSentryIssues(ctx),
    ...createSentryEvents(ctx),
    ...createSentryReleases(ctx),
    ...createSentryVitals(ctx),
    ...createSentryMetrics(ctx),
    ...createSentryLogs(ctx),
    ...createSentryReplays(ctx),
    ...createSentryAlerts(ctx),
    ...createSentryCrons(ctx),
    ...createSentryTeams(ctx),
    ...createSentryTags(ctx),
    ...createSentryFeedback(ctx),
    ...createSentryExtras(ctx),
  };
}
