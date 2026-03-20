import type { MonitoringCapability } from "@apollo-deploy/integrations";
import type {
  MonitoringUpdateIssueInput,
  BulkUpdateIssuesInput,
} from "@apollo-deploy/integrations";
import { assertOk, mapSentryError } from "../mappers/errors.js";
import { mapIssue } from "../mappers/models.js";
import type { SentryContext } from "./_context.js";

export function createSentryIssues(
  ctx: SentryContext,
): Pick<
  MonitoringCapability,
  | "listIssues"
  | "getIssue"
  | "updateIssue"
  | "deleteIssue"
  | "bulkUpdateIssues"
  | "bulkDeleteIssues"
> {
  return {
    async listIssues(tokens, orgSlug, opts = {}) {
      try {
        const resp = await ctx.get(
          tokens,
          `/organizations/${orgSlug}/issues/`,
          {
            project: opts.projectSlug,
            environment: opts.environment,
            query: opts.query ?? "is:unresolved",
            sort: opts.sort ?? "date",
            limit: opts.limit ?? 25,
            cursor: opts.cursor,
          },
        );
        await assertOk(resp, "listIssues");
        return await ctx.paginate(resp, mapIssue);
      } catch (err) {
        throw mapSentryError(err);
      }
    },

    async getIssue(tokens, orgSlug, issueId) {
      try {
        const resp = await ctx.get(
          tokens,
          `/organizations/${orgSlug}/issues/${issueId}/`,
        );
        await assertOk(resp, "getIssue");
        return mapIssue((await resp.json()) as Record<string, unknown>);
      } catch (err) {
        throw mapSentryError(err);
      }
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async updateIssue(
      tokens,
      orgSlug,
      issueId,
      input: MonitoringUpdateIssueInput,
    ) {
      try {
        const body: Record<string, unknown> = {};
        if (input.status !== undefined) body.status = input.status;
        if (input.assignee !== undefined) body.assignee = input.assignee;
        if (input.priority !== undefined) body.priority = input.priority;
        if (input.isBookmarked !== undefined)
          body.isBookmarked = input.isBookmarked;
        if (input.isSubscribed !== undefined)
          body.isSubscribed = input.isSubscribed;
        if (input.hasSeen !== undefined) body.hasSeen = input.hasSeen;
        const resp = await ctx.put(
          tokens,
          `/organizations/${orgSlug}/issues/${issueId}/`,
          body,
        );
        await assertOk(resp, "updateIssue");
        return mapIssue((await resp.json()) as Record<string, unknown>);
      } catch (err) {
        throw mapSentryError(err);
      }
    },

    async deleteIssue(tokens, orgSlug, issueId) {
      try {
        const resp = await ctx.del(
          tokens,
          `/organizations/${orgSlug}/issues/${issueId}/`,
        );
        await assertOk(resp, "deleteIssue");
      } catch (err) {
        throw mapSentryError(err);
      }
    },

    async bulkUpdateIssues(tokens, orgSlug, input: BulkUpdateIssuesInput) {
      try {
        const body: Record<string, unknown> = {};
        if (input.status !== undefined) body.status = input.status;
        if (input.assignee !== undefined) body.assignee = input.assignee;
        if (input.priority !== undefined) body.priority = input.priority;
        if (input.isBookmarked !== undefined)
          body.isBookmarked = input.isBookmarked;
        if (input.query !== undefined && input.query !== "")
          body.query = input.query;
        const token =
          tokens.accessToken !== "" ? tokens.accessToken : ctx.config.authToken;
        const base =
          (ctx.config.baseUrl?.replace(/\/$/, "") ?? "https://sentry.io") +
          "/api/0";
        const url = new URL(`${base}/organizations/${orgSlug}/issues/`);
        for (const id of input.ids ?? []) url.searchParams.append("id", id);
        const resp = await fetch(url.toString(), {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        await assertOk(resp, "bulkUpdateIssues");
      } catch (err) {
        throw mapSentryError(err);
      }
    },

    async bulkDeleteIssues(tokens, orgSlug, issueIds) {
      try {
        const token =
          tokens.accessToken !== "" ? tokens.accessToken : ctx.config.authToken;
        const base =
          (ctx.config.baseUrl?.replace(/\/$/, "") ?? "https://sentry.io") +
          "/api/0";
        const url = new URL(`${base}/organizations/${orgSlug}/issues/`);
        for (const id of issueIds) url.searchParams.append("id", id);
        const resp = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        await assertOk(resp, "bulkDeleteIssues");
      } catch (err) {
        throw mapSentryError(err);
      }
    },
  };
}
