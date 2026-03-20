import type { MonitoringCapability } from "@apollo-deploy/integrations";
import { assertOk, mapSentryError } from "../mappers/errors.js";
import { mapEvent } from "../mappers/models.js";
import type { SentryContext } from "./_context.js";

export function createSentryEvents(
  ctx: SentryContext,
): Pick<
  MonitoringCapability,
  "listIssueEvents" | "getLatestIssueEvent" | "getEvent" | "listProjectEvents"
> {
  return {
    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async listIssueEvents(tokens, orgSlug, issueId, opts = {}) {
      try {
        const resp = await ctx.get(
          tokens,
          `/organizations/${orgSlug}/issues/${issueId}/events/`,
          {
            environment: opts.environment,
            query: opts.query,
            limit: opts.limit ?? 50,
            cursor: opts.cursor,
            full: opts.full === true ? "true" : undefined,
          },
        );
        await assertOk(resp, "listIssueEvents");
        return await ctx.paginate(resp, mapEvent);
      } catch (err) {
        throw mapSentryError(err);
      }
    },

    async getLatestIssueEvent(tokens, orgSlug, issueId) {
      try {
        const resp = await ctx.get(
          tokens,
          `/organizations/${orgSlug}/issues/${issueId}/events/latest/`,
        );
        await assertOk(resp, "getLatestIssueEvent");
        return mapEvent((await resp.json()) as Record<string, unknown>);
      } catch (err) {
        throw mapSentryError(err);
      }
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async getEvent(tokens, orgSlug, projectSlug, eventId) {
      try {
        const resp = await ctx.get(
          tokens,
          `/projects/${orgSlug}/${projectSlug}/events/${eventId}/`,
        );
        await assertOk(resp, "getEvent");
        return mapEvent((await resp.json()) as Record<string, unknown>);
      } catch (err) {
        throw mapSentryError(err);
      }
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async listProjectEvents(tokens, orgSlug, projectSlug, opts = {}) {
      try {
        const resp = await ctx.get(
          tokens,
          `/projects/${orgSlug}/${projectSlug}/events/`,
          {
            environment: opts.environment,
            query: opts.query,
            limit: opts.limit ?? 50,
            cursor: opts.cursor,
            full: opts.full === true ? "true" : undefined,
          },
        );
        await assertOk(resp, "listProjectEvents");
        return await ctx.paginate(resp, mapEvent);
      } catch (err) {
        throw mapSentryError(err);
      }
    },
  };
}
