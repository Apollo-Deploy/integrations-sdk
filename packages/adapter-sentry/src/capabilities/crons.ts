import type {
  MonitoringCapability,
  MonitoringCron,
} from "@apollo-deploy/integrations";
import { assertOk, mapSentryError } from "../mappers/errors.js";
import { toDate } from "../mappers/models.js";
import type { SentryContext } from "./_context.js";

function mapCron(raw: Record<string, unknown>): MonitoringCron {
  return {
    id: String(raw.id),
    slug: String(raw.slug),
    name: String(raw.name),
    status: (raw.status as MonitoringCron["status"] | undefined) ?? "ok",
    isMuted: Boolean(raw.isMuted),
    type: "cron_job",
    config: raw.config as MonitoringCron["config"],
    environments:
      (raw.environments as MonitoringCron["environments"] | undefined) ?? [],
    dateCreated: toDate(raw.dateCreated as string),
  };
}

export function createSentryCrons(
  ctx: SentryContext,
): Pick<MonitoringCapability, "listCrons" | "getCron"> {
  return {
    async listCrons(tokens, orgSlug, projectSlug) {
      try {
        const resp = await ctx.get(
          tokens,
          `/organizations/${orgSlug}/monitors/`,
          {
            project: projectSlug,
          },
        );
        await assertOk(resp, "listCrons");
        return await ctx.paginate(resp, mapCron);
      } catch (err) {
        throw mapSentryError(err);
      }
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async getCron(tokens, orgSlug, _projectSlug, cronSlug) {
      try {
        const resp = await ctx.get(
          tokens,
          `/organizations/${orgSlug}/monitors/${cronSlug}/`,
        );
        await assertOk(resp, "getCron");
        return mapCron((await resp.json()) as Record<string, unknown>);
      } catch (err) {
        throw mapSentryError(err);
      }
    },
  };
}
