import type {
  MessagingCapability,
  TokenSet,
  MessagePayload,
  MessageBlock,
} from "@apollo-deploy/integrations";
import { CapabilityError } from "@apollo-deploy/integrations";
import type { SlackAdapterConfig } from "../types.js";

const SLACK_API = "https://slack.com/api";

/** Slack error codes that indicate a transient/retryable failure. */
const RETRYABLE_ERRORS = new Set([
  "rate_limited",
  "ratelimited",
  "internal_error",
  "fatal_error",
  "request_timeout",
  "service_unavailable",
]);

/** Slack error codes that indicate an auth problem (never retry). */
const _AUTH_ERRORS = new Set([
  "invalid_auth",
  "not_authed",
  "token_expired",
  "token_revoked",
  "account_inactive",
  "missing_scope",
  "no_permission",
]);

interface SlackErrorResponse {
  ok: false;
  error: string;
  response_metadata?: { messages?: string[] };
}

async function slackFetch<T extends { ok: boolean; error?: string }>(
  endpoint: string,
  token: string,
  body: Record<string, unknown>,
): Promise<T> {
  const r = await fetch(`${SLACK_API}/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });

  // HTTP-level failure (network / proxy / 5xx before Slack responds)
  if (!r.ok) {
    const retryable = r.status >= 500 || r.status === 429;
    throw new CapabilityError(
      "slack",
      `HTTP ${String(r.status)} from ${endpoint}`,
      retryable,
    );
  }

  const data = (await r.json()) as T | SlackErrorResponse;
  if (!data.ok) {
    const err = (data as SlackErrorResponse).error;
    const retryable = RETRYABLE_ERRORS.has(err);
    throw new CapabilityError("slack", err, retryable);
  }
  return data;
}

export function createSlackMessaging(
  _config: SlackAdapterConfig,
): MessagingCapability {
  async function wrap<T>(fn: () => Promise<T>, action: string): Promise<T> {
    return fn().catch((err: unknown) => {
      if (err instanceof CapabilityError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new CapabilityError("slack", `${action}: ${msg}`, false);
    });
  }

  return {
    async listChannels(tokens: TokenSet, opts) {
      return wrap(async () => {
        const params = new URLSearchParams({
          exclude_archived: "true",
          limit: String(opts?.limit ?? 200),
        });
        if (opts?.cursor != null) params.set("cursor", opts.cursor);
        const r = await fetch(
          `${SLACK_API}/conversations.list?${params.toString()}`,
          {
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
          },
        );
        if (!r.ok) {
          throw new CapabilityError(
            "slack",
            `HTTP ${String(r.status)} from conversations.list`,
            r.status >= 500 || r.status === 429,
          );
        }
        const data = (await r.json()) as {
          ok: boolean;
          error?: string;
          channels?: { id: string; name: string; is_private: boolean }[];
          response_metadata?: { next_cursor?: string };
        };
        if (!data.ok) {
          throw new CapabilityError(
            "slack",
            data.error ?? "conversations.list failed",
            RETRYABLE_ERRORS.has(data.error ?? ""),
          );
        }
        return {
          items: (data.channels ?? []).map((c) => ({
            id: c.id,
            name: c.name,
            isPrivate: c.is_private,
          })),
          hasMore: Boolean(data.response_metadata?.next_cursor),
          cursor: data.response_metadata?.next_cursor ?? undefined,
        };
      }, "listChannels");
    },

    async sendMessage(
      tokens: TokenSet,
      channelId: string,
      message: MessagePayload,
    ) {
      return wrap(async () => {
        const body: Record<string, unknown> = {
          channel: channelId,
          text: message.text,
        };
        if (message.threadId != null) body.thread_ts = message.threadId;
        const data = await slackFetch<{
          ok: boolean;
          error?: string;
          ts: string;
          channel: string;
        }>("chat.postMessage", tokens.accessToken, body);
        return {
          messageId: data.ts,
          channelId: data.channel,
          timestamp: data.ts,
        };
      }, "sendMessage");
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async updateMessage(
      tokens: TokenSet,
      channelId: string,
      messageId: string,
      message: MessagePayload,
    ) {
      return wrap(async () => {
        await slackFetch("chat.update", tokens.accessToken, {
          channel: channelId,
          ts: messageId,
          text: message.text,
        });
      }, "updateMessage");
    },

    async sendRichMessage(
      tokens: TokenSet,
      channelId: string,
      blocks: MessageBlock[],
    ) {
      // MessageBlock is shaped after Slack Block Kit — pass through directly.
      return wrap(async () => {
        const data = await slackFetch<{
          ok: boolean;
          error?: string;
          ts: string;
          channel: string;
        }>("chat.postMessage", tokens.accessToken, {
          channel: channelId,
          blocks,
          text: "", // fallback for notifications
        });
        return {
          messageId: data.ts,
          channelId: data.channel,
          timestamp: data.ts,
        };
      }, "sendRichMessage");
    },
  };
}
