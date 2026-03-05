import type {
  AppStoreCapability,
  TokenSet,
  PhasedRelease,
  PhasedReleaseState,
  CreatePhasedReleaseRequest,
  UpdatePhasedReleaseRequest,
  ReleaseRequest,
} from '@apollo-deploy/integrations';
import { CapabilityError } from '@apollo-deploy/integrations';
import type { AppleContext } from './_context.js';

// Apple's 7-day phased release schedule: day → approx cumulative %
const APPLE_PHASED_DAY_PERCENT: Record<number, number> = {
  0: 0, 1: 1, 2: 2, 3: 5, 4: 10, 5: 20, 6: 50, 7: 100,
};

function mapApplePhasedReleaseState(appleState: string): PhasedReleaseState {
  switch (appleState) {
    case 'INACTIVE': return 'inactive';
    case 'ACTIVE': return 'active';
    case 'PAUSED': return 'paused';
    case 'COMPLETE': return 'complete';
    default: return 'inactive';
  }
}

function mapPhasedReleaseStateToApple(state: PhasedReleaseState): string {
  switch (state) {
    case 'inactive': return 'INACTIVE';
    case 'active': return 'ACTIVE';
    case 'paused': return 'PAUSED';
    case 'complete': return 'COMPLETE';
  }
}

function mapApplePhasedRelease(versionId: string, raw: any): PhasedRelease {
  const attrs = raw?.attributes ?? {};
  const state = mapApplePhasedReleaseState(attrs.phasedReleaseState ?? 'INACTIVE');
  const currentDay = attrs.currentDayNumber as number | undefined;

  return {
    id: raw?.id ?? '',
    versionId: versionId || raw?.id || '',
    state,
    currentDayNumber: currentDay ?? undefined,
    startDate: attrs.startDate ? new Date(attrs.startDate) : undefined,
    totalPauseDuration: attrs.totalPauseDuration ?? undefined,
    rolloutPercentage: currentDay != null
      ? (APPLE_PHASED_DAY_PERCENT[currentDay] ?? 0)
      : (state === 'complete' ? 100 : 0),
  };
}

export function createApplePhasedReleases(
  ctx: AppleContext,
): Pick<
  AppStoreCapability,
  'createPhasedRelease' | 'getPhasedRelease' | 'updatePhasedRelease' | 'deletePhasedRelease' | 'createReleaseRequest'
> {
  return {
    async createPhasedRelease(
      tokens: TokenSet,
      _appId: string,
      request: CreatePhasedReleaseRequest,
    ): Promise<PhasedRelease> {
      const data = await ctx.appleRequest(tokens, '/appStoreVersionPhasedReleases', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'appStoreVersionPhasedReleases',
            attributes: {
              phasedReleaseState: 'INACTIVE',
            },
            relationships: {
              appStoreVersion: {
                data: { type: 'appStoreVersions', id: request.versionId },
              },
            },
          },
        }),
      });

      return mapApplePhasedRelease(request.versionId, data.data);
    },

    async getPhasedRelease(
      tokens: TokenSet,
      _appId: string,
      versionId: string,
    ): Promise<PhasedRelease> {
      const data = await ctx.appleRequest(
        tokens,
        `/appStoreVersions/${versionId}?include=appStoreVersionPhasedRelease`,
      );

      const phasedRelease = (data.included ?? []).find(
        (r: any) => r.type === 'appStoreVersionPhasedReleases',
      );

      if (!phasedRelease) {
        throw new CapabilityError('apple', `No phased release found for version ${versionId}`, false);
      }

      return mapApplePhasedRelease(versionId, phasedRelease);
    },

    async updatePhasedRelease(
      tokens: TokenSet,
      _appId: string,
      phasedReleaseId: string,
      update: UpdatePhasedReleaseRequest,
    ): Promise<PhasedRelease> {
      if (!update.state) {
        throw new CapabilityError(
          'apple',
          'Must specify a state (active, paused, or complete) to update an Apple phased release.',
          false,
        );
      }

      const appleState = mapPhasedReleaseStateToApple(update.state);

      const data = await ctx.appleRequest(
        tokens,
        `/appStoreVersionPhasedReleases/${phasedReleaseId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            data: {
              type: 'appStoreVersionPhasedReleases',
              id: phasedReleaseId,
              attributes: { phasedReleaseState: appleState },
            },
          }),
        },
      );

      return mapApplePhasedRelease('', data.data);
    },

    async deletePhasedRelease(
      tokens: TokenSet,
      _appId: string,
      phasedReleaseId: string,
    ): Promise<void> {
      await ctx.appleRequest(tokens, `/appStoreVersionPhasedReleases/${phasedReleaseId}`, {
        method: 'DELETE',
      });
    },

    async createReleaseRequest(
      tokens: TokenSet,
      _appId: string,
      versionId: string,
    ): Promise<ReleaseRequest> {
      const data = await ctx.appleRequest(tokens, '/appStoreVersionReleaseRequests', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'appStoreVersionReleaseRequests',
            relationships: {
              appStoreVersion: {
                data: { type: 'appStoreVersions', id: versionId },
              },
            },
          },
        }),
      });

      return {
        id: data.data?.id ?? versionId,
        versionId,
        requestedAt: new Date(),
      };
    },
  };
}
