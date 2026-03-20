import type {
  MonitoringOrganization,
  MonitoringProject,
  MonitoringIssue,
  MonitoringEvent,
  MonitoringRelease,
  MonitoringDeploy,
  MonitoringAlertRule,
  MonitoringAlertIncident,
  MonitoringReplay,
} from "@apollo-deploy/integrations";
import type { SentryDsnKey, SentryDebugFile } from "../types.js";

export function toDate(value: string | number | null | undefined): Date {
  if (value == null || value === 0 || value === "") return new Date(0);
  return new Date(value);
}

export function mapOrg(raw: Record<string, unknown>): MonitoringOrganization {
  return {
    id: String(raw.id),
    slug: String(raw.slug),
    name: String(raw.name),
    dateCreated: toDate(raw.dateCreated as string),
    features: (raw.features as string[] | undefined) ?? [],
    status:
      (raw.status as { id: string } | undefined)?.id === "active"
        ? "active"
        : "active",
  };
}

export function mapProject(raw: Record<string, unknown>): MonitoringProject {
  return {
    id: String(raw.id),
    slug: String(raw.slug),
    name: String(raw.name),
    platform: (raw.platform as string | undefined) ?? "",
    dateCreated: toDate(raw.dateCreated as string),
    firstEvent:
      raw.firstEvent != null ? toDate(raw.firstEvent as string) : undefined,
    hasAccess: Boolean(raw.hasAccess),
    isMember: Boolean(raw.isMember),
    isBookmarked: Boolean(raw.isBookmarked),
    status: (raw.status as string) === "active" ? "active" : "active",
    features: (raw.features as string[] | undefined) ?? [],
    environments: (raw.environments as string[] | undefined) ?? [],
    dsn: (raw.keys as { dsn?: { public?: string } }[] | undefined)?.[0]?.dsn
      ?.public,
  };
}

function mapPriority(raw: string | undefined): MonitoringIssue["priority"] {
  switch (raw) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    case "low":
      return "low";
    default:
      return "medium";
  }
}

export function mapIssue(raw: Record<string, unknown>): MonitoringIssue {
  const proj = raw.project as Record<string, unknown> | undefined;
  const assignee = raw.assignee as Record<string, unknown> | null;
  return {
    id: String(raw.id),
    shortId: String(raw.shortId),
    title: String(raw.title),
    culprit: raw.culprit as string | undefined,
    type: (raw.issueType as string) === "performance" ? "performance" : "error",
    status: raw.status as string as MonitoringIssue["status"],
    priority: mapPriority(raw.priority as string),
    platform: (raw.platform as string | undefined) ?? "",
    project: proj
      ? {
          id: String(proj.id),
          slug: String(proj.slug),
          name: String(proj.name),
        }
      : { id: "", slug: "", name: "" },
    count: (raw.count as string | undefined) ?? "0",
    userCount: Number(raw.userCount ?? 0),
    firstSeen: toDate(raw.firstSeen as string),
    lastSeen: toDate(raw.lastSeen as string),
    isSubscribed: Boolean(raw.isSubscribed),
    isBookmarked: Boolean(raw.isBookmarked),
    isUnhandled: Boolean(raw.isUnhandled),
    assignee: assignee
      ? {
          type: assignee.type === "team" ? "team" : "user",
          id: String(assignee.id),
          name: String(assignee.name),
          email: assignee.email as string | undefined,
        }
      : undefined,
    tags: (
      (raw.tags as { key: string; value: string }[] | undefined) ?? []
    ).map((t) => ({
      key: t.key,
      value: t.value,
    })),
    permalink: (raw.permalink as string | undefined) ?? "",
    metadata: (raw.metadata as Record<string, unknown> | undefined) ?? {},
  };
}

export function mapEvent(raw: Record<string, unknown>): MonitoringEvent {
  const proj = raw.project as Record<string, unknown> | undefined;
  return {
    id: String(raw.id),
    eventId:
      (raw.eventID as string | undefined) ??
      (raw.id as string | undefined) ??
      "",
    message: (raw.message as string | undefined) ?? "",
    title:
      (raw.title as string | undefined) ??
      (raw.message as string | undefined) ??
      "",
    type: (raw.type as MonitoringEvent["type"] | undefined) ?? "default",
    platform: (raw.platform as string | undefined) ?? "",
    timestamp: toDate(raw.dateCreated as string),
    dateCreated: toDate(raw.dateCreated as string),
    project: proj
      ? {
          id: String(proj.id),
          slug: String(proj.slug),
          name: String(proj.name),
        }
      : { id: "", slug: "", name: "" },
    release: raw.release as string | undefined,
    environment: raw.environment as string | undefined,
    tags: ((raw.tags as [string, string][] | undefined) ?? []).map(
      ([key, value]) => ({ key, value }),
    ),
    user: raw.user as MonitoringEvent["user"],
    request: raw.request as MonitoringEvent["request"],
    contexts:
      (raw.contexts as Record<string, Record<string, unknown>> | undefined) ??
      {},
    entries: (raw.entries as MonitoringEvent["entries"] | undefined) ?? [],
    errors: (raw.errors as MonitoringEvent["errors"] | undefined) ?? [],
    sdk: raw.sdk as MonitoringEvent["sdk"],
    groupId: raw.groupID as string | undefined,
  };
}

export function mapRelease(raw: Record<string, unknown>): MonitoringRelease {
  return {
    version: String(raw.version),
    shortVersion:
      (raw.shortVersion as string | undefined) ??
      (raw.version as string | undefined) ??
      "",
    dateCreated: toDate(raw.dateCreated as string),
    dateReleased:
      raw.dateReleased != null ? toDate(raw.dateReleased as string) : undefined,
    firstEvent:
      raw.firstEvent != null ? toDate(raw.firstEvent as string) : undefined,
    lastEvent:
      raw.lastEvent != null ? toDate(raw.lastEvent as string) : undefined,
    newGroups: Number(raw.newGroups ?? 0),
    commitCount: Number(raw.commitCount ?? 0),
    deployCount: Number(raw.deployCount ?? 0),
    adoptionStages: raw.adoptionStages as MonitoringRelease["adoptionStages"],
    projects: (
      (raw.projects as Record<string, unknown>[] | undefined) ?? []
    ).map((p) => ({
      id: String(p.id),
      slug: String(p.slug),
      name: String(p.name),
    })),
    authors: ((raw.authors as Record<string, unknown>[] | undefined) ?? []).map(
      (a) => ({
        name: (a.name as string | undefined) ?? "",
        email: (a.email as string | undefined) ?? "",
      }),
    ),
    lastCommit:
      raw.lastCommit != null
        ? {
            id: String((raw.lastCommit as Record<string, unknown>).id),
            message: (raw.lastCommit as Record<string, unknown>).message as
              | string
              | undefined,
          }
        : undefined,
    versionInfo: raw.versionInfo as MonitoringRelease["versionInfo"],
  };
}

export function mapDeploy(raw: Record<string, unknown>): MonitoringDeploy {
  return {
    id: String(raw.id),
    environment: String(raw.environment),
    dateStarted:
      raw.dateStarted != null ? toDate(raw.dateStarted as string) : undefined,
    dateFinished:
      raw.dateFinished != null ? toDate(raw.dateFinished as string) : undefined,
    url: raw.url as string | undefined,
    name: raw.name as string | undefined,
  };
}

export function mapAlertRule(
  raw: Record<string, unknown>,
): MonitoringAlertRule {
  const proj = raw.projects as Record<string, unknown>[] | undefined;
  return {
    id: String(raw.id),
    name: String(raw.name),
    type: (raw.dataset === "transactions"
      ? "performance"
      : "error") as MonitoringAlertRule["type"],
    status:
      (raw.status as MonitoringAlertRule["status"] | undefined) ?? "resolved",
    environment: raw.environment as string | undefined,
    project: proj?.[0]
      ? {
          id: String(proj[0].id),
          slug: String(proj[0].slug),
          name: String(proj[0].name),
        }
      : { id: "", slug: "", name: "" },
    aggregate: (raw.aggregate as string | undefined) ?? "",
    query: (raw.query as string | undefined) ?? "",
    timeWindow: Number(raw.timeWindow ?? 0),
    threshold: Number(raw.criticalThreshold ?? 0),
    thresholdType: "above",
    triggers: (
      (raw.triggers as Record<string, unknown>[] | undefined) ?? []
    ).map((t) => ({
      id: String(t.id),
      label: t.label as "critical" | "warning",
      alertThreshold: Number(t.alertThreshold),
      resolveThreshold:
        t.resolveThreshold != null ? Number(t.resolveThreshold) : undefined,
      thresholdType: "above" as const,
    })),
    actions: ((raw.actions as Record<string, unknown>[] | undefined) ?? []).map(
      (a) => ({
        id: String(a.id),
        type: a.type as MonitoringAlertRule["actions"][0]["type"],
        targetType:
          a.targetType as MonitoringAlertRule["actions"][0]["targetType"],
        targetIdentifier: a.targetIdentifier as string | undefined,
      }),
    ),
    dateCreated: toDate(raw.dateCreated as string),
    dateModified: toDate(raw.dateModified as string),
    createdBy:
      raw.createdBy != null
        ? {
            type: "user",
            id: String((raw.createdBy as Record<string, unknown>).id),
            name: String((raw.createdBy as Record<string, unknown>).name),
            email: (raw.createdBy as Record<string, unknown>).email as
              | string
              | undefined,
          }
        : undefined,
  };
}

export function mapIncidentStatus(
  status: number,
): MonitoringAlertIncident["status"] {
  if (status === 20) return "resolved";
  if (status === 2) return "warning";
  return "critical";
}

export function mapReplay(raw: Record<string, unknown>): MonitoringReplay {
  return {
    id: String(raw.id),
    replayId:
      (raw.replayId as string | undefined) ??
      (raw.id as string | undefined) ??
      "",
    projectId: (raw.projectId as string | undefined) ?? "",
    environment: raw.environment as string | undefined,
    timestamp: toDate(raw.timestamp as string),
    startedAt: toDate(raw.startedAt as string),
    finishedAt: toDate(raw.finishedAt as string),
    duration: Number(raw.duration ?? 0),
    countUrls: Number(raw.countUrls ?? 0),
    countSegments: Number(raw.countSegments ?? 0),
    countErrors: Number(raw.countErrors ?? 0),
    countDeadClicks: Number(raw.countDeadClicks ?? 0),
    countRageClicks: Number(raw.countRageClicks ?? 0),
    platform: (raw.platform as string | undefined) ?? "",
    sdk: (raw.sdk as MonitoringReplay["sdk"] | undefined) ?? {
      name: "",
      version: "",
    },
    user: (raw.user as MonitoringReplay["user"] | undefined) ?? {},
    tags: (raw.tags as MonitoringReplay["tags"] | undefined) ?? [],
    urls: (raw.urls as string[] | undefined) ?? [],
    releases: (raw.releases as string[] | undefined) ?? [],
    os: raw.os as MonitoringReplay["os"],
    browser: raw.browser as MonitoringReplay["browser"],
    device: raw.device as MonitoringReplay["device"],
    url:
      raw.urls != null
        ? `https://sentry.io/replays/${(raw.replayId as string | undefined) ?? (raw.id as string | undefined) ?? ""}/`
        : undefined,
  };
}

export function mapDsnKey(raw: Record<string, unknown>): SentryDsnKey {
  return {
    id: String(raw.id),
    name: String(raw.name),
    label: String(raw.label ?? raw.name),
    public: String(raw.public),
    secret: String(raw.secret),
    projectId: Number(raw.projectId),
    isActive: Boolean(raw.isActive),
    dsn: raw.dsn as SentryDsnKey["dsn"],
    browserSdkVersion: (raw.browserSdkVersion as string | undefined) ?? "",
    dateCreated: toDate(raw.dateCreated as string),
  };
}

export function mapDebugFile(raw: Record<string, unknown>): SentryDebugFile {
  return {
    id: String(raw.id),
    uuid: String(raw.uuid),
    objectName: String(raw.objectName),
    symbolType: raw.symbolType as SentryDebugFile["symbolType"],
    codeId: raw.codeId as string | undefined,
    debugId: raw.debugId as string | undefined,
    size: Number(raw.size),
    sha1: String(raw.sha1),
    dateCreated: toDate(raw.dateCreated as string),
  };
}
