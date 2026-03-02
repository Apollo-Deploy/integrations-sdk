import type {
  StoreApp,
  StoreBuild,
  StoreRelease,
  StoreVersion,
  StoreReview,
  StoreReviewReply,
  BetaGroup,
  BetaTester,
  StoreArtifact,
  StoreArtifactType,
  CrashCluster,
  VitalMetric,
  VitalMetricType,
} from '@apollo-deploy/integrations';

export function mapAppleApp(raw: Record<string, any>): StoreApp {
  return {
    id: raw.id,
    name: raw.attributes.name,
    bundleId: raw.attributes.bundleId,
    platform: 'ios',
    status: raw.attributes.appStoreState ?? 'unknown',
    storeUrl: `https://apps.apple.com/app/id${raw.id}`,
    primaryLocale: raw.attributes.primaryLocale,
    categories: raw.attributes.primaryCategory ? [raw.attributes.primaryCategory] : undefined,
  };
}

export function mapAppleBuild(raw: Record<string, any>): StoreBuild {
  return {
    id: raw.id,
    appId: raw.relationships?.app?.data?.id ?? '',
    version: raw.attributes.version,
    buildNumber: raw.attributes.version ?? raw.id,
    platform: 'ios',
    status: mapBuildStatus(raw.attributes.processingState),
    uploadedAt: new Date(raw.attributes.uploadedDate),
    expiresAt: raw.attributes.expirationDate
      ? new Date(raw.attributes.expirationDate)
      : undefined,
    size: raw.attributes.size,
    minOsVersion: raw.attributes.minOsVersion,
    buildType: 'ipa',
    hasArtifacts: true, // Apple builds always have at least dSYMs pending
  };
}

function mapBuildStatus(state: string): StoreBuild['status'] {
  switch (state) {
    case 'PROCESSING': return 'processing';
    case 'VALID': return 'valid';
    case 'INVALID':
    case 'FAILED': return 'invalid';
    case 'EXPIRED': return 'expired';
    default: return 'processing';
  }
}

export function mapAppleRelease(raw: Record<string, any>): StoreRelease {
  return {
    id: raw.id,
    appId: raw.relationships?.app?.data?.id ?? '',
    version: raw.attributes.versionString,
    status: mapReleaseStatus(raw.attributes.appStoreState),
    track: 'app_store',
    releaseNotes: undefined, // Requires separate localization fetch
    createdAt: new Date(raw.attributes.createdDate),
    updatedAt: new Date(raw.attributes.createdDate),
  };
}

function mapReleaseStatus(state: string): StoreRelease['status'] {
  switch (state) {
    case 'PREPARE_FOR_SUBMISSION': return 'draft';
    case 'WAITING_FOR_REVIEW':
    case 'IN_REVIEW': return 'in_review';
    case 'PENDING_DEVELOPER_RELEASE': return 'pending_release';
    case 'READY_FOR_SALE': return 'completed';
    case 'REJECTED': return 'rejected';
    default: return 'draft';
  }
}

export function mapAppleVersion(raw: Record<string, any>): StoreVersion {
  return {
    id: raw.id,
    appId: raw.relationships?.app?.data?.id ?? '',
    versionString: raw.attributes.versionString,
    state: raw.attributes.appStoreState,
    platform: 'ios',
    createdAt: new Date(raw.attributes.createdDate),
  };
}

export function mapAppleReview(raw: Record<string, any>, response?: Record<string, any>): StoreReview {
  const reply: StoreReviewReply | undefined = response
    ? {
        body: response.attributes?.responseBody ?? '',
        updatedAt: new Date(response.attributes?.lastModifiedDate ?? Date.now()),
      }
    : undefined;

  return {
    id: raw.id,
    appId: '', // Resolved from parent context
    author: raw.attributes.reviewerNickname ?? 'Anonymous',
    rating: raw.attributes.rating,
    title: raw.attributes.title,
    body: raw.attributes.body,
    language: raw.attributes.territory ?? 'en',
    territory: raw.attributes.territory,
    appVersion: raw.attributes.version,
    reply,
    createdAt: new Date(raw.attributes.createdDate),
    updatedAt: new Date(raw.attributes.createdDate),
  };
}

export function mapAppleBetaGroup(raw: Record<string, any>): BetaGroup {
  return {
    id: raw.id,
    name: raw.attributes.name,
    appId: raw.relationships?.app?.data?.id ?? '',
    isInternal: raw.attributes.isInternalGroup ?? false,
    testerCount: raw.attributes.testerCount ?? 0,
    testerLimit: raw.attributes.publicLinkLimit,
    publicLinkEnabled: raw.attributes.publicLinkEnabled ?? false,
    publicLink: raw.attributes.publicLink,
    createdAt: raw.attributes.createdDate
      ? new Date(raw.attributes.createdDate)
      : undefined,
  };
}

export function mapAppleBetaTester(raw: Record<string, any>): BetaTester {
  return {
    id: raw.id,
    email: raw.attributes.email,
    firstName: raw.attributes.firstName,
    lastName: raw.attributes.lastName,
    status: mapTesterStatus(raw.attributes.inviteType, raw.attributes.state),
    sessionCount: raw.attributes.sessionCount,
    crashCount: raw.attributes.crashCount,
    installedVersion: raw.attributes.latestInstalledVersion,
    installedBuildNumber: raw.attributes.latestInstalledBuildVersion,
    lastActivityAt: raw.attributes.lastActivityDate
      ? new Date(raw.attributes.lastActivityDate)
      : undefined,
  };
}

function mapTesterStatus(
  _inviteType: string,
  state: string,
): BetaTester['status'] {
  switch (state) {
    case 'ACCEPTED':
    case 'INSTALLED': return 'accepted';
    case 'EXPIRED': return 'expired';
    case 'NOT_INVITED': return 'not_invited';
    default: return 'pending';
  }
}

export function mapAppleArtifact(
  buildId: string,
  raw: Record<string, any>,
  type: StoreArtifactType,
): StoreArtifact {
  return {
    id: raw.id,
    buildId,
    appId: '',
    type,
    fileName: raw.attributes?.fileName ?? `${type}-${raw.id}`,
    size: raw.attributes?.fileSize,
    downloadable: !!raw.attributes?.downloadUrl,
    createdAt: new Date(),
  };
}

export function mapAppleCrashCluster(appId: string, raw: Record<string, any>): CrashCluster {
  return {
    id: raw.id,
    appId,
    platform: 'ios',
    title: raw.attributes?.signature ?? 'Unknown Crash',
    exceptionType: raw.attributes?.diagnosticType ?? 'CRASH',
    affectedUsers: raw.attributes?.weight ?? 0,
    eventCount: raw.attributes?.weight ?? 0,
    affectedVersions: [],
    lastOccurrence: new Date(),
    resolved: false,
  };
}

export function mapAppleVitalsMetric(
  appId: string,
  metric: VitalMetricType,
  data: Record<string, any>,
): VitalMetric {
  return {
    metric,
    appId,
    platform: 'ios',
    dataPoints: (data?.data ?? []).map((d: any) => ({
      timestamp: new Date(d.attributes?.measurementDate ?? Date.now()),
      value: d.attributes?.value ?? 0,
    })),
  };
}
