/**
 * Slack event mapper.
 */
import { randomUUID } from 'node:crypto';
import type { IntegrationEvent } from '@apollo-deploy/integrations';

const SLACK_EVENT_MAP: Record<string, string> = {
  'message': 'message.sent',
  'app_mention': 'message.mention',
  'reaction_added': 'reaction.added',
  'reaction_removed': 'reaction.removed',
  'channel_created': 'channel.created',
  'channel_deleted': 'channel.deleted',
  'member_joined_channel': 'channel.member_joined',
  'member_left_channel': 'channel.member_left',
  'app_home_opened': 'app_home.opened',
  'workflow_step_execute': 'workflow.step_execute',
};

export function mapSlackEvent(
  rawType: string,
  body: unknown,
  connectionId = '',
  projectId?: string,
): IntegrationEvent {
  const b = body as Record<string, unknown>;
  const event = b['event'] as Record<string, unknown> | undefined;
  const normalized = SLACK_EVENT_MAP[rawType] ?? `slack.${rawType}`;

  return {
    id: randomUUID(),
    provider: 'slack',
    providerEventType: rawType,
    domain: 'messaging',
    eventType: normalized,
    timestamp: new Date(),
    correlationId: randomUUID(),
    connectionId,
    projectId,
    actor: event?.['user']
      ? { id: String(event['user']), name: String(event['user']) }
      : undefined,
    data: b,
  };
}
