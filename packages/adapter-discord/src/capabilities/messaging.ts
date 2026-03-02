import { CapabilityError } from '@apollo-deploy/integrations';
import type { MessagingCapability, TokenSet, PaginationOpts } from '@apollo-deploy/integrations';
import type { DiscordAdapterConfig } from '../types.js';

const BASE = 'https://discord.com/api/v10';

export function createDiscordMessaging(config: DiscordAdapterConfig): MessagingCapability {
  function botFetch(path: string, init?: RequestInit) {
    return fetch(`${BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bot ${config.botToken}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  }

  return {
    async listChannels(_tokens: TokenSet, _opts?: PaginationOpts) {
      const guildId = config.guildId;
      if (!guildId) throw new CapabilityError('discord', 'guildId is required in DiscordAdapterConfig to list channels');
      const resp = await botFetch(`/guilds/${guildId}/channels`);
      if (!resp.ok) throw new CapabilityError('discord', `listChannels failed: ${resp.status}`);
      const items = await resp.json() as Array<Record<string, unknown>>;
      return {
        items: items
          .filter((c) => c['type'] === 0 || c['type'] === 5) // TEXT + ANNOUNCEMENT
          .map((c) => ({
            id: c['id'] as string,
            name: c['name'] as string,
            isPrivate: false,
          })),
        hasMore: false,
      };
    },

    async sendMessage(_tokens: TokenSet, channelId: string, payload) {
      const resp = await botFetch(`/channels/${channelId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: payload.text }),
      });
      if (!resp.ok) {
        const err = await resp.json() as { message?: string; retry_after?: number };
        const retryable = resp.status === 429;
        throw new CapabilityError('discord', err.message ?? 'sendMessage failed', retryable);
      }
      const msg = await resp.json() as Record<string, unknown>;
      return { messageId: msg['id'] as string, channelId, timestamp: msg['timestamp'] as string };
    },

    async updateMessage(_tokens: TokenSet, channelId: string, messageId: string, payload) {
      const resp = await botFetch(`/channels/${channelId}/messages/${messageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ content: payload.text }),
      });
      if (!resp.ok) throw new CapabilityError('discord', `updateMessage failed: ${resp.status}`);
    },

    async sendRichMessage(_tokens: TokenSet, channelId: string, blocks) {
      const embeds = blocks.map((b) => {
        const block = b as Record<string, unknown>;
        return {
          title: block['title'] as string | undefined,
          description: block['text'] as string | undefined,
          color: 0x5865F2, // Discord blurple
        };
      });
      const resp = await botFetch(`/channels/${channelId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ embeds }),
      });
      if (!resp.ok) throw new CapabilityError('discord', `sendRichMessage failed: ${resp.status}`);
      const msg = await resp.json() as Record<string, unknown>;
      return { messageId: msg['id'] as string, channelId, timestamp: msg['timestamp'] as string };
    },
  };
}
