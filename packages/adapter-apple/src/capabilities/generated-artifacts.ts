import type {
  AppStoreCapability,
  TokenSet,
  GeneratedArtifactsResult,
  GeneratedArtifactsListOpts,
  BuildDeliverablesResult,
  BuildDeliverable,
} from "@apollo-deploy/integrations";
import { CapabilityError } from "@apollo-deploy/integrations";
import {
  mapAppleBuildBundleToDeliverables,
  mapAppleBundleFileSizeToDeliverable,
} from "../mappers/generated-artifacts.js";
import type { AppleContext } from "./_context.js";

export function createAppleGeneratedArtifacts(
  ctx: AppleContext,
): Pick<
  AppStoreCapability,
  | "listGeneratedArtifacts"
  | "downloadGeneratedArtifact"
  | "listBuildDeliverables"
> {
  return {
    /**
     * List generated artifacts — Apple equivalent.
     *
     * Apple doesn’t generate APKs from bundles. Instead, we query build bundles
     * and their file sizes (app thinning variants) to provide a comparable
     * data structure, mapped into GeneratedArtifactsResult.
     *
     * The `signingKeys` array will contain a single entry with the build
     * deliverables mapped into the universal / split structure.
     */
    async listGeneratedArtifacts(
      tokens: TokenSet,
      appId: string,
      opts: GeneratedArtifactsListOpts,
    ): Promise<GeneratedArtifactsResult> {
      const buildId = opts.versionCode;
      if (!buildId) {
        throw new CapabilityError(
          "apple",
          "versionCode (build ID) is required to list build deliverables.",
          false,
        );
      }

      // Fetch build with included buildBundles
      const data = await ctx.appleRequest(
        tokens,
        `/builds/${buildId}?include=buildBundles`,
      );

      const bundles = (data.included ?? []).filter(
        (r: Record<string, unknown>) => r.type === "buildBundles",
      );

      // For each bundle, get file sizes (app thinning variants)
      const allDeliverables: BuildDeliverable[] = [];
      for (const bundle of bundles) {
        // Try to get detailed file sizes
        try {
          const fileSizes = await ctx.appleRequest(
            tokens,
            `/buildBundles/${bundle.id}/buildBundleFileSizes?limit=200`,
          );
          for (const fs of fileSizes.data ?? []) {
            allDeliverables.push(
              mapAppleBundleFileSizeToDeliverable(buildId, fs),
            );
          }
        } catch {
          // File sizes may not be available; fall back to bundle-level info
          allDeliverables.push(
            ...mapAppleBuildBundleToDeliverables(buildId, bundle),
          );
        }

        // Fetch dSYMs
        try {
          const dsyms = await ctx.appleRequest(
            tokens,
            `/buildBundles/${bundle.id}/dSYMs`,
          );
          for (const dsym of dsyms.data ?? []) {
            allDeliverables.push({
              id: dsym.id,
              buildId,
              type: "dsym",
              variant: dsym.attributes?.platformName,
              compressedSize: dsym.attributes?.fileSize
                ? Number(dsym.attributes.fileSize)
                : undefined,
              downloadable: !!dsym.attributes?.downloadUrl,
              downloadUrl: dsym.attributes?.downloadUrl,
            });
          }
        } catch {
          // dSYMs may not be available yet
        }
      }

      // Map into the GeneratedArtifactsResult format for a unified interface.
      // Apple has no signing key concept, so we use a single entry.
      return {
        appId,
        versionCode: buildId,
        signingKeys: [
          {
            certificateSha256Hash: "apple-code-signing",
            generatedSplitApks: [],
            generatedStandaloneApks: [],
            generatedUniversalApk: undefined,
            generatedAssetPackSlices: [],
            generatedRecoveryModules: [],
            targetingInfo: {
              packageName: appId,
              variants: allDeliverables
                .filter((d) => d.type === "app_thinning_variant")
                .map((d, i) => ({
                  variantNumber: i,
                  targeting: undefined,
                  modules: [
                    {
                      name: "base",
                      artifacts: [
                        {
                          path: d.variant ?? "universal",
                        },
                      ],
                    },
                  ],
                })),
              assetSliceSets: [],
            },
          },
        ],
      };
    },

    /**
     * Download a build deliverable.
     *
     * Apple: Downloads via the buildBundleFileSizes download URL or dSYM
     * download URL. The downloadId should be the deliverable's download URL
     * or the buildBundleFileSize ID.
     */
    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async downloadGeneratedArtifact(
      tokens: TokenSet,
      _appId: string,
      _versionCode: string,
      downloadId: string,
    ): Promise<Response> {
      // If downloadId looks like a URL, fetch directly
      if (downloadId.startsWith("http")) {
        const res = await fetch(downloadId);
        if (!res.ok) {
          throw new CapabilityError(
            "apple",
            `Failed to download deliverable: ${res.status}`,
            res.status === 429,
          );
        }
        return res;
      }

      // Otherwise, treat as a buildBundleFileSizes ID and look up the URL
      const data = await ctx.appleRequest(
        tokens,
        `/buildBundleFileSizes/${downloadId}`,
      );
      const url = data.data?.attributes?.downloadUrl;
      if (!url) {
        throw new CapabilityError(
          "apple",
          `No download URL available for deliverable ${downloadId}. The artifact may still be processing.`,
          false,
        );
      }

      const res = await fetch(url);
      if (!res.ok) {
        throw new CapabilityError(
          "apple",
          `Failed to download deliverable: ${res.status}`,
          res.status === 429,
        );
      }
      return res;
    },

    /**
     * List build deliverables — high-level convenience.
     *
     * Fetches build bundles, file sizes, and dSYMs, returning a normalized result.
     */
    async listBuildDeliverables(
      tokens: TokenSet,
      appId: string,
      buildId: string,
    ): Promise<BuildDeliverablesResult> {
      const data = await ctx.appleRequest(
        tokens,
        `/builds/${buildId}?include=buildBundles`,
      );

      const bundles = (data.included ?? []).filter(
        (r: Record<string, unknown>) => r.type === "buildBundles",
      );

      const deliverables: BuildDeliverable[] = [];

      for (const bundle of bundles) {
        // Fetch detailed file sizes (app thinning variants)
        try {
          const fileSizes = await ctx.appleRequest(
            tokens,
            `/buildBundles/${bundle.id}/buildBundleFileSizes?limit=200`,
          );
          for (const fs of fileSizes.data ?? []) {
            deliverables.push(mapAppleBundleFileSizeToDeliverable(buildId, fs));
          }
        } catch {
          deliverables.push(
            ...mapAppleBuildBundleToDeliverables(buildId, bundle),
          );
        }

        // Fetch dSYMs
        try {
          const dsyms = await ctx.appleRequest(
            tokens,
            `/buildBundles/${bundle.id}/dSYMs`,
          );
          for (const dsym of dsyms.data ?? []) {
            deliverables.push({
              id: dsym.id,
              buildId,
              type: "dsym",
              variant: dsym.attributes?.platformName,
              compressedSize: dsym.attributes?.fileSize
                ? Number(dsym.attributes.fileSize)
                : undefined,
              downloadable: !!dsym.attributes?.downloadUrl,
              downloadUrl: dsym.attributes?.downloadUrl,
            });
          }
        } catch {
          // dSYMs may not be available
        }
      }

      return { appId, buildId, deliverables };
    },
  };
}
