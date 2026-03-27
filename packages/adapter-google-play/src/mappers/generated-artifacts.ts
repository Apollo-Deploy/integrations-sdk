import type {
  GeneratedArtifact,
  GeneratedArtifactsPerSigningKey,
  GeneratedArtifactTargetingInfo,
  GeneratedArtifactVariant,
  GeneratedArtifactModule,
  GeneratedArtifactDescription,
  GeneratedArtifactAssetSliceSet,
  BuildDeliverable,
} from "@apollo-deploy/integrations";

// ── Raw Google Play API response types ───────────────────────────────────────

interface RawSplitApk {
  downloadId?: string;
  variantId?: number;
  moduleName?: string;
  splitId?: string;
}

interface RawStandaloneApk {
  downloadId?: string;
  variantId?: number;
}

interface RawUniversalApk {
  downloadId?: string;
}

interface RawAssetPackSlice {
  downloadId?: string;
  moduleName?: string;
  sliceId?: string;
  version?: string;
}

interface RawRecoveryApk {
  downloadId?: string;
  recoveryId?: string;
  recoveryStatus?: string;
  moduleName?: string;
}

interface RawApkDescription {
  targeting?: Record<string, unknown>;
  path?: string;
  splitApkMetadata?: { splitId?: string; isMasterSplit?: boolean };
  standaloneApkMetadata?: { fusedModuleName?: string[] };
  instantApkMetadata?: { splitId?: string; isMasterSplit?: boolean };
  assetSliceMetadata?: { splitId?: string; isMasterSplit?: boolean };
}

interface RawApkSet {
  moduleMetadata?: {
    name?: string;
    moduleType?: string;
    deliveryType?: string;
    dependencies?: string[];
  };
  apkDescription?: RawApkDescription[];
}

interface RawVariant {
  targeting?: {
    sdkVersionTargeting?: { value?: { min?: number }[] };
    abiTargeting?: { value?: { alias?: string }[] };
    screenDensityTargeting?: {
      value?: { densityAlias?: string; densityDpi?: number }[];
    };
  };
  apkSet?: RawApkSet[];
  variantNumber?: number;
}

interface RawAssetSliceSet {
  assetModuleMetadata?: { name?: string; deliveryType?: string };
  apkDescription?: RawApkDescription[];
}

interface RawTargetingInfo {
  packageName?: string;
  variant?: RawVariant[];
  assetSliceSet?: RawAssetSliceSet[];
}

interface RawPerSigningKey {
  certificateSha256Hash?: string;
  generatedSplitApks?: RawSplitApk[];
  generatedStandaloneApks?: RawStandaloneApk[];
  generatedUniversalApk?: RawUniversalApk;
  generatedAssetPackSlices?: RawAssetPackSlice[];
  generatedRecoveryModules?: RawRecoveryApk[];
  targetingInfo?: RawTargetingInfo;
}

// ── Mappers ──────────────────────────────────────────────────────────────────

function mapSplitApk(raw: RawSplitApk): GeneratedArtifact {
  return {
    downloadId: raw.downloadId ?? "",
    type: "split",
    variantId: raw.variantId,
    moduleName: raw.moduleName,
    splitId: raw.splitId,
  };
}

function mapStandaloneApk(raw: RawStandaloneApk): GeneratedArtifact {
  return {
    downloadId: raw.downloadId ?? "",
    type: "standalone",
    variantId: raw.variantId,
  };
}

function mapUniversalApk(raw: RawUniversalApk): GeneratedArtifact {
  return {
    downloadId: raw.downloadId ?? "",
    type: "universal",
  };
}

function mapAssetPackSlice(raw: RawAssetPackSlice): GeneratedArtifact {
  return {
    downloadId: raw.downloadId ?? "",
    type: "asset_pack_slice",
    moduleName: raw.moduleName,
    sliceId: raw.sliceId,
    assetVersion: raw.version,
  };
}

function mapRecoveryApk(raw: RawRecoveryApk): GeneratedArtifact {
  return {
    downloadId: raw.downloadId ?? "",
    type: "recovery",
    moduleName: raw.moduleName,
    recoveryId: raw.recoveryId,
    recoveryStatus: raw.recoveryStatus,
  };
}

function mapArtifactDescription(
  raw: RawApkDescription,
): GeneratedArtifactDescription {
  return {
    path: raw.path ?? "",
    splitId:
      raw.splitApkMetadata?.splitId ??
      raw.instantApkMetadata?.splitId ??
      raw.assetSliceMetadata?.splitId,
    isMasterSplit:
      raw.splitApkMetadata?.isMasterSplit ??
      raw.instantApkMetadata?.isMasterSplit,
    fusedModuleNames: raw.standaloneApkMetadata?.fusedModuleName,
  };
}

function mapModule(raw: RawApkSet): GeneratedArtifactModule {
  return {
    name: raw.moduleMetadata?.name ?? "base",
    moduleType:
      (raw.moduleMetadata
        ?.moduleType as GeneratedArtifactModule["moduleType"]) ?? undefined,
    deliveryType:
      (raw.moduleMetadata
        ?.deliveryType as GeneratedArtifactModule["deliveryType"]) ?? undefined,
    artifacts: (raw.apkDescription ?? []).map(mapArtifactDescription),
  };
}

function mapVariant(raw: RawVariant): GeneratedArtifactVariant {
  const targeting = raw.targeting;
  return {
    variantNumber: raw.variantNumber ?? 0,
    targeting: targeting
      ? {
          sdkVersion: targeting.sdkVersionTargeting?.value?.[0]
            ? { min: targeting.sdkVersionTargeting.value[0].min }
            : undefined,
          abi: targeting.abiTargeting?.value?.map(
            (a) => a.alias ?? "UNSPECIFIED_CPU_ARCHITECTURE",
          ),
          screenDensity: targeting.screenDensityTargeting?.value?.map(
            (d) =>
              d.densityAlias ?? String(d.densityDpi ?? "DENSITY_UNSPECIFIED"),
          ),
        }
      : undefined,
    modules: (raw.apkSet ?? []).map(mapModule),
  };
}

function mapAssetSliceSet(
  raw: RawAssetSliceSet,
): GeneratedArtifactAssetSliceSet {
  return {
    moduleName: raw.assetModuleMetadata?.name ?? "",
    deliveryType:
      (raw.assetModuleMetadata
        ?.deliveryType as GeneratedArtifactAssetSliceSet["deliveryType"]) ??
      undefined,
    slices: (raw.apkDescription ?? []).map(mapArtifactDescription),
  };
}

function mapTargetingInfo(
  raw: RawTargetingInfo,
): GeneratedArtifactTargetingInfo {
  return {
    packageName: raw.packageName ?? "",
    variants: (raw.variant ?? []).map(mapVariant),
    assetSliceSets: (raw.assetSliceSet ?? []).map(mapAssetSliceSet),
  };
}

export function mapGeneratedArtifactsPerSigningKey(
  raw: RawPerSigningKey,
): GeneratedArtifactsPerSigningKey {
  return {
    certificateSha256Hash: raw.certificateSha256Hash ?? "",
    generatedSplitApks: (raw.generatedSplitApks ?? []).map(mapSplitApk),
    generatedStandaloneApks: (raw.generatedStandaloneApks ?? []).map(
      mapStandaloneApk,
    ),
    generatedUniversalApk: raw.generatedUniversalApk
      ? mapUniversalApk(raw.generatedUniversalApk)
      : undefined,
    generatedAssetPackSlices: (raw.generatedAssetPackSlices ?? []).map(
      mapAssetPackSlice,
    ),
    generatedRecoveryModules: (raw.generatedRecoveryModules ?? []).map(
      mapRecoveryApk,
    ),
    targetingInfo: raw.targetingInfo
      ? mapTargetingInfo(raw.targetingInfo)
      : undefined,
  };
}

/**
 * Flatten all generated artifacts from all signing keys into a BuildDeliverable list.
 */
export function flattenGeneratedArtifactsToBuildDeliverables(
  buildId: string,
  signingKeys: GeneratedArtifactsPerSigningKey[],
): BuildDeliverable[] {
  const deliverables: BuildDeliverable[] = [];

  for (const key of signingKeys) {
    const allArtifacts: GeneratedArtifact[] = [
      ...key.generatedSplitApks,
      ...key.generatedStandaloneApks,
      ...(key.generatedUniversalApk ? [key.generatedUniversalApk] : []),
      ...key.generatedAssetPackSlices,
      ...key.generatedRecoveryModules,
    ];

    for (const artifact of allArtifacts) {
      const typeSuffix = artifact.moduleName
        ? `-${artifact.moduleName}`
        : artifact.splitId
          ? `-${artifact.splitId}`
          : "";

      deliverables.push({
        id: artifact.downloadId,
        buildId,
        // All Google Play generated artifacts (split, standalone, universal,
        // asset pack, recovery) are app-thinning variants in the normalized model.
        type: "app_thinning_variant",
        variant: [artifact.type, typeSuffix].filter(Boolean).join(""),
        downloadable: true,
        downloadUrl: undefined,
      });
    }
  }

  return deliverables;
}
