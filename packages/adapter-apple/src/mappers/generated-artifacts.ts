import type {
  BuildDeliverable,
} from '@apollo-deploy/integrations';

/**
 * Map an Apple buildBundle resource to a list of BuildDeliverables.
 *
 * Build bundles contain:
 * - App thinning size info (variant device models with sizes)
 * - dSYMs
 * - Bitcode compilation logs (if applicable)
 */
export function mapAppleBuildBundleToDeliverables(
  buildId: string,
  bundle: Record<string, any>,
): BuildDeliverable[] {
  const deliverables: BuildDeliverable[] = [];
  const attrs = bundle.attributes ?? {};

  // App thinning size info — each entry is a device variant
  const fileSizes = attrs.bundleFileSizes ?? [];
  for (const entry of fileSizes) {
    const sizeAttrs = entry.attributes ?? entry;
    deliverables.push({
      id: entry.id ?? `${bundle.id}:variant:${sizeAttrs.deviceModel ?? 'universal'}`,
      buildId,
      type: 'app_thinning_variant',
      variant: sizeAttrs.deviceModel ?? 'universal',
      compressedSize: sizeAttrs.downloadBytes ? Number(sizeAttrs.downloadBytes) : undefined,
      uncompressedSize: sizeAttrs.installBytes ? Number(sizeAttrs.installBytes) : undefined,
      downloadable: !!sizeAttrs.downloadUrl,
      downloadUrl: sizeAttrs.downloadUrl,
    });
  }

  // dSYMs are listed as sub-resources
  if (attrs.hasDsyms || attrs.dSYMUrl) {
    deliverables.push({
      id: `${bundle.id}:dsym`,
      buildId,
      type: 'dsym',
      variant: undefined,
      downloadable: !!attrs.dSYMUrl,
      downloadUrl: attrs.dSYMUrl,
    });
  }

  // Bitcode symbol maps
  if (attrs.hasBitcode) {
    deliverables.push({
      id: `${bundle.id}:bitcode`,
      buildId,
      type: 'bitcode_compilation_log',
      variant: undefined,
      downloadable: false,
    });
  }

  // If bundle has includesSymbols but no explicit dSYM URL, still note it
  if (attrs.includesSymbols && !attrs.dSYMUrl && !attrs.hasDsyms) {
    deliverables.push({
      id: `${bundle.id}:symbols`,
      buildId,
      type: 'dsym',
      variant: 'embedded',
      downloadable: false,
    });
  }

  return deliverables;
}

/**
 * Map an Apple buildBundleFileSize resource to a BuildDeliverable.
 */
export function mapAppleBundleFileSizeToDeliverable(
  buildId: string,
  raw: Record<string, any>,
): BuildDeliverable {
  const attrs = raw.attributes ?? {};
  return {
    id: raw.id,
    buildId,
    type: 'app_thinning_variant',
    variant: attrs.deviceModel ?? 'universal',
    compressedSize: attrs.downloadBytes ? Number(attrs.downloadBytes) : undefined,
    uncompressedSize: attrs.installBytes ? Number(attrs.installBytes) : undefined,
    downloadable: !!attrs.downloadUrl,
    downloadUrl: attrs.downloadUrl,
  };
}
