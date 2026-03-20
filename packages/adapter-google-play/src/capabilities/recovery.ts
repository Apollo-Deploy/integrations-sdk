import type {
  AppStoreCapability,
  TokenSet,
  Paginated,
  AppRecoveryAction,
  CreateAppRecoveryRequest,
  AppRecoveryTargetingRequest,
  AppRecoveryListOpts,
} from "@apollo-deploy/integrations";
import type { GooglePlayContext } from "./_context.js";
import { BASE_URL } from "./_context.js";

function mapGoogleRecoveryAction(
  packageName: string,
  raw: Record<string, any>,
): AppRecoveryAction {
  return {
    appRecoveryId: String(raw.appRecoveryId ?? raw.id ?? ""),
    appId: packageName,
    status: raw.recoveryStatus ?? "RECOVERY_STATUS_UNSPECIFIED",
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
                  raw.targeting.versionRange.versionCodeLowerBound,
                ),
                versionCodeUpperBound: raw.targeting.versionRange
                  .versionCodeUpperBound
                  ? String(raw.targeting.versionRange.versionCodeUpperBound)
                  : undefined,
              }
            : undefined,
          allUsers: raw.targeting.allUsers ?? undefined,
          androidSdkVersions: raw.targeting.androidSdks?.sdkLevels?.map(String),
          regions: raw.targeting.regions,
        }
      : undefined,
    remediationMeasures: raw.remediationMeasures,
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
  return {
    async listAppRecoveryActions(
      tokens: TokenSet,
      packageName: string,
      opts?: AppRecoveryListOpts,
    ): Promise<Paginated<AppRecoveryAction>> {
      const params = new URLSearchParams();
      if (opts?.versionCode) params.set("versionCode", opts.versionCode);
      if (opts?.limit) params.set("pageSize", String(opts.limit));
      if (opts?.cursor) params.set("pageToken", opts.cursor);

      const data = await ctx.gpRequest(
        tokens,
        `${BASE_URL}/applications/${packageName}/appRecoveries?${params}`,
      );

      return {
        items: (data?.recoveryActions ?? []).map((r: Record<string, any>) =>
          mapGoogleRecoveryAction(packageName, r),
        ),
        hasMore: !!data?.nextPageToken,
        cursor: data?.nextPageToken,
      };
    },

    async createAppRecoveryAction(
      tokens: TokenSet,
      packageName: string,
      request: CreateAppRecoveryRequest,
    ): Promise<AppRecoveryAction> {
      const body: Record<string, unknown> = {
        remediationMeasures: [{ type: request.remediationType }],
      };

      if (request.allUsers) {
        body.targeting = { allUserTargeting: {} };
      } else if (request.versionRange) {
        body.targeting = {
          versionRange: {
            versionCodeLowerBound: request.versionRange.lowerBound,
            ...(request.versionRange.upperBound && {
              versionCodeUpperBound: request.versionRange.upperBound,
            }),
          },
        };
      } else if (request.versionCodes?.length) {
        body.targeting = {
          versionList: { versionCodes: request.versionCodes },
        };
      }

      const raw = await ctx.gpRequest(
        tokens,
        `${BASE_URL}/applications/${packageName}/appRecoveries:create`,
        { method: "POST", body: JSON.stringify(body) },
      );

      return mapGoogleRecoveryAction(packageName, raw);
    },

    async deployAppRecoveryAction(
      tokens: TokenSet,
      packageName: string,
      recoveryId: string,
    ): Promise<AppRecoveryAction> {
      const raw = await ctx.gpRequest(
        tokens,
        `${BASE_URL}/applications/${packageName}/appRecoveries/${recoveryId}:deploy`,
        { method: "POST", body: JSON.stringify({}) },
      );
      return mapGoogleRecoveryAction(packageName, raw);
    },

    async cancelAppRecoveryAction(
      tokens: TokenSet,
      packageName: string,
      recoveryId: string,
    ): Promise<AppRecoveryAction> {
      const raw = await ctx.gpRequest(
        tokens,
        `${BASE_URL}/applications/${packageName}/appRecoveries/${recoveryId}:cancel`,
        { method: "POST", body: JSON.stringify({}) },
      );
      return mapGoogleRecoveryAction(packageName, raw);
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async addAppRecoveryTargeting(
      tokens: TokenSet,
      packageName: string,
      recoveryId: string,
      targeting: AppRecoveryTargetingRequest,
    ): Promise<AppRecoveryAction> {
      const body: Record<string, unknown> = {};

      if (targeting.versionCodes?.length) {
        body.versionList = { versionCodes: targeting.versionCodes };
      }
      if (targeting.regions) {
        body.regions = {
          includeList: targeting.regions.includeList ?? [],
          excludeList: targeting.regions.excludeList ?? [],
        };
      }
      if (targeting.androidSdkVersions?.length) {
        body.androidSdks = { sdkLevels: targeting.androidSdkVersions };
      }

      const raw = await ctx.gpRequest(
        tokens,
        `${BASE_URL}/applications/${packageName}/appRecoveries/${recoveryId}:addTargeting`,
        { method: "POST", body: JSON.stringify(body) },
      );

      return mapGoogleRecoveryAction(packageName, raw);
    },
  };
}
