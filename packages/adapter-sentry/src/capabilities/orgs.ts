import type { MonitoringCapability } from "@apollo-deploy/integrations";
import { assertOk } from "../mappers/errors.js";
import { mapSentryError } from "../mappers/errors.js";
import { mapOrg, mapProject } from "../mappers/models.js";
import type { SentryContext } from "./_context.js";

export function createSentryOrgs(
  ctx: SentryContext,
): Pick<
  MonitoringCapability,
  "listOrganizations" | "getOrganization" | "listProjects" | "getProject"
> {
  return {
    async listOrganizations(tokens) {
      try {
        const resp = await ctx.get(tokens, "/organizations/");
        await assertOk(resp, "listOrganizations");
        return await ctx.paginate(resp, mapOrg);
      } catch (err) {
        throw mapSentryError(err);
      }
    },

    async getOrganization(tokens, orgSlug) {
      try {
        const resp = await ctx.get(tokens, `/organizations/${orgSlug}/`);
        await assertOk(resp, "getOrganization");
        return mapOrg((await resp.json()) as Record<string, unknown>);
      } catch (err) {
        throw mapSentryError(err);
      }
    },

    async listProjects(tokens, orgSlug) {
      try {
        const resp = await ctx.get(
          tokens,
          `/organizations/${orgSlug}/projects/`,
        );
        await assertOk(resp, "listProjects");
        return await ctx.paginate(resp, mapProject);
      } catch (err) {
        throw mapSentryError(err);
      }
    },

    async getProject(tokens, orgSlug, projectSlug) {
      try {
        const resp = await ctx.get(
          tokens,
          `/projects/${orgSlug}/${projectSlug}/`,
        );
        await assertOk(resp, "getProject");
        return mapProject((await resp.json()) as Record<string, unknown>);
      } catch (err) {
        throw mapSentryError(err);
      }
    },
  };
}
