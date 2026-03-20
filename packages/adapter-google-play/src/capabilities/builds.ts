import type {
  AppStoreCapability,
  TokenSet,
  Paginated,
  StoreBuild,
  StoreArtifact,
  BuildListOpts,
  UploadBinaryOpts,
  UploadBinaryResult,
  InternalSharingArtifact,
} from "@apollo-deploy/integrations";
import { CapabilityError } from "@apollo-deploy/integrations";
import { mapGoogleBuild, mapGoogleArtifact } from "../mappers/models.js";
import type { GooglePlayContext } from "./_context.js";
import { BASE_URL } from "./_context.js";

/**
 * Detect file type from MIME, then filename extension (for `File` objects).
 */
function detectFileType(file: Blob): "aab" | "apk" | "ipa" | null {
  const mime = file.type;
  if (mime === "application/vnd.android.package-archive") return "apk";
  const name = ((file as File).name ?? "").toLowerCase();
  if (name.endsWith(".apk")) return "apk";
  if (name.endsWith(".aab")) return "aab";
  if (name.endsWith(".ipa")) return "ipa";
  return null;
}

export function createGooglePlayBuilds(
  ctx: GooglePlayContext,
): Pick<
  AppStoreCapability,
  | "listBuilds"
  | "getBuild"
  | "listBuildArtifacts"
  | "getArtifactDownloadUrl"
  | "uploadBinary"
> {
  return {
    async listBuilds(
      tokens: TokenSet,
      packageName: string,
      _opts?: BuildListOpts,
    ): Promise<Paginated<StoreBuild>> {
      return ctx.withEdit(tokens, packageName, async (editId) => {
        const [bundles, apks] = await Promise.all([
          ctx.gpRequest(
            tokens,
            `${BASE_URL}/applications/${packageName}/edits/${editId}/bundles`,
          ),
          ctx.gpRequest(
            tokens,
            `${BASE_URL}/applications/${packageName}/edits/${editId}/apks`,
          ),
        ]);

        const items: StoreBuild[] = [
          ...(bundles?.bundles ?? []).map((b: Record<string, any>) =>
            mapGoogleBuild(packageName, b, "bundle"),
          ),
          ...(apks?.apks ?? []).map((a: Record<string, any>) =>
            mapGoogleBuild(packageName, a, "apk"),
          ),
        ];

        return { items, hasMore: false };
      });
    },

    async getBuild(
      tokens: TokenSet,
      packageName: string,
      buildId: string,
    ): Promise<StoreBuild> {
      return ctx.withEdit(tokens, packageName, async (editId) => {
        const [bundles, apks] = await Promise.all([
          ctx.gpRequest(
            tokens,
            `${BASE_URL}/applications/${packageName}/edits/${editId}/bundles`,
          ),
          ctx.gpRequest(
            tokens,
            `${BASE_URL}/applications/${packageName}/edits/${editId}/apks`,
          ),
        ]);

        const allBuilds = [
          ...(bundles?.bundles ?? []).map((b: Record<string, any>) =>
            mapGoogleBuild(packageName, b, "bundle"),
          ),
          ...(apks?.apks ?? []).map((a: Record<string, any>) =>
            mapGoogleBuild(packageName, a, "apk"),
          ),
        ];

        const match = allBuilds.find((b) => b.id === buildId);
        if (!match) {
          throw new CapabilityError(
            "google-play",
            `Build ${buildId} not found`,
            false,
          );
        }
        return match;
      });
    },

    async listBuildArtifacts(
      tokens: TokenSet,
      packageName: string,
      buildId: string,
    ): Promise<StoreArtifact[]> {
      return ctx.withEdit(tokens, packageName, async (editId) => {
        const [bundles, apks] = await Promise.all([
          ctx.gpRequest(
            tokens,
            `${BASE_URL}/applications/${packageName}/edits/${editId}/bundles`,
          ),
          ctx.gpRequest(
            tokens,
            `${BASE_URL}/applications/${packageName}/edits/${editId}/apks`,
          ),
        ]);

        const results: StoreArtifact[] = [];

        for (const b of bundles?.bundles ?? []) {
          if (String(b.versionCode) === buildId) {
            results.push(mapGoogleArtifact(packageName, buildId, b, "aab"));
          }
        }
        for (const a of apks?.apks ?? []) {
          if (String(a.versionCode) === buildId) {
            results.push(mapGoogleArtifact(packageName, buildId, a, "apk"));
          }
        }

        return results;
      });
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async getArtifactDownloadUrl(
      _tokens: TokenSet,
      _appId: string,
      _buildId: string,
      _artifactId: string,
    ): Promise<{ url: string; expiresAt: Date }> {
      throw new CapabilityError(
        "google-play",
        "Google Play does not provide artifact download URLs via the API.",
        false,
      );
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async uploadBinary(
      tokens: TokenSet,
      packageName: string,
      file: Blob,
      opts: UploadBinaryOpts = {},
    ): Promise<UploadBinaryResult> {
      const fileType = opts.fileType ?? detectFileType(file);
      if (!fileType) {
        throw new CapabilityError(
          "google-play",
          "Cannot determine file type. Pass opts.fileType explicitly ('aab' | 'apk')." +
            ' Hint: use a File object with a .aab/.apk extension, or set file.type = "application/vnd.android.package-archive" for APKs.',
          false,
        );
      }

      if (fileType === "ipa") {
        throw new CapabilityError(
          "google-play",
          "IPA files are an Apple-only format. Upload an AAB or APK for Google Play.",
          false,
        );
      }

      const channel = opts.channel ?? "store";

      if (channel === "internal-sharing") {
        const path =
          fileType === "aab"
            ? `/applications/internalappsharing/${packageName}/artifacts/bundle`
            : `/applications/internalappsharing/${packageName}/artifacts/apk`;
        const contentType =
          fileType === "apk"
            ? "application/vnd.android.package-archive"
            : "application/octet-stream";

        const raw = await ctx.gpUpload(tokens, path, file, contentType);
        const artifact: InternalSharingArtifact = {
          downloadUrl: raw.downloadUrl ?? "",
          certificateFingerprint: raw.certificateFingerprint,
          type: fileType,
        };
        return { channel: "internal-sharing", fileType, artifact };
      }

      // channel === 'store'
      const commit = opts.commitEdit !== false;
      const query: Record<string, string> = {};
      if (opts.deviceTierConfigId)
        query.deviceTierConfigId = opts.deviceTierConfigId;

      if (fileType === "aab") {
        const build = await ctx.withEdit(
          tokens,
          packageName,
          async (editId) => {
            const raw = await ctx.gpUpload(
              tokens,
              `/applications/${packageName}/edits/${editId}/bundles`,
              file,
              "application/octet-stream",
              query,
            );
            return mapGoogleBuild(packageName, raw, "bundle");
          },
          { commit },
        );
        return { channel: "store", fileType, build };
      }

      // fileType === 'apk'
      const build = await ctx.withEdit(
        tokens,
        packageName,
        async (editId) => {
          const raw = await ctx.gpUpload(
            tokens,
            `/applications/${packageName}/edits/${editId}/apks`,
            file,
            "application/vnd.android.package-archive",
          );
          return mapGoogleBuild(packageName, raw, "apk");
        },
        { commit },
      );
      return { channel: "store", fileType, build };
    },
  };
}
