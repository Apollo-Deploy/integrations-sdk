import type {
  AppStoreCapability,
  TokenSet,
  Paginated,
  PaginationOpts,
  BetaGroup,
  BetaTester,
  BetaTesterInput,
  CreateBetaGroupInput,
} from '@apollo-deploy/integrations';
import { CapabilityError } from '@apollo-deploy/integrations';
import { mapGoogleBetaGroup, mapGoogleBetaTester } from '../mappers/models.js';
import type { GooglePlayContext } from './_context.js';
import { BASE_URL } from './_context.js';

export function createGooglePlayBeta(
  ctx: GooglePlayContext,
): Pick<
  AppStoreCapability,
  | 'listBetaGroups' | 'getBetaGroup' | 'createBetaGroup' | 'deleteBetaGroup'
  | 'listBetaTesters' | 'addBetaTesters' | 'removeBetaTesters'
  | 'assignBuildToBetaGroup' | 'removeBuildFromBetaGroup'
> {
  // We need a reference to releaseToTrack — it's passed in via the composed capability.
  // Instead of circular deps, assignBuildToBetaGroup reimplements a minimal version.
  const capability: ReturnType<typeof createGooglePlayBeta> = {
    async listBetaGroups(
      _tokens: TokenSet,
      packageName: string,
    ): Promise<BetaGroup[]> {
      return ['internal', 'alpha', 'beta'].map((t) => mapGoogleBetaGroup(packageName, t));
    },

    async getBetaGroup(
      tokens: TokenSet,
      packageName: string,
      groupId: string,
    ): Promise<BetaGroup> {
      const groups = await capability.listBetaGroups(tokens, packageName);
      const match = groups.find((g) => g.id === groupId);
      if (!match) {
        throw new CapabilityError('google-play', `Beta group ${groupId} not found`, false);
      }
      return match;
    },

    async createBetaGroup(
      _tokens: TokenSet,
      _packageName: string,
      _input: CreateBetaGroupInput,
    ): Promise<BetaGroup> {
      throw new CapabilityError('google-play', 'Google Play uses fixed tracks and does not support creating custom beta groups.', false);
    },

    async deleteBetaGroup(
      _tokens: TokenSet,
      _packageName: string,
      _groupId: string,
    ): Promise<void> {
      throw new CapabilityError('google-play', 'Google Play uses fixed tracks and does not support deleting beta groups.', false);
    },

    async listBetaTesters(
      tokens: TokenSet,
      packageName: string,
      groupId: string,
      _opts?: PaginationOpts,
    ): Promise<Paginated<BetaTester>> {
      const trackName = groupId.includes(':') ? (groupId.split(':')[1] ?? groupId) : groupId;
      const data = await ctx.withEdit(tokens, packageName, async (editId) =>
        ctx.gpRequest<any>(
          tokens,
          `${BASE_URL}/applications/${packageName}/edits/${editId}/testers/${encodeURIComponent(trackName)}`,
        ).catch(() => ({ googleGroups: [] })),
      );
      const groups: string[] = data?.googleGroups ?? [];
      return { items: groups.map(mapGoogleBetaTester), hasMore: false };
    },

    async addBetaTesters(
      tokens: TokenSet,
      groupId: string,
      testers: BetaTesterInput[],
    ): Promise<void> {
      const parts = groupId.includes(':') ? groupId.split(':') : ['', groupId];
      const packageName = parts[0] ?? '';
      const trackName = parts[1] ?? groupId;

      await ctx.withEdit(tokens, packageName, async (editId) => {
        const testersUrl = `${BASE_URL}/applications/${packageName}/edits/${editId}/testers/${encodeURIComponent(trackName)}`;
        const current = await ctx.gpRequest<any>(tokens, testersUrl).catch(() => ({ googleGroups: [] }));
        const existing: string[] = current?.googleGroups ?? [];
        const merged = [...new Set([...existing, ...testers.map((t) => t.email)])];
        await ctx.gpRequest(tokens, testersUrl, {
          method: 'PUT',
          body: JSON.stringify({ googleGroups: merged }),
        });
      }, { commit: true });
    },

    async removeBetaTesters(
      tokens: TokenSet,
      groupId: string,
      testerIds: string[],
    ): Promise<void> {
      const parts = groupId.includes(':') ? groupId.split(':') : ['', groupId];
      const packageName = parts[0] ?? '';
      const trackName = parts[1] ?? groupId;

      await ctx.withEdit(tokens, packageName, async (editId) => {
        const testersUrl = `${BASE_URL}/applications/${packageName}/edits/${editId}/testers/${encodeURIComponent(trackName)}`;
        const current = await ctx.gpRequest<any>(tokens, testersUrl).catch(() => ({ googleGroups: [] }));
        const existing: string[] = current?.googleGroups ?? [];
        const filtered = existing.filter((e) => !testerIds.includes(e));
        await ctx.gpRequest(tokens, testersUrl, {
          method: 'PUT',
          body: JSON.stringify({ googleGroups: filtered }),
        });
      }, { commit: true });
    },

    async assignBuildToBetaGroup(
      tokens: TokenSet,
      packageName: string,
      groupId: string,
      buildId: string,
    ): Promise<void> {
      const trackName = groupId.includes(':') ? (groupId.split(':')[1] ?? groupId) : groupId;

      // Minimal releaseToTrack implementation to avoid circular deps
      await ctx.withEdit(tokens, packageName, async (editId) => {
        const release: Record<string, any> = {
          name: buildId,
          status: 'completed',
          versionCodes: [buildId],
        };

        await ctx.gpRequest(
          tokens,
          `${BASE_URL}/applications/${packageName}/edits/${editId}/tracks/${trackName}`,
          {
            method: 'PUT',
            body: JSON.stringify({ track: trackName, releases: [release] }),
          },
        );
      }, { commit: true });
    },

    async removeBuildFromBetaGroup(
      _tokens: TokenSet,
      _packageName: string,
      _groupId: string,
      _buildId: string,
    ): Promise<void> {
      throw new CapabilityError('google-play', 'Removing a specific build from a Google Play track is not directly supported. Use releaseToTrack with a different version.', false);
    },
  };

  return capability;
}
