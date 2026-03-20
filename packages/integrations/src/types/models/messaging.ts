// ─── Messaging ────────────────────────────────────────────────────────────────

export interface Channel {
  id: string;
  name: string;
  isPrivate: boolean;
}

export interface MessagePayload {
  text: string;
  threadId?: string;
}

export interface MessageResult {
  messageId: string;
  channelId: string;
  timestamp: string;
}

export interface MessageBlock {
  type: "section" | "divider" | "actions" | "context";
  [key: string]: unknown;
}
