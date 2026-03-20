import type {
  MonitoringCapability,
  MonitoringTagKey,
  MonitoringTagValue,
} from "@apollo-deploy/integrations";
import { assertOk, mapSentryError } from "../mappers/errors.js";
import { toDate } from "../mappers/models.js";
import type { SentryContext } from "./_context.js";

export function createSentryTags(
  ctx: SentryContext,
): Pick<MonitoringCapability, "listTagKeys" | "listTagValues"> {
  return {
    async listTagKeys(tokens, orgSlug, projectSlug) {
      try {
        const resp = await ctx.get(
          tokens,
          `/projects/${orgSlug}/${projectSlug}/tags/`,
        );
        await assertOk(resp, "listTagKeys");
        const data = (await resp.json()) as Record<string, unknown>[];
        return data.map(
          (raw): MonitoringTagKey => ({
            key: String(raw.key),
            name: String(raw.name),
            uniqueValues: Number(raw.uniqueValues ?? 0),
            canDelete: Boolean(raw.canDelete),
            isBuiltin: Boolean(raw.isBuiltin),
          }),
        );
      } catch (err) {
        throw mapSentryError(err);
      }
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async listTagValues(tokens, orgSlug, projectSlug, tagKey) {
      try {
        const resp = await ctx.get(
          tokens,
          `/projects/${orgSlug}/${projectSlug}/tags/${tagKey}/values/`,
        );
        await assertOk(resp, "listTagValues");
        return await ctx.paginate(
          resp,
          (raw): MonitoringTagValue => ({
            value: String(raw.value),
            count: Number(raw.count),
            lastSeen: toDate(raw.lastSeen as string),
            firstSeen: toDate(raw.firstSeen as string),
          }),
        );
      } catch (err) {
        throw mapSentryError(err);
      }
    },
  };
}
