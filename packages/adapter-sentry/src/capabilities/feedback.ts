import type {
  MonitoringCapability,
  MonitoringUserFeedback,
  CreateUserFeedbackInput,
} from "@apollo-deploy/integrations";
import { assertOk, mapSentryError } from "../mappers/errors.js";
import { toDate } from "../mappers/models.js";
import type { SentryContext } from "./_context.js";

export function createSentryFeedback(
  ctx: SentryContext,
): Pick<MonitoringCapability, "listUserFeedback" | "createUserFeedback"> {
  return {
    async listUserFeedback(tokens, orgSlug, projectSlug) {
      try {
        const resp = await ctx.get(
          tokens,
          `/projects/${orgSlug}/${projectSlug}/user-feedback/`,
        );
        await assertOk(resp, "listUserFeedback");
        return await ctx.paginate(
          resp,
          (raw): MonitoringUserFeedback => ({
            id: String(raw.id),
            eventId: String(raw.eventID ?? raw.id),
            name: String(raw.name),
            email: String(raw.email),
            comments: String(raw.comments),
            timestamp: toDate(raw.dateCreated as string),
            issue:
              raw.issue != null
                ? {
                    id: String((raw.issue as Record<string, unknown>).id),
                    title: String((raw.issue as Record<string, unknown>).title),
                  }
                : undefined,
          }),
        );
      } catch (err) {
        throw mapSentryError(err);
      }
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async createUserFeedback(
      tokens,
      orgSlug,
      projectSlug,
      input: CreateUserFeedbackInput,
    ) {
      try {
        const resp = await ctx.post(
          tokens,
          `/projects/${orgSlug}/${projectSlug}/user-feedback/`,
          {
            event_id: input.eventId,
            name: input.name,
            email: input.email,
            comments: input.comments,
          },
        );
        await assertOk(resp, "createUserFeedback");
        const raw = (await resp.json()) as Record<string, unknown>;
        return {
          id: String(raw.id),
          eventId: String(raw.eventID ?? raw.id),
          name: String(raw.name),
          email: String(raw.email),
          comments: String(raw.comments),
          timestamp: toDate(raw.dateCreated as string),
        };
      } catch (err) {
        throw mapSentryError(err);
      }
    },
  };
}
