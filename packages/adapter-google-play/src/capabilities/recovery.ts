import type {
  AppStoreCapability,
  TokenSet,
  Paginated,
  AppRecoveryAction,
  CreateAppRecoveryRequest,
  AppRecoveryTargetingRequest,
  AppRecoveryListOpts,
} from "@apollo-deploy/integrations";
import { CapabilityError } from "@apollo-deploy/integrations";
import type { GooglePlayContext } from "./_context.js";

function mapGoogleRecoveryAction(
  packageName: string,
  raw: Record<string, any>,
): AppRecoveryAction {
  return {
    appRecoveryId: String(raw.appRecoveryId ?? raw.id ?? ""),
    appId: packageName,
    status: raw.status ?? raw.recoveryStatus ?? "RECOVERY_STATUS_UNSPECIFIED",
    targeting: raw.targeting
      ? {
          versionList: raw.targeting.versionList
            ? {
                versionCodes: (
                  raw.targeting.versionList.versionCodes ?? []
                ).map(String),
              }
            : undefined,
          versionRange: raw.targeting.versionRange
            ? {
                versionCodeLowerBound: String(
                  raw.targeting.versionRange.versionCodeStart ??
                    raw.targeting.versionRange.versionCodeLowerBound,
                ),
                versionCodeUpperBound: raw.targeting.versionRange.versionCodeEnd
                  ? String(raw.targeting.versionRange.versionCodeEnd)
                  : raw.targeting.versionRange.versionCodeUpperBound
                    ? String(raw.targeting.versionRange.versionCodeUpperBound)
                    : undefined,
              }
            : undefined,
          allUsers:
            raw.targeting.allUsers?.isAllUsersRequested ??
            raw.targeting.allUsers ??
            undefined,
          androidSdkVersions: raw.targeting.androidSdks?.sdkLevels?.map(String),
          regions: raw.targeting.regions
            ? {
                includeList:
                  raw.targeting.regions.regionCode ??
                  raw.targeting.regions.includeList,
                excludeList: raw.targeting.regions.excludeList,
              }
            : undefined,
        }
      : undefined,
    remediationMeasures:
      raw.remediationMeasures ??
      (raw.remoteInAppUpdateData ? [{ type: "REMOTE_IN_APP_UPDATE" }] : undefined),
    createTime: raw.createTime ? new Date(raw.createTime) : undefined,
    deployTime: raw.deployTime ? new Date(raw.deployTime) : undefined,
    cancelTime: raw.cancelTime ? new Date(raw.cancelTime) : undefined,
    lastUpdateTime: raw.lastUpdateTime
      ? new Date(raw.lastUpdateTime)
      : undefined,
  };
}

export function createGooglePlayRecovery(
  ctx: GooglePlayContext,
): Pick<
  AppStoreCapability,
  | "listAppRecoveryActions"
  | "createAppRecoveryAction"
  | "deployAppRecoveryAction"
  | "cancelAppRecoveryAction"
  | "addAppRecoveryTargeting"
> {
  async function getRecoveryAction(
    packageName: string,
    recoveryId: string,
  ): Promise<AppRecoveryAction> {
    const data = await ctx.publisherRequest(
      ctx.client.apprecovery.list({ packageName }),
    );

    const match = (data.recoveryActions ?? []).find(
      (action) => String(action.appRecoveryId ?? "") === recoveryId,
    );
    if (!match) {
      throw new CapabilityError(
        "google-play",
        `App recovery action ${recoveryId} not found`,
        false,
      );
    }

    return mapGoogleRecoveryAction(packageName, match);
  }

  return {
    async listAppRecoveryActions(
      _tokens: TokenSet,
      packageName: string,
      opts?: AppRecoveryListOpts,
    ): Promise<Paginated<AppRecoveryAction>> {
      const data = await ctx.publisherRequest(
        ctx.client.apprecovery.list({
          packageName,
          ...(opts?.versionCode ? { versionCode: opts.versionCode } : {}),
        }),
      );

      const actions = (data?.recoveryActions ?? []).map((r: Record<string, any>) =>
        mapGoogleRecoveryAction(packageName, r),
      );
      const start = opts?.cursor ? Number.parseInt(opts.cursor, 10) || 0 : 0;
      const end = opts?.limit ? start + opts.limit : actions.length;
      const items = actions.slice(start, end);
      const nextCursor = end < actions.length ? String(end) : undefined;

      return {
        items,
        hasMore: nextCursor != null,
        cursor: nextCursor,
      };
    },

    async createAppRecoveryAction(
      _tokens: TokenSet,
      packageName: string,
      request: CreateAppRecoveryRequest,
    ): Promise<AppRecoveryAction> {
      if (request.remediationType !== "REMOTE_IN_APP_UPDATE") {
        throw new CapabilityError(
          "google-play",
          "The Android Publisher SDK currently supports only REMOTE_IN_APP_UPDATE recovery actions.",
          false,
        );
      }

      const body: Record<string, unknown> = {
        remoteInAppUpdate: { isRemoteInAppUpdateRequested: true },
      };

      if (request.allUsers) {
        body.targeting = { allUsers: { isAllUsersRequested: true } };
      } else if (request.versionRange) {
        body.targeting = {
          versionRange: {
            versionCodeStart: request.versionRange.lowerBound,
            ...(request.versionRange.upperBound && {
              versionCodeEnd: request.versionRange.upperBound,
            }),
          },
        };
      } else if (request.versionCodes?.length) {
        body.targeting = {
          versionList: { versionCodes: request.versionCodes },
        };
      }

      const raw = await ctx.publisherRequest(
        ctx.client.apprecovery.create({
          packageName,
          requestBody: body,
        }),
      );

      return mapGoogleRecoveryAction(packageName, raw);
    },

    async deployAppRecoveryAction(
      _tokens: TokenSet,
      packageName: string,
      recoveryId: string,
    ): Promise<AppRecoveryAction> {
      await ctx.publisherRequest(
        ctx.client.apprecovery.deploy({
          packageName,
          appRecoveryId: recoveryId,
          requestBody: {},
        }),
      );
      return getRecoveryAction(packageName, recoveryId);
    },

    async cancelAppRecoveryAction(
      _tokens: TokenSet,
      packageName: string,
      recoveryId: string,
    ): Promise<AppRecoveryAction> {
      await ctx.publisherRequest(
        ctx.client.apprecovery.cancel({
          packageName,
          appRecoveryId: recoveryId,
          requestBody: {},
        }),
      );
      return getRecoveryAction(packageName, recoveryId);
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async addAppRecoveryTargeting(
      _tokens: TokenSet,
      packageName: string,
      recoveryId: string,
      targeting: AppRecoveryTargetingRequest,
    ): Promise<AppRecoveryAction> {
      if (targeting.versionCodes?.length) {
        throw new CapabilityError(
          "google-play",
          "The Android Publisher SDK does not support adding recovery targeting by explicit versionCodes.",
          false,
        );
      }

      if (targeting.regions?.excludeList?.length) {
        throw new CapabilityError(
          "google-play",
          "The Android Publisher SDK does not support excludeList for recovery targeting regions.",
          false,
        );
      }

      const body: Record<string, unknown> = {};

      if (targeting.regions) {
        body.regions = {
          regionCode: targeting.regions.includeList ?? [],
        };
      }
      if (targeting.androidSdkVersions?.length) {
        body.androidSdks = { sdkLevels: targeting.androidSdkVersions };
      }

      await ctx.publisherRequest(
        ctx.client.apprecovery.addTargeting({
          packageName,
          appRecoveryId: recoveryId,
          requestBody: { targetingUpdate: body },
        }),
      );

      return getRecoveryAction(packageName, recoveryId);
    },
  };
}
