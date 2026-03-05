import type {
  AppStoreCapability,
  TokenSet,
  AppRecoveryAction,
  CreateAppRecoveryRequest,
  AppRecoveryTargetingRequest,
  AppRecoveryListOpts,
  Paginated,
} from '@apollo-deploy/integrations';
import { CapabilityError } from '@apollo-deploy/integrations';

export function createAppleRecovery(): Pick<
  AppStoreCapability,
  | 'listAppRecoveryActions'
  | 'createAppRecoveryAction'
  | 'deployAppRecoveryAction'
  | 'cancelAppRecoveryAction'
  | 'addAppRecoveryTargeting'
> {
  return {
    async listAppRecoveryActions(
      _tokens: TokenSet,
      _appId: string,
      _opts?: AppRecoveryListOpts,
    ): Promise<Paginated<AppRecoveryAction>> {
      throw new CapabilityError(
        'apple',
        'App Recovery is a Google Play–only feature and is not available for Apple App Store Connect.',
        false,
      );
    },

    async createAppRecoveryAction(
      _tokens: TokenSet,
      _appId: string,
      _request: CreateAppRecoveryRequest,
    ): Promise<AppRecoveryAction> {
      throw new CapabilityError(
        'apple',
        'App Recovery is a Google Play–only feature and is not available for Apple App Store Connect.',
        false,
      );
    },

    async deployAppRecoveryAction(
      _tokens: TokenSet,
      _appId: string,
      _recoveryId: string,
    ): Promise<AppRecoveryAction> {
      throw new CapabilityError(
        'apple',
        'App Recovery is a Google Play–only feature and is not available for Apple App Store Connect.',
        false,
      );
    },

    async cancelAppRecoveryAction(
      _tokens: TokenSet,
      _appId: string,
      _recoveryId: string,
    ): Promise<AppRecoveryAction> {
      throw new CapabilityError(
        'apple',
        'App Recovery is a Google Play–only feature and is not available for Apple App Store Connect.',
        false,
      );
    },

    async addAppRecoveryTargeting(
      _tokens: TokenSet,
      _appId: string,
      _recoveryId: string,
      _targeting: AppRecoveryTargetingRequest,
    ): Promise<AppRecoveryAction> {
      throw new CapabilityError(
        'apple',
        'App Recovery is a Google Play–only feature and is not available for Apple App Store Connect.',
        false,
      );
    },
  };
}
