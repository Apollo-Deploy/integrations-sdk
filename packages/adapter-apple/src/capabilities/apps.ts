import type { AppStoreCapability } from '@apollo-deploy/integrations';
import { mapAppleApp } from '../mappers/models.js';
import type { AppleContext } from './_context.js';

export function createAppleApps(
  ctx: AppleContext,
): Pick<AppStoreCapability, 'listApps' | 'getApp'> {
  return {
    async listApps(tokens) {
      const data = await ctx.appleRequest(tokens, '/apps?limit=200');
      return {
        items: data.data.map(mapAppleApp),
        hasMore: !!data.links?.next,
        cursor: ctx.extractCursor(data.links?.next),
      };
    },

    async getApp(tokens, appId) {
      const data = await ctx.appleRequest(tokens, `/apps/${appId}`);
      return mapAppleApp(data.data);
    },
  };
}
