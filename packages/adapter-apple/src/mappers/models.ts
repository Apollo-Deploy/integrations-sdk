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
} from "@apollo-deploy/integrations";
import type { AppleApiResource, AppleApiListResponse } from "../types.js";

export function mapAppleApp(raw: AppleApiResource): StoreApp {
  return {
    id: raw.id,
    name: raw.attributes.name,
    bundleId: raw.attributes.bundleId,
    platform: "ios",
    status: raw.attributes.appStoreState ?? "unknown",
    storeUrl: `https://apps.apple.com/app/id${raw.id}`,
    primaryLocale: raw.attributes.primaryLocale,
    categories:
      raw.attributes.primaryCategory != null
        ? [raw.attributes.primaryCategory]
        : undefined,
  };
}

export function mapAppleBuild(raw: AppleApiResource): StoreBuild {
  const appRelData = raw.relationships?.app?.data;
  const appId = Array.isArray(appRelData)
    ? (appRelData[0]?.id ?? "")
    : (appRelData?.id ?? "");
  return {
    id: raw.id,
    appId,
    version: raw.attributes.version,
    buildNumber: raw.attributes.version ?? raw.id,
    platform: "ios",
    status: mapBuildStatus(String(raw.attributes.processingState ?? "")),
    uploadedAt: new Date(String(raw.attributes.uploadedDate ?? Date.now())),
    expiresAt:
      raw.attributes.expirationDate != null
        ? new Date(String(raw.attributes.expirationDate))
        : undefined,
    size: raw.attributes.size,
    minOsVersion: raw.attributes.minOsVersion,
    buildType: "ipa",
    hasArtifacts: true,
  };
}

function mapBuildStatus(state: string): StoreBuild["status"] {
  switch (state) {
    case "PROCESSING":
      return "processing";
    case "VALID":
      return "valid";
    case "INVALID":
    case "FAILED":
      return "invalid";
    case "EXPIRED":
      return "expired";
    default:
      return "processing";
  }
}

export function mapAppleRelease(raw: AppleApiResource): StoreRelease {
  const appRelData = raw.relationships?.app?.data;
  const appId = Array.isArray(appRelData)
    ? (appRelData[0]?.id ?? "")
    : (appRelData?.id ?? "");
  return {
    id: raw.id,
    appId,
    version: raw.attributes.versionString,
    status: mapReleaseStatus(String(raw.attributes.appStoreState ?? "")),
    track: "app_store",
    releaseNotes: undefined,
    createdAt: new Date(String(raw.attributes.createdDate ?? Date.now())),
    updatedAt: new Date(String(raw.attributes.createdDate ?? Date.now())),
  };
}

function mapReleaseStatus(state: string): StoreRelease["status"] {
  switch (state) {
    case "PREPARE_FOR_SUBMISSION":
      return "draft";
    case "WAITING_FOR_REVIEW":
    case "IN_REVIEW":
      return "in_review";
    case "PENDING_DEVELOPER_RELEASE":
      return "pending_release";
    case "READY_FOR_SALE":
      return "completed";
    case "REJECTED":
      return "rejected";
    default:
      return "draft";
  }
}

export function mapAppleVersion(raw: AppleApiResource): StoreVersion {
  const appRelData = raw.relationships?.app?.data;
  const appId = Array.isArray(appRelData)
    ? (appRelData[0]?.id ?? "")
    : (appRelData?.id ?? "");
  return {
    id: raw.id,
    appId,
    versionString: raw.attributes.versionString,
    state: raw.attributes.appStoreState,
    platform: "ios",
    createdAt: new Date(String(raw.attributes.createdDate ?? Date.now())),
  };
}

export function mapAppleReview(
  raw: AppleApiResource,
  response?: AppleApiResource,
): StoreReview {
  const reply: StoreReviewReply | undefined =
    response != null
      ? {
          body: String(response.attributes.responseBody ?? ""),
          updatedAt: new Date(
            String(response.attributes.lastModifiedDate ?? Date.now()),
          ),
        }
      : undefined;

  return {
    id: raw.id,
    appId: "",
    author: String(raw.attributes.reviewerNickname ?? "Anonymous"),
    rating: raw.attributes.rating,
    title: raw.attributes.title,
    body: raw.attributes.body,
    language: String(raw.attributes.territory ?? "en"),
    territory: raw.attributes.territory,
    appVersion: raw.attributes.version,
    reply,
    createdAt: new Date(String(raw.attributes.createdDate ?? Date.now())),
    updatedAt: new Date(String(raw.attributes.createdDate ?? Date.now())),
  };
}

export function mapAppleBetaGroup(raw: AppleApiResource): BetaGroup {
  const appRelData = raw.relationships?.app?.data;
  const appId = Array.isArray(appRelData)
    ? (appRelData[0]?.id ?? "")
    : (appRelData?.id ?? "");
  return {
    id: raw.id,
    name: raw.attributes.name,
    appId,
    isInternal: raw.attributes.isInternalGroup ?? false,
    testerCount: raw.attributes.testerCount ?? 0,
    testerLimit: raw.attributes.publicLinkLimit,
    publicLinkEnabled: raw.attributes.publicLinkEnabled ?? false,
    publicLink: raw.attributes.publicLink,
    createdAt:
      raw.attributes.createdDate != null
        ? new Date(String(raw.attributes.createdDate))
        : undefined,
  };
}

export function mapAppleBetaTester(raw: AppleApiResource): BetaTester {
  return {
    id: raw.id,
    email: raw.attributes.email,
    firstName: raw.attributes.firstName,
    lastName: raw.attributes.lastName,
    status: mapTesterStatus(
      String(raw.attributes.inviteType ?? ""),
      String(raw.attributes.state ?? ""),
    ),
    sessionCount: raw.attributes.sessionCount,
    crashCount: raw.attributes.crashCount,
    installedVersion: raw.attributes.latestInstalledVersion,
    installedBuildNumber: raw.attributes.latestInstalledBuildVersion,
    lastActivityAt:
      raw.attributes.lastActivityDate != null
        ? new Date(String(raw.attributes.lastActivityDate))
        : undefined,
  };
}

function mapTesterStatus(
  _inviteType: string,
  state: string,
): BetaTester["status"] {
  switch (state) {
    case "ACCEPTED":
    case "INSTALLED":
      return "accepted";
    case "EXPIRED":
      return "expired";
    case "NOT_INVITED":
      return "not_invited";
    default:
      return "pending";
  }
}

export function mapAppleArtifact(
  buildId: string,
  raw: AppleApiResource,
  type: StoreArtifactType,
): StoreArtifact {
  return {
    id: raw.id,
    buildId,
    appId: "",
    type,
    fileName:
      raw.attributes.fileName != null
        ? String(raw.attributes.fileName)
        : `${type}-${raw.id}`,
    size: raw.attributes.fileSize,
    downloadable: raw.attributes.downloadUrl != null,
    createdAt: new Date(),
  };
}

export function mapAppleCrashCluster(
  appId: string,
  raw: AppleApiResource,
): CrashCluster {
  return {
    id: raw.id,
    appId,
    platform: "ios",
    title: String(raw.attributes.signature ?? "Unknown Crash"),
    exceptionType: String(raw.attributes.diagnosticType ?? "CRASH"),
    affectedUsers: Number(raw.attributes.weight ?? 0),
    eventCount: Number(raw.attributes.weight ?? 0),
    affectedVersions: [],
    lastOccurrence: new Date(),
    resolved: false,
  };
}

export function mapAppleVitalsMetric(
  appId: string,
  metric: VitalMetricType,
  data: AppleApiListResponse,
): VitalMetric {
  return {
    metric,
    appId,
    platform: "ios",
    dataPoints: data.data.map((d: AppleApiResource) => ({
      timestamp: new Date(String(d.attributes.measurementDate ?? Date.now())),
      value: Number(d.attributes.value ?? 0),
    })),
  };
}
