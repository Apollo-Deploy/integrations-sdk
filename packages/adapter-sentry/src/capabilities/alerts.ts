import type {
  MonitoringCapability,
  MonitoringAlertIncident,
  AlertRuleListOpts,
} from "@apollo-deploy/integrations";
import { assertOk, mapSentryError } from "../mappers/errors.js";
import { mapAlertRule, mapIncidentStatus } from "../mappers/models.js";
import type { SentryContext } from "./_context.js";

export function createSentryAlerts(
  ctx: SentryContext,
): Pick<
  MonitoringCapability,
  "listAlertRules" | "getAlertRule" | "listAlertIncidents" | "getAlertIncident"
> {
  return {
    // @deprecated Sentry has deprecated /alert-rules/ — use /detectors/ (monitors) and /workflows/ (alerts) instead.
    // The new endpoints are currently in beta: GET /organizations/{org}/detectors/ and GET /organizations/{org}/workflows/.
    async listAlertRules(tokens, orgSlug, opts: AlertRuleListOpts = {}) {
      try {
        const resp = await ctx.get(
          tokens,
          `/organizations/${orgSlug}/alert-rules/`,
          {
            project: opts.project,
            environment: opts.environment,
            per_page: opts.limit ?? 25,
            cursor: opts.cursor,
          },
        );
        await assertOk(resp, "listAlertRules");
        return await ctx.paginate(resp, mapAlertRule);
      } catch (err) {
        throw mapSentryError(err);
      }
    },

    // @deprecated Sentry has deprecated /alert-rules/{id}/ — use /detectors/{id}/ (beta) instead.
    async getAlertRule(tokens, orgSlug, ruleId) {
      try {
        const resp = await ctx.get(
          tokens,
          `/organizations/${orgSlug}/alert-rules/${ruleId}/`,
        );
        await assertOk(resp, "getAlertRule");
        return mapAlertRule((await resp.json()) as Record<string, unknown>);
      } catch (err) {
        throw mapSentryError(err);
      }
    },

    // @deprecated The /incidents/ endpoint is no longer documented in the Sentry API reference.
    async listAlertIncidents(tokens, orgSlug, opts = {}) {
      try {
        const resp = await ctx.get(
          tokens,
          `/organizations/${orgSlug}/incidents/`,
          {
            project: opts.project,
            status: opts.status,
          },
        );
        await assertOk(resp, "listAlertIncidents");
        return await ctx.paginate(
          resp,
          (raw): MonitoringAlertIncident => ({
            id: String(raw.id),
            identifier: String(raw.identifier),
            status: mapIncidentStatus(Number(raw.status)),
            type: "metric" as const,
            title: (raw.title as string | undefined) ?? "",
            dateStarted: ctx.toDate(raw.dateStarted as string),
            dateClosed:
              raw.dateClosed != null
                ? ctx.toDate(raw.dateClosed as string)
                : undefined,
            alertRule: {
              id:
                ((raw.alertRule as Record<string, unknown> | undefined)?.id as
                  | string
                  | undefined) ?? "",
              name:
                ((raw.alertRule as Record<string, unknown> | undefined)
                  ?.name as string | undefined) ?? "",
              type: "metric" as const,
            },
            projects: (raw.projects as string[] | undefined) ?? [],
          }),
        );
      } catch (err) {
        throw mapSentryError(err);
      }
    },

    // @deprecated The /incidents/{id}/ endpoint is no longer documented in the Sentry API reference.
    async getAlertIncident(tokens, orgSlug, incidentId) {
      try {
        const resp = await ctx.get(
          tokens,
          `/organizations/${orgSlug}/incidents/${incidentId}/`,
        );
        await assertOk(resp, "getAlertIncident");
        const raw = (await resp.json()) as Record<string, unknown>;
        return {
          id: String(raw.id),
          identifier: String(raw.identifier),
          status: mapIncidentStatus(Number(raw.status)),
          type: "metric" as const,
          title: (raw.title as string | undefined) ?? "",
          dateStarted: ctx.toDate(raw.dateStarted as string),
          dateClosed:
            raw.dateClosed != null
              ? ctx.toDate(raw.dateClosed as string)
              : undefined,
          alertRule: {
            id:
              ((raw.alertRule as Record<string, unknown> | undefined)?.id as
                | string
                | undefined) ?? "",
            name:
              ((raw.alertRule as Record<string, unknown> | undefined)?.name as
                | string
                | undefined) ?? "",
            type: "metric" as const,
          },
          projects: (raw.projects as string[] | undefined) ?? [],
        };
      } catch (err) {
        throw mapSentryError(err);
      }
    },
  };
}
