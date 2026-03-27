import type {
  StoreApp,
  StoreBuild,
  StoreRelease,
  LocalizedText,
  StoreVersion,
  StoreReview,
  StoreReviewReply,
  BetaGroup,
  BetaTester,
  StoreArtifact,
  StoreArtifactType,
  StoreTrack,
  TrackRelease,
  TrackType,
  CrashCluster,
  AnrCluster,
  VitalMetric,
  VitalMetricType,
  VitalDataPoint,
  RatingSummary,
} from "@apollo-deploy/integrations";

export function mapGoogleApp(
  packageName: string,
  _raw: Record<string, any>,
): StoreApp {
  return {
    id: packageName,
    name: packageName, // Google Play API doesn't return app name directly here
    bundleId: packageName,
    platform: "android",
    status: "unknown",
    storeUrl: `https://play.google.com/store/apps/details?id=${packageName}`,
  };
}

export function mapGoogleBuild(
  packageName: string,
  raw: Record<string, any>,
  type: "bundle" | "apk",
): StoreBuild {
  const versionCode = raw.versionCode as number | undefined;
  return {
    id: String(versionCode ?? ""),
    appId: packageName,
    version: (raw.versionName as string) ?? "",
    buildNumber: String(versionCode ?? ""),
    platform: "android",
    status: "valid", // Only uploaded (valid) builds appear in edits
    uploadedAt: new Date(),
    size: raw.binary?.size as number | undefined,
    buildType: type === "bundle" ? "aab" : "apk",
    hasArtifacts: true,
  };
}

export function mapGoogleRelease(
  packageName: string,
  track: string,
  raw: Record<string, any>,
): StoreRelease {
  const versionCodes = raw.versionCodes as string[] | undefined;
  const primaryCode = versionCodes?.[0] ?? "";

  const releaseNotes: LocalizedText[] | undefined = (
    raw.releaseNotes as { language?: string; text: string }[] | undefined
  )?.map((n) => ({
    language: n.language ?? "en",
    text: n.text,
  }));

  return {
    id: `${track}:${primaryCode}`,
    appId: packageName,
    version: (raw.name as string) ?? primaryCode,
    status: mapGoogleReleaseStatus(raw.status as string),
    track,
    rolloutPercentage:
      raw.userFraction != null
        ? Math.round((raw.userFraction as number) * 100)
        : undefined,
    releaseNotes: releaseNotes?.length ? releaseNotes : undefined,
    versionCodes,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function mapGoogleReleaseStatus(status: string): StoreRelease["status"] {
  switch (status) {
    case "draft":
      return "draft";
    case "inProgress":
      return "rolling_out";
    case "halted":
      return "halted";
    case "completed":
      return "completed";
    default:
      return "draft";
  }
}

export function mapGoogleTrack(
  packageName: string,
  raw: Record<string, any>,
): StoreTrack {
  const trackName: string = raw.track ?? "production";
  const type: TrackType =
    trackName === "production"
      ? "production"
      : trackName === "internal"
        ? "internal"
        : trackName === "alpha"
          ? "alpha"
          : "beta";

  const releases: TrackRelease[] = (raw.releases ?? []).map(
    (r: Record<string, any>) => ({
      version: r.name ?? "",
      status: mapGoogleReleaseStatus(r.status),
      versionCodes: (r.versionCodes as string[] | undefined) ?? [],
      rolloutPercentage:
        r.userFraction != null ? (r.userFraction as number) * 100 : undefined,
    }),
  );

  return {
    id: `${packageName}:${trackName}`,
    appId: packageName,
    name: trackName,
    type,
    releases,
  };
}

export function mapGoogleVersion(
  packageName: string,
  track: string,
  raw: Record<string, any>,
): StoreVersion {
  const release = mapGoogleRelease(packageName, track, raw);
  return {
    id: release.id,
    appId: packageName,
    versionString: release.version,
    state: release.status,
    platform: "android",
    createdAt: release.createdAt,
  };
}

export function mapGoogleReview(raw: Record<string, any>, packageName = ""): StoreReview {
  const comment = raw.comments?.[0]?.userComment;
  const devComment: string | undefined =
    raw.comments?.[1]?.developerComment?.text;

  const reply: StoreReviewReply | undefined = devComment
    ? {
        body: devComment,
        updatedAt: new Date(
          Number(
            raw.comments?.[1]?.developerComment?.lastModified?.seconds ?? 0,
          ) * 1000,
        ),
      }
    : undefined;

  return {
    id: raw.reviewId,
    appId: packageName,
    author: raw.authorName ?? "Anonymous",
    rating: comment?.starRating ?? 0,
    title: undefined,
    body: comment?.text ?? "",
    language: comment?.reviewerLanguage ?? "en",
    appVersion: comment?.appVersionName ?? (comment?.appVersionCode != null ? String(comment.appVersionCode) : undefined),
    reply,
    createdAt: new Date(Number(comment?.lastModified?.seconds ?? 0) * 1000),
    updatedAt: new Date(Number(comment?.lastModified?.seconds ?? 0) * 1000),
  };
}

export function mapGoogleBetaGroup(
  packageName: string,
  track: string,
): BetaGroup {
  const isInternal = track === "internal";
  const names: Record<string, string> = {
    internal: "Internal Testing",
    alpha: "Closed Testing",
    beta: "Open Testing",
  };
  return {
    id: `${packageName}:${track}`,
    name: names[track] ?? track,
    appId: packageName,
    isInternal,
    testerCount: 0,
  };
}

export function mapGoogleBetaTester(email: string): BetaTester {
  return {
    id: email,
    email,
    status: "accepted",
  };
}

// eslint-disable-next-line max-params -- required parameters for this utility function
export function mapGoogleArtifact(
  packageName: string,
  buildId: string,
  raw: Record<string, any>,
  type: StoreArtifactType,
): StoreArtifact {
  return {
    id: `${buildId}:${type}`,
    buildId,
    appId: packageName,
    type,
    fileName: `${type}-${buildId}`,
    size: raw.binary?.size as number | undefined,
    downloadable: false, // Google Play does not provide download URLs via API
    createdAt: new Date(),
  };
}

export function mapGoogleRatingSummary(
  packageName: string,
  raw: Record<string, any>,
): RatingSummary {
  const buckets = raw.ratingCountPerStar as Record<string, string> | undefined;
  return {
    appId: packageName,
    averageRating: parseFloat((raw.averageRating as string) ?? "0"),
    totalRatings: Object.values(buckets ?? {}).reduce(
      (s, v) => s + parseInt(v, 10),
      0,
    ),
    histogram: {
      oneStar: parseInt(buckets?.ONE ?? "0", 10),
      twoStar: parseInt(buckets?.TWO ?? "0", 10),
      threeStar: parseInt(buckets?.THREE ?? "0", 10),
      fourStar: parseInt(buckets?.FOUR ?? "0", 10),
      fiveStar: parseInt(buckets?.FIVE ?? "0", 10),
    },
  };
}

export function mapGoogleVitalMetric(
  appId: string,
  metric: VitalMetricType,
  data: Record<string, any>,
): VitalMetric {
  const dataPoints: VitalDataPoint[] = (data?.rows ?? []).map(
    (row: Record<string, any>) => {
      const dateStr: string | undefined = row.startTime?.date
        ? `${row.startTime.date.year}-${String(row.startTime.date.month).padStart(2, "0")}-${String(row.startTime.date.day).padStart(2, "0")}`
        : undefined;
      const value = row.metrics?.[0] ?? 0;
      return {
        timestamp: dateStr ? new Date(dateStr) : new Date(),
        value:
          typeof value === "object"
            ? (value.decimalValue?.value ?? 0)
            : Number(value),
      };
    },
  );

  return {
    metric,
    appId,
    platform: "android",
    dataPoints,
  };
}

export function mapGoogleCrashCluster(
  appId: string,
  raw: Record<string, any>,
): CrashCluster {
  return {
    id: raw.name ?? raw.reportId ?? crypto.randomUUID(),
    appId,
    platform: "android",
    title: raw.cause?.description ?? raw.errorReport?.cause ?? "Unknown Crash",
    exceptionType: "CRASH",
    affectedUsers: raw.distinctUsers?.lowerBound
      ? parseInt(raw.distinctUsers.lowerBound, 10)
      : 0,
    eventCount: raw.issueCount ?? 0,
    affectedVersions: (raw.versionCode ?? []).map(String),
    lastOccurrence: raw.lastEventTime
      ? new Date(raw.lastEventTime)
      : new Date(),
    resolved: false,
  };
}

export function mapGoogleAnrCluster(
  appId: string,
  raw: Record<string, any>,
): AnrCluster {
  return {
    id: raw.name ?? raw.reportId ?? crypto.randomUUID(),
    appId,
    title: raw.cause?.description ?? "Unknown ANR",
    affectedUsers: raw.distinctUsers?.lowerBound
      ? parseInt(raw.distinctUsers.lowerBound, 10)
      : 0,
    eventCount: raw.issueCount ?? 0,
    affectedVersions: (raw.versionCode ?? []).map(String),
    lastOccurrence: raw.lastEventTime
      ? new Date(raw.lastEventTime)
      : new Date(),
    resolved: false,
  };
}
