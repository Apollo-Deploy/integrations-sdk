import type {
  Channel,
  MessageBlock,
  MessagePayload,
  MessageResult,
  Paginated,
  PaginationOpts,
} from '../models.js';
import type { TokenSet } from '../oauth.js';

/**
 * Messaging capability.
 * Present on adapters that declare 'messaging' in their capabilities.
 *
 * All methods receive tokens as a parameter — adapters are stateless.
 */
export interface MessagingCapability {
  listChannels(tokens: TokenSet, opts?: PaginationOpts): Promise<Paginated<Channel>>;
  sendMessage(tokens: TokenSet, channelId: string, message: MessagePayload): Promise<MessageResult>;
  updateMessage(tokens: TokenSet, channelId: string, messageId: string, message: MessagePayload): Promise<void>;
  sendRichMessage(tokens: TokenSet, channelId: string, blocks: MessageBlock[]): Promise<MessageResult>;
}
