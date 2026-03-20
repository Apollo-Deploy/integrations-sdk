import { CapabilityError } from "@apollo-deploy/integrations";
import type {
  MessagingCapability,
  TokenSet,
  MessageBlock,
  MessagePayload,
  PaginationOpts,
} from "@apollo-deploy/integrations";
import type { DiscordAdapterConfig } from "../types.js";

const DISCORD_API = "https://discord.com/api/v10";

/** Discord JSON error response shape (status >= 400). */
interface DiscordErrorResponse {
  message: string;
  code: number;
  retry_after?: number; // seconds (present on 429)
  global?: boolean;
}

export function createDiscordMessaging(
  config: DiscordAdapterConfig,
): MessagingCapability {
  async function botFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const r = await fetch(`${DISCORD_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bot ${config.botToken}`,
        "Content-Type": "application/json",
        ...((init?.headers as Record<string, string> | undefined) ?? {}),
      },
    });

    if (r.status === 204) return undefined as T;

    if (!r.ok) {
      let msg = `HTTP ${String(r.status)}`;
      const retryable = r.status === 429 || r.status >= 500;

      try {
        const err = (await r.json()) as DiscordErrorResponse;
        if (err.message !== "") msg = err.message;
      } catch {
        // body may not be JSON (e.g. 502 from proxy)
      }

      throw new CapabilityError("discord", msg, retryable);
    }

    return (await r.json()) as T;
  }

  async function wrap<T>(fn: () => Promise<T>, action: string): Promise<T> {
    return fn().catch((err: unknown) => {
      if (err instanceof CapabilityError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new CapabilityError("discord", `${action}: ${msg}`, false);
    });
  }

  /**
   * Converts generic MessageBlock[] to Discord embeds for notifications.
   * Each 'section' block becomes a field; 'context' blocks become the footer.
   */
  function blocksToEmbeds(blocks: MessageBlock[]): Record<string, unknown>[] {
    const fields: { name: string; value: string; inline: boolean }[] = [];
    let footer: string | undefined;

    for (const block of blocks) {
      if (block.type === "section") {
        const tf = block.text as { text?: string } | string | undefined;
        const text = typeof tf === "string" ? tf : (tf?.text ?? "");
        if (text === "") continue;
        // Split first line as field name, rest as value
        const newline = text.indexOf("\n");
        const name =
          newline > -1
            ? text.slice(0, newline).replace(/[*_~`]/g, "")
            : text.replace(/[*_~`]/g, "");
        const value = newline > -1 ? text.slice(newline + 1) : "\u200b";
        fields.push({ name, value, inline: false });
      } else if (block.type === "context") {
        const els = (block.elements as { text?: string }[] | undefined) ?? [];
        footer = els.map((el) => el.text ?? "").join(" ");
      }
      // 'divider' and 'actions' are skipped — not meaningful in notification embeds
    }

    return [
      {
        color: 0x5865f2,
        fields,
        ...(footer != null ? { footer: { text: footer } } : {}),
      },
    ];
  }

  return {
    async listChannels(_tokens: TokenSet, _opts?: PaginationOpts) {
      const guildId = config.guildId;
      if (guildId == null || guildId === "")
        throw new CapabilityError(
          "discord",
          "guildId is required in DiscordAdapterConfig to list channels",
        );
      return wrap(async () => {
        const items = await botFetch<
          { id: string; name: string; type: number }[]
        >(`/guilds/${guildId}/channels`);
        return {
          items: items
            .filter((c) => c.type === 0 || c.type === 5) // TEXT + ANNOUNCEMENT
            .map((c) => ({ id: c.id, name: c.name, isPrivate: false })),
          hasMore: false,
        };
      }, "listChannels");
    },

    async sendMessage(
      _tokens: TokenSet,
      channelId: string,
      payload: MessagePayload,
    ) {
      return wrap(async () => {
        const body: Record<string, unknown> = { content: payload.text };
        if (payload.threadId != null)
          body.message_reference = { message_id: payload.threadId };
        const msg = await botFetch<{
          id: string;
          timestamp: string;
          channel_id: string;
        }>(`/channels/${channelId}/messages`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        return {
          messageId: msg.id,
          channelId: msg.channel_id,
          timestamp: msg.timestamp,
        };
      }, "sendMessage");
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async updateMessage(
      _tokens: TokenSet,
      channelId: string,
      messageId: string,
      payload: MessagePayload,
    ) {
      return wrap(async () => {
        await botFetch(`/channels/${channelId}/messages/${messageId}`, {
          method: "PATCH",
          body: JSON.stringify({ content: payload.text }),
        });
      }, "updateMessage");
    },

    async sendRichMessage(
      _tokens: TokenSet,
      channelId: string,
      blocks: MessageBlock[],
    ) {
      return wrap(async () => {
        const msg = await botFetch<{
          id: string;
          timestamp: string;
          channel_id: string;
        }>(`/channels/${channelId}/messages`, {
          method: "POST",
          body: JSON.stringify({ embeds: blocksToEmbeds(blocks) }),
        });
        return {
          messageId: msg.id,
          channelId: msg.channel_id,
          timestamp: msg.timestamp,
        };
      }, "sendRichMessage");
    },
  };
}
