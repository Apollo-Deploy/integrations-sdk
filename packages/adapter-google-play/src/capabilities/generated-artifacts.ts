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
import { BASE_URL } from "./_context.js";

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
      tokens: TokenSet,
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

      const url = `${BASE_URL}/applications/${packageName}/generatedApks/${versionCode}`;
      const data = await ctx.gpRequest<{
        generatedApks?: Record<string, unknown>[];
      }>(tokens, url);

      const signingKeys = (data.generatedApks ?? []).map(
        mapGeneratedArtifactsPerSigningKey,
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
      tokens: TokenSet,
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

      const url = `${BASE_URL}/applications/${packageName}/generatedApks/${versionCode}/downloads/${downloadId}:download`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      if (!res.ok) {
        const body = await res.text();
        throw new CapabilityError(
          "google-play",
          `Failed to download generated artifact: ${res.status} ${body}`,
          res.status === 429,
        );
      }

      return res;
    },

    /**
     * List build deliverables — a higher-level view that flattens generated
     * artifacts into a normalized BuildDeliverablesResult.
     */
    async listBuildDeliverables(
      tokens: TokenSet,
      packageName: string,
      buildId: string,
    ): Promise<BuildDeliverablesResult> {
      const url = `${BASE_URL}/applications/${packageName}/generatedApks/${buildId}`;
      const data = await ctx.gpRequest<{
        generatedApks?: Record<string, unknown>[];
      }>(tokens, url);
      const signingKeys = (data.generatedApks ?? []).map(
        mapGeneratedArtifactsPerSigningKey,
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
