import type { AppStoreCapability, TokenSet, StoreArtifact, UploadBinaryOpts, UploadBinaryResult, StoreBuild } from '@apollo-deploy/integrations';
import { CapabilityError } from '@apollo-deploy/integrations';
import { mapAppleBuild, mapAppleArtifact } from '../mappers/models.js';
import { createHash } from 'node:crypto';
import type { AppleContext } from './_context.js';

export function createAppleBuilds(
  ctx: AppleContext,
): Pick<AppStoreCapability, 'listBuilds' | 'getBuild' | 'listBuildArtifacts' | 'getArtifactDownloadUrl' | 'uploadBinary'> {
  return {
    async listBuilds(tokens, appId, opts) {
      const params = new URLSearchParams({
        'filter[app]': appId,
        limit: String(opts?.limit ?? 20),
      });
      if (opts?.cursor) params.set('cursor', opts.cursor);
      if (opts?.status) params.set('filter[processingState]', opts.status.toUpperCase());
      if (opts?.version) params.set('filter[version]', opts.version);

      const data = await ctx.appleRequest(tokens, `/builds?${params}`);
      return {
        items: data.data.map(mapAppleBuild),
        hasMore: !!data.links?.next,
        cursor: ctx.extractCursor(data.links?.next),
      };
    },

    async getBuild(tokens, _appId, buildId) {
      const data = await ctx.appleRequest(tokens, `/builds/${buildId}`);
      return mapAppleBuild(data.data);
    },

    async listBuildArtifacts(tokens, _appId, buildId) {
      // Step 1: Get build bundles associated with this build
      const bundleData = await ctx.appleRequest(
        tokens,
        `/builds/${buildId}?include=buildBundles`,
      );

      const artifacts: StoreArtifact[] = [];
      const bundles = (bundleData.included ?? []).filter(
        (r: any) => r.type === 'buildBundles',
      );

      for (const bundle of bundles) {
        // Step 2: Fetch dSYMs for each bundle
        try {
          const dsyms = await ctx.appleRequest(tokens, `/buildBundles/${bundle.id}/dSYMs`);
          for (const dsym of dsyms.data ?? []) {
            artifacts.push(mapAppleArtifact(buildId, dsym, 'dsym'));
          }
        } catch {
          // dSYMs may not be available yet
        }
      }

      return artifacts;
    },

    async getArtifactDownloadUrl(tokens, _appId, _buildId, artifactId) {
      const data = await ctx.appleRequest(tokens, `/buildBundleFileSizes/${artifactId}`);
      return {
        url: data.data?.attributes?.downloadUrl as string ?? '',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };
    },

    async uploadBinary(
      tokens: TokenSet,
      appId: string,
      file: Blob,
      opts: UploadBinaryOpts = {},
    ): Promise<UploadBinaryResult> {
      const name = ((file as File).name ?? '').toLowerCase();
      const mime = file.type;

      // Detect file type: explicit opt > MIME > filename extension
      let fileType = opts.fileType;
      if (!fileType) {
        if (mime === 'application/vnd.android.package-archive' || name.endsWith('.apk')) {
          fileType = 'apk';
        } else if (name.endsWith('.aab')) {
          fileType = 'aab';
        } else if (name.endsWith('.ipa')) {
          fileType = 'ipa';
        }
      }

      if (!fileType) {
        throw new CapabilityError(
          'apple',
          "Cannot determine file type. Pass opts.fileType explicitly ('ipa')."
          + ' Hint: use a File object with a .ipa extension.',
          false,
        );
      }

      if (fileType === 'apk' || fileType === 'aab') {
        throw new CapabilityError(
          'apple',
          `${fileType.toUpperCase()} files are an Android-only format. Upload an IPA for Apple App Store Connect.`,
          false,
        );
      }

      if (opts.channel === 'internal-sharing') {
        throw new CapabilityError(
          'apple',
          'Internal App Sharing is a Google Play\u2013only feature. Use TestFlight beta groups for internal distribution on iOS.',
          false,
        );
      }

      // IPA → App Store Connect via Build Uploads REST API (API 4.1+)
      if (!opts.version || !opts.buildNumber) {
        throw new CapabilityError(
          'apple',
          'Apple IPA uploads require opts.version (CFBundleShortVersionString) and opts.buildNumber (CFBundleVersion).',
          false,
        );
      }

      const platform = opts.applePlatform ?? 'IOS';
      const uploadedAt = new Date();

      // Step 1: Create build upload reservation
      const buildUploadRes = await ctx.appleRequest<{ data: { id: string; attributes: Record<string, unknown> } }>(
        tokens,
        '/buildUploads',
        {
          method: 'POST',
          body: JSON.stringify({
            data: {
              type: 'buildUploads',
              attributes: {
                cfBundleShortVersionString: opts.version,
                cfBundleVersion: opts.buildNumber,
                platform,
              },
              relationships: {
                app: { data: { type: 'apps', id: appId } },
              },
            },
          }),
        },
      );
      const buildUploadId = buildUploadRes.data.id;

      // Step 2: Reserve a build upload file (gets uploadOperations)
      const binaryBuf = Buffer.from(await file.arrayBuffer());
      const fileName = ((file as File).name) || `${appId}.ipa`;

      const fileReserveRes = await ctx.appleRequest<{
        data: {
          id: string;
          attributes: {
            uploadOperations?: Array<{
              method: string;
              url: string;
              offset: number;
              length: number;
              requestHeaders: Array<{ name: string; value: string }>;
            }>;
          };
        };
      }>(tokens, '/buildUploadFiles', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'buildUploadFiles',
            attributes: {
              fileName,
              fileSize: binaryBuf.length,
              uti: 'com.apple.ipa',
              assetType: 'ASSET',
            },
            relationships: {
              buildUpload: { data: { type: 'buildUploads', id: buildUploadId } },
            },
          },
        }),
      });
      const buildUploadFileId = fileReserveRes.data.id;
      const uploadOps = fileReserveRes.data.attributes.uploadOperations ?? [];

      // Step 3: Upload binary parts
      await Promise.all(
        uploadOps.map(async (op) => {
          const chunk = binaryBuf.subarray(op.offset, op.offset + op.length);
          const headers: Record<string, string> = {};
          for (const h of op.requestHeaders) headers[h.name] = h.value;

          const partRes = await fetch(op.url, {
            method: op.method,
            headers,
            body: chunk,
          });
          if (!partRes.ok) {
            throw new CapabilityError(
              'apple',
              `Upload part failed (offset ${op.offset}): ${partRes.status} ${await partRes.text()}`,
              partRes.status === 429,
            );
          }
        }),
      );

      // Step 4: Commit — provide MD5 checksum of the full file
      const md5Hash = createHash('md5').update(binaryBuf).digest('hex');

      await ctx.appleRequest(tokens, `/buildUploadFiles/${buildUploadFileId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          data: {
            type: 'buildUploadFiles',
            id: buildUploadFileId,
            attributes: {
              uploaded: true,
              sourceFileChecksums: {
                file: { algorithm: 'MD5', hash: md5Hash },
              },
            },
          },
        }),
      });

      // Step 5: Poll buildUpload until state is COMPLETE, PROCESSING, or FAILED
      type BuildUploadState = 'AWAITING_UPLOAD' | 'PROCESSING' | 'COMPLETE' | 'FAILED';
      let uploadState: BuildUploadState = 'AWAITING_UPLOAD';

      for (let attempt = 0; attempt < 10; attempt++) {
        if (attempt > 0) await new Promise<void>(r => setTimeout(r, 5_000));
        const statusRes = await ctx.appleRequest<{
          data: { attributes: { state?: { state?: string } } };
        }>(tokens, `/buildUploads/${buildUploadId}`).catch(() => null);

        const s = statusRes?.data?.attributes?.state?.state as BuildUploadState | undefined;
        if (s) uploadState = s;
        if (uploadState === 'COMPLETE' || uploadState === 'FAILED') break;
      }

      if (uploadState === 'FAILED') {
        throw new CapabilityError('apple', `Build upload ${buildUploadId} failed during processing.`, false);
      }

      // Step 6: Fetch the resulting build record
      let build: StoreBuild | null = null;
      for (let attempt = 0; attempt < 6; attempt++) {
        if (attempt > 0) await new Promise<void>(r => setTimeout(r, 4_000));
        const buildsData = await ctx.appleRequest(
          tokens,
          `/builds?filter[app]=${appId}&sort=-uploadedDate&limit=1`,
        ).catch(() => ({ data: [] }));
        const raw = buildsData.data?.[0];
        if (raw) {
          build = mapAppleBuild(raw);
          break;
        }
      }

      if (!build) {
        build = {
          id: buildUploadId,
          appId,
          version: opts.version,
          buildNumber: opts.buildNumber,
          platform: 'ios',
          status: 'processing',
          uploadedAt,
          hasArtifacts: false,
          buildType: 'ipa',
        };
      }

      return { channel: 'store', fileType: 'ipa', build };
    },
  };
}
