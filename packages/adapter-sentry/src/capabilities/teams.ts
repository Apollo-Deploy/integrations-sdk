import type {
  MonitoringCapability,
  MonitoringTeam,
  MonitoringMember,
} from "@apollo-deploy/integrations";
import { assertOk, mapSentryError } from "../mappers/errors.js";
import { toDate } from "../mappers/models.js";
import type { SentryContext } from "./_context.js";

export function createSentryTeams(
  ctx: SentryContext,
): Pick<MonitoringCapability, "listTeams" | "listMembers"> {
  return {
    async listTeams(tokens, orgSlug) {
      try {
        const resp = await ctx.get(tokens, `/organizations/${orgSlug}/teams/`);
        await assertOk(resp, "listTeams");
        return await ctx.paginate(
          resp,
          (raw): MonitoringTeam => ({
            id: String(raw.id),
            slug: String(raw.slug),
            name: String(raw.name),
            memberCount: Number(raw.memberCount ?? 0),
            dateCreated: toDate(raw.dateCreated as string),
            isMember: Boolean(raw.isMember),
          }),
        );
      } catch (err) {
        throw mapSentryError(err);
      }
    },

    async listMembers(tokens, orgSlug) {
      try {
        const resp = await ctx.get(
          tokens,
          `/organizations/${orgSlug}/members/`,
        );
        await assertOk(resp, "listMembers");
        return await ctx.paginate(
          resp,
          (raw): MonitoringMember => ({
            id: String(raw.id),
            email: String(raw.email),
            name:
              (raw.name as string | undefined) ??
              (raw.email as string | undefined) ??
              "",
            role:
              (raw.orgRole as MonitoringMember["role"] | undefined) ?? "member",
            dateCreated: toDate(raw.dateCreated as string),
            expired: Boolean(raw.expired),
            pending: Boolean(raw.pending),
          }),
        );
      } catch (err) {
        throw mapSentryError(err);
      }
    },
  };
}
