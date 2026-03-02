/**
 * Slack messaging capability.
 * Uses @slack/web-api.
 */

import { WebClient } from '@slack/web-api';
import type { MessagingCapability, TokenSet, MessagePayload, MessageBlock } from '@apollo-deploy/integrations';
import { CapabilityError } from '@apollo-deploy/integrations';
import type { SlackAdapterConfig } from '../types.js';

export function createSlackMessaging(_config: SlackAdapterConfig): MessagingCapability {
  function client(tokens: TokenSet) {
    return new WebClient(tokens.accessToken);
  }

  function wrap<T>(fn: () => Promise<T>, action: string): Promise<T> {
    return fn().catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      const retryable = msg.includes('rate_limited') || msg.includes('ratelimited');
      throw new CapabilityError('slack', `${action}: ${msg}`, retryable);
    });
  }

  return {
    async listChannels(tokens, opts) {
      return wrap(async () => {
        const slack = client(tokens);
        const resp = await slack.conversations.list({
          exclude_archived: true,
          limit: opts?.limit ?? 200,
          cursor: opts?.cursor,
        });
        const channels = (resp.channels ?? []).map((c) => ({
          id: c.id ?? '',
          name: c.name ?? '',
          isPrivate: Boolean(c.is_private),
        }));
        return {
          items: channels,
          hasMore: Boolean(resp.response_metadata?.next_cursor),
          cursor: resp.response_metadata?.next_cursor || undefined,
        };
      }, 'listChannels');
    },

    async sendMessage(tokens, channelId, message: MessagePayload) {
      return wrap(async () => {
        const slack = client(tokens);
        const resp = await slack.chat.postMessage({
          channel: channelId,
          text: message.text,
          thread_ts: message.threadId,
        });
        return {
          messageId: resp.ts ?? '',
          channelId: resp.channel ?? channelId,
          timestamp: resp.ts ?? '',
        };
      }, 'sendMessage');
    },

    async updateMessage(tokens, channelId, messageId, message: MessagePayload) {
      return wrap(async () => {
        const slack = client(tokens);
        await slack.chat.update({
          channel: channelId,
          ts: messageId,
          text: message.text,
        });
      }, 'updateMessage');
    },

    async sendRichMessage(tokens, channelId, blocks: MessageBlock[]) {
      return wrap(async () => {
        const slack = client(tokens);
        const resp = await slack.chat.postMessage({
          channel: channelId,
          blocks: blocks as any,
          text: '', // Fallback for notifications
        });
        return {
          messageId: resp.ts ?? '',
          channelId: resp.channel ?? channelId,
          timestamp: resp.ts ?? '',
        };
      }, 'sendRichMessage');
    },
  };
}
