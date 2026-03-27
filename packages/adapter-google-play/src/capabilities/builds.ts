import { Buffer } from "node:buffer";
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

async function blobToUploadBody(file: Blob): Promise<Buffer> {
  return Buffer.from(await file.arrayBuffer());
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
  /** Shared helper: opens an edit, fetches all bundles + APKs, and maps them. */
  async function fetchAllBuildsInEdit(packageName: string): Promise<StoreBuild[]> {
    return ctx.withEdit(packageName, async (editId) => {
      const [bundles, apks] = await Promise.all([
        ctx.publisherRequest(
          ctx.client.edits.bundles.list({ packageName, editId }),
        ),
        ctx.publisherRequest(
          ctx.client.edits.apks.list({ packageName, editId }),
        ),
      ]);

      return [
        ...(bundles?.bundles ?? []).map((b: Record<string, any>) =>
          mapGoogleBuild(packageName, b, "bundle"),
        ),
        ...(apks?.apks ?? []).map((a: Record<string, any>) =>
          mapGoogleBuild(packageName, a, "apk"),
        ),
      ];
    });
  }

  return {
    async listBuilds(
      _tokens: TokenSet,
      packageName: string,
      _opts?: BuildListOpts,
    ): Promise<Paginated<StoreBuild>> {
      const items = await fetchAllBuildsInEdit(packageName);
      return { items, hasMore: false };
    },

    async getBuild(
      _tokens: TokenSet,
      packageName: string,
      buildId: string,
    ): Promise<StoreBuild> {
      const allBuilds = await fetchAllBuildsInEdit(packageName);
      const match = allBuilds.find((b) => b.id === buildId);
      if (!match) {
        throw new CapabilityError(
          "google-play",
          `Build ${buildId} not found`,
          false,
        );
      }
      return match;
    },

    async listBuildArtifacts(
      _tokens: TokenSet,
      packageName: string,
      buildId: string,
    ): Promise<StoreArtifact[]> {
      return ctx.withEdit(packageName, async (editId) => {
        const [bundles, apks] = await Promise.all([
          ctx.publisherRequest(
            ctx.client.edits.bundles.list({ packageName, editId }),
          ),
          ctx.publisherRequest(
            ctx.client.edits.apks.list({ packageName, editId }),
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
      _tokens: TokenSet,
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
      const uploadBody = await blobToUploadBody(file);

      if (channel === "internal-sharing") {
        const contentType =
          fileType === "apk"
            ? "application/vnd.android.package-archive"
            : "application/octet-stream";

        const raw =
          fileType === "aab"
            ? await ctx.publisherRequest(
                ctx.client.internalappsharingartifacts.uploadbundle({
                  packageName,
                  media: { mimeType: contentType, body: uploadBody },
                }),
              )
            : await ctx.publisherRequest(
                ctx.client.internalappsharingartifacts.uploadapk({
                  packageName,
                  media: { mimeType: contentType, body: uploadBody },
                }),
              );
        const artifact: InternalSharingArtifact = {
          downloadUrl: raw.downloadUrl ?? "",
          certificateFingerprint: raw.certificateFingerprint ?? undefined,
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
          packageName,
          async (editId) => {
            const raw = await ctx.publisherRequest(
              ctx.client.edits.bundles.upload({
                packageName,
                editId,
                ...(query.deviceTierConfigId
                  ? { deviceTierConfigId: query.deviceTierConfigId }
                  : {}),
                media: {
                  mimeType: "application/octet-stream",
                  body: uploadBody,
                },
              }),
            );
            return mapGoogleBuild(packageName, raw, "bundle");
          },
          { commit },
        );
        return { channel: "store", fileType, build };
      }

      // fileType === 'apk'
      const build = await ctx.withEdit(
        packageName,
        async (editId) => {
          const raw = await ctx.publisherRequest(
            ctx.client.edits.apks.upload({
              packageName,
              editId,
              media: {
                mimeType: "application/vnd.android.package-archive",
                body: uploadBody,
              },
            }),
          );
          return mapGoogleBuild(packageName, raw, "apk");
        },
        { commit },
      );
      return { channel: "store", fileType, build };
    },
  };
}
