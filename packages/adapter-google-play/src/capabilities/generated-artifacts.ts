import type {
  AppStoreCapability,
  TokenSet,
  GeneratedArtifactsResult,
  GeneratedArtifactsListOpts,
  BuildDeliverablesResult,
} from "@apollo-deploy/integrations";
import { CapabilityError } from "@apollo-deploy/integrations";
import {
  mapGeneratedArtifactsPerSigningKey,
  flattenGeneratedArtifactsToBuildDeliverables,
} from "../mappers/generated-artifacts.js";
import type { GooglePlayContext } from "./_context.js";

function parseVersionCode(versionCode: string): number {
  const parsed = Number(versionCode);
  if (!Number.isFinite(parsed)) {
    throw new CapabilityError(
      "google-play",
      `Invalid versionCode: ${versionCode}`,
      false,
    );
  }
  return parsed;
}

export function createGooglePlayGeneratedArtifacts(
  ctx: GooglePlayContext,
): Pick<
  AppStoreCapability,
  | "listGeneratedArtifacts"
  | "downloadGeneratedArtifact"
  | "listBuildDeliverables"
> {
  return {
    /**
     * List all generated artifacts for a given app bundle version code.
     *
     * Calls: GET /applications/{packageName}/generatedApks/{versionCode}
     *
     * Returns split APKs, standalone APKs, a universal APK, asset pack slices,
     * and recovery modules — all grouped by signing key.
     */
    async listGeneratedArtifacts(
      _tokens: TokenSet,
      packageName: string,
      opts: GeneratedArtifactsListOpts,
    ): Promise<GeneratedArtifactsResult> {
      const versionCode = opts.versionCode;
      if (!versionCode) {
        throw new CapabilityError(
          "google-play",
          "versionCode is required to list generated artifacts.",
          false,
        );
      }

      const data = await ctx.publisherRequest(
        ctx.client.generatedapks.list({
          packageName,
          versionCode: parseVersionCode(versionCode),
        }),
      );

      const signingKeys = (data.generatedApks ?? []).map(
        (raw) => mapGeneratedArtifactsPerSigningKey(raw as Record<string, unknown>),
      );

      return {
        appId: packageName,
        versionCode,
        signingKeys,
      };
    },

    /**
     * Download a single generated artifact by its download ID.
     *
     * Calls: GET /applications/{packageName}/generatedApks/{versionCode}/downloads/{downloadId}:download
     *
     * Returns a raw Response whose body is the binary stream.
     */
    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async downloadGeneratedArtifact(
      _tokens: TokenSet,
      packageName: string,
      versionCode: string,
      downloadId: string,
    ): Promise<Response> {
      if (!versionCode || !downloadId) {
        throw new CapabilityError(
          "google-play",
          "versionCode and downloadId are required to download a generated artifact.",
          false,
        );
      }

      try {
        const res = await ctx.client.generatedapks.download(
          {
            packageName,
            versionCode: parseVersionCode(versionCode),
            downloadId,
          },
          { responseType: "stream" },
        );

        return new Response(res.data as any, {
          status: res.status,
          headers: res.headers as Record<string, string>,
        });
      } catch (error) {
        throw ctx.publisherError(error, "Failed to download generated artifact");
      }
    },

    /**
     * List build deliverables — a higher-level view that flattens generated
     * artifacts into a normalized BuildDeliverablesResult.
     */
    async listBuildDeliverables(
      _tokens: TokenSet,
      packageName: string,
      buildId: string,
    ): Promise<BuildDeliverablesResult> {
      const data = await ctx.publisherRequest(
        ctx.client.generatedapks.list({
          packageName,
          versionCode: parseVersionCode(buildId),
        }),
      );
      const signingKeys = (data.generatedApks ?? []).map(
        (raw) => mapGeneratedArtifactsPerSigningKey(raw as Record<string, unknown>),
      );

      const deliverables = flattenGeneratedArtifactsToBuildDeliverables(
        buildId,
        signingKeys,
      );

      return {
        appId: packageName,
        buildId,
        deliverables,
      };
    },
  };
}
