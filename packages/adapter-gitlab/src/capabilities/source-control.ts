import { CapabilityError } from "@apollo-deploy/integrations";
import type {
  SourceControlCapability,
  TokenSet,
  Repository,
  Branch,
  PullRequest,
  Commit,
  ChangedFile,
  ChangedFilesOpts,
  CodeScanAlert,
  CodeScanAlertsOpts,
  CommitStatus,
  CommitStatusesOpts,
  GetChangedFilesOpts,
} from "@apollo-deploy/integrations";
import type { GitlabAdapterConfig } from "../types.js";

// eslint-disable-next-line max-params -- implements interface; method signature is contractual
async function glFetch(
  base: string,
  token: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const resp = await fetch(`${base}/api/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...((init?.headers as Record<string, string> | undefined) ?? {}),
    },
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new CapabilityError(
      "gitlab",
      `GitLab API ${String(resp.status)}: ${body}`,
      resp.status === 429 || resp.status >= 500,
    );
  }
  return resp;
}

function mapRepo(p: Record<string, unknown>): Repository {
  return {
    id: String(p.id),
    name: p.name as string,
    fullName: p.path_with_namespace as string,
    private: p.visibility === "private",
    defaultBranch: (p.default_branch as string | undefined) ?? "main",
    url: p.web_url as string,
  };
}

export function createGitlabSourceControl(
  config: GitlabAdapterConfig,
): SourceControlCapability {
  const base = config.instanceUrl?.replace(/\/$/, "") ?? "https://gitlab.com";

  return {
    async listRepositories(tokens: TokenSet, _opts?) {
      const resp = await glFetch(
        base,
        tokens.accessToken,
        "/projects?membership=true&per_page=50",
      );
      const items = (await resp.json()) as Record<string, unknown>[];
      return { items: items.map(mapRepo), hasMore: false };
    },

    async getRepository(tokens: TokenSet, repoId: string): Promise<Repository> {
      const encoded = encodeURIComponent(repoId);
      const resp = await glFetch(
        base,
        tokens.accessToken,
        `/projects/${encoded}`,
      );
      return mapRepo((await resp.json()) as Record<string, unknown>);
    },

    async listBranches(tokens: TokenSet, repoId: string, _opts?) {
      const encoded = encodeURIComponent(repoId);
      const resp = await glFetch(
        base,
        tokens.accessToken,
        `/projects/${encoded}/repository/branches?per_page=50`,
      );
      const items = (await resp.json()) as Record<string, unknown>[];
      return {
        items: items.map((b): Branch => {
          const commit2 = b.commit as Record<string, unknown>;
          return {
            name: b.name as string,
            sha: commit2.id as string,
            protected: b.protected as boolean,
          };
        }),
        hasMore: false,
      };
    },

    async getPullRequest(
      tokens: TokenSet,
      repoId: string,
      prNumber: number,
    ): Promise<PullRequest> {
      const encoded = encodeURIComponent(repoId);
      const resp = await glFetch(
        base,
        tokens.accessToken,
        `/projects/${encoded}/merge_requests/${String(prNumber)}`,
      );
      const mr = (await resp.json()) as Record<string, unknown>;
      const author = mr.author as Record<string, unknown> | undefined;
      return {
        id: String(mr.id),
        number: mr.iid as number,
        title: mr.title as string,
        state: mr.state as string,
        author: {
          id: author?.id != null ? String(author.id as number | string) : "",
          name:
            (author?.name as string | undefined) ??
            (author?.username as string | undefined) ??
            "",
          avatarUrl: author?.avatar_url as string | undefined,
        },
        url: mr.web_url as string,
        sourceBranch: mr.source_branch as string,
        targetBranch: mr.target_branch as string,
      };
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async createCommitStatus(
      tokens: TokenSet,
      repoId: string,
      sha: string,
      input,
    ) {
      const encoded = encodeURIComponent(repoId);
      await glFetch(
        base,
        tokens.accessToken,
        `/projects/${encoded}/statuses/${sha}`,
        {
          method: "POST",
          body: JSON.stringify({
            state:
              input.state === "success"
                ? "success"
                : input.state === "failure"
                  ? "failed"
                  : input.state,
            name: input.context,
            description: input.description,
            target_url: input.targetUrl,
          }),
        },
      );
    },

    async listCommits(tokens: TokenSet, repoId: string, _opts?) {
      const encoded = encodeURIComponent(repoId);
      const resp = await glFetch(
        base,
        tokens.accessToken,
        `/projects/${encoded}/repository/commits?per_page=30`,
      );
      const items = (await resp.json()) as Record<string, unknown>[];
      return {
        items: items.map(
          (c): Commit => ({
            sha: c.id as string,
            message: c.message as string,
            author: {
              id: (c.author_email as string | undefined) ?? "",
              name: (c.author_name as string | undefined) ?? "",
            },
            timestamp: new Date(c.authored_date as string),
            url: (c.web_url as string | undefined) ?? "",
          }),
        ),
        hasMore: false,
      };
    },

    // ── Changed Files ────────────────────────────────────────────────────────

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async listPullRequestFiles(
      tokens: TokenSet,
      repoId: string,
      prNumber: number,
      opts?: ChangedFilesOpts,
    ) {
      const encoded = encodeURIComponent(repoId);
      const resp = await glFetch(
        base,
        tokens.accessToken,
        `/projects/${encoded}/merge_requests/${String(prNumber)}/diffs`,
      );
      const diffs = (await resp.json()) as Record<string, unknown>[];

      const stateMap: Record<string, ChangedFile["status"]> = {
        true: "deleted",
        false: "modified",
      };
      const items: ChangedFile[] = diffs
        .map((d): ChangedFile => ({
          filename: (d.new_path as string | undefined) ?? (d.old_path as string | undefined) ?? "",
          status:
            d.new_file === true
              ? "added"
              : d.deleted_file === true
                ? "deleted"
                : d.renamed_file === true
                  ? "renamed"
                  : "modified",
          additions: (d.added_lines as number | undefined) ?? 0,
          deletions: (d.removed_lines as number | undefined) ?? 0,
          changes:
            ((d.added_lines as number | undefined) ?? 0) +
            ((d.removed_lines as number | undefined) ?? 0),
          patch: d.diff as string | undefined,
          previousFilename:
            d.renamed_file === true ? (d.old_path as string | undefined) : undefined,
        }))
        .filter((f) => opts?.path == null || f.filename.startsWith(opts.path));

      void stateMap;
      return { items, hasMore: false };
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async listCommitFiles(
      tokens: TokenSet,
      repoId: string,
      sha: string,
      opts?: ChangedFilesOpts,
    ) {
      const encoded = encodeURIComponent(repoId);
      const resp = await glFetch(
        base,
        tokens.accessToken,
        `/projects/${encoded}/repository/commits/${sha}/diff`,
      );
      const diffs = (await resp.json()) as Record<string, unknown>[];

      const items: ChangedFile[] = diffs
        .map((d): ChangedFile => ({
          filename: (d.new_path as string | undefined) ?? (d.old_path as string | undefined) ?? "",
          status:
            d.new_file === true
              ? "added"
              : d.deleted_file === true
                ? "deleted"
                : d.renamed_file === true
                  ? "renamed"
                  : "modified",
          additions: (d.added_lines as number | undefined) ?? 0,
          deletions: (d.removed_lines as number | undefined) ?? 0,
          changes:
            ((d.added_lines as number | undefined) ?? 0) +
            ((d.removed_lines as number | undefined) ?? 0),
          patch: d.diff as string | undefined,
          previousFilename:
            d.renamed_file === true ? (d.old_path as string | undefined) : undefined,
        }))
        .filter((f) => opts?.path == null || f.filename.startsWith(opts.path));

      return { items, hasMore: false };
    },

    // ── Code Scanning ────────────────────────────────────────────────────────
    // GitLab exposes SAST/secret-detection findings via the Vulnerability Findings
    // API (requires GitLab Ultimate). We surface this clearly so callers can
    // decide how to handle it, rather than silently swallowing the error.

    async listCodeScanAlerts(
      tokens: TokenSet,
      repoId: string,
      opts?: CodeScanAlertsOpts,
    ) {
      const encoded = encodeURIComponent(repoId);
      const stateParam =
        opts?.state === "all" ? "" : `&state=${opts?.state ?? "detected"}`;
      const resp = await glFetch(
        base,
        tokens.accessToken,
        `/projects/${encoded}/vulnerability_findings?per_page=${(opts?.limit ?? 30).toString()}${stateParam}`,
      ).catch((err: unknown) => {
        if (
          err instanceof CapabilityError &&
          err.message.includes("403")
        ) {
          throw new CapabilityError(
            "gitlab",
            "Vulnerability Findings API requires GitLab Ultimate. Code scanning is not available on this plan.",
            false,
          );
        }
        throw err;
      });

      const findings = (await resp.json()) as Record<string, unknown>[];

      const severityMap: Record<string, CodeScanAlert["severity"]> = {
        critical: "critical",
        high: "high",
        medium: "medium",
        low: "low",
        info: "note",
        unknown: "unknown",
      };
      const stateMap: Record<string, CodeScanAlert["state"]> = {
        detected: "open",
        confirmed: "open",
        dismissed: "dismissed",
        resolved: "fixed",
      };

      const items: CodeScanAlert[] = findings.map((f, i): CodeScanAlert => {
        const loc = f.location as Record<string, unknown> | undefined;
        const scanner = f.scanner as Record<string, unknown> | undefined;
        const identifiers = f.identifiers as Record<string, unknown>[] | undefined;
        const topId = identifiers?.[0];
        return {
          id: (f.id as string | undefined) ?? String(i),
          number: i + 1,
          state: stateMap[(f.state as string | undefined) ?? ""] ?? "unknown",
          severity:
            severityMap[(f.severity as string | undefined) ?? ""] ?? "unknown",
          rule: (topId?.external_id as string | undefined) ?? (f.name as string) ?? "",
          description: (f.description as string | undefined) ?? (f.name as string) ?? "",
          tool: (scanner?.name as string | undefined) ?? "GitLab SAST",
          location: {
            path: (loc?.file as string | undefined) ?? "",
            startLine: (loc?.start_line as number | undefined) ?? 0,
            endLine: loc?.end_line as number | undefined,
          },
          url: (f.web_url as string | undefined) ?? "",
          createdAt: new Date(
            (f.created_at as string | undefined) ?? String(Date.now()),
          ),
        };
      });

      const filtered = opts?.state === "all" || opts?.state == null
        ? items
        : items.filter((a) => {
            if (opts.state === "open") return a.state === "open";
            return a.state === opts.state;
          });

      return { items: filtered, hasMore: false };
    },

    async getCodeScanAlert(
      tokens: TokenSet,
      repoId: string,
      alertNumber: number,
    ): Promise<CodeScanAlert> {
      // GitLab's API doesn't expose a single-finding endpoint by numeric index;
      // fetch the list and return the matching entry.
      const page = await this.listCodeScanAlerts(tokens, repoId, {
        state: "all",
        limit: 100,
      });
      const found = page.items.find((a) => a.number === alertNumber);
      if (found == null) {
        throw new CapabilityError(
          "gitlab",
          `Code scan alert #${String(alertNumber)} not found.`,
          false,
        );
      }
      return found;
    },

    // ── Commit Statuses ──────────────────────────────────────────────────────

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async listCommitStatuses(
      tokens: TokenSet,
      repoId: string,
      sha: string,
      opts?: CommitStatusesOpts,
    ) {
      const encoded = encodeURIComponent(repoId);
      const resp = await glFetch(
        base,
        tokens.accessToken,
        `/projects/${encoded}/repository/commits/${sha}/statuses?per_page=${String(opts?.limit ?? 30)}`,
      );
      const statuses = (await resp.json()) as Record<string, unknown>[];

      const stateMap: Record<string, CommitStatus["state"]> = {
        pending: "pending",
        running: "pending",
        success: "success",
        failed: "failure",
        canceled: "error",
      };
      const author = (s: Record<string, unknown>): { id: string; name: string; avatarUrl?: string } | undefined => {
        const a = s.author as Record<string, unknown> | undefined;
        return a != null
          ? {
              id: String(a.id),
              name: (a.name as string | undefined) ?? (a.username as string | undefined) ?? "",
              avatarUrl: a.avatar_url as string | undefined,
            }
          : undefined;
      };

      const items: CommitStatus[] = statuses
        .map((s): CommitStatus => ({
          id: String(s.id),
          state: stateMap[(s.status as string | undefined) ?? ""] ?? "unknown",
          context: (s.name as string | undefined) ?? "",
          description: s.description as string | undefined,
          targetUrl: s.target_url as string | undefined,
          createdAt: new Date(
            (s.created_at as string | undefined) ?? String(Date.now()),
          ),
          creator: author(s),
        }))
        .filter((s) => opts?.context == null || s.context === opts.context);

      return { items, hasMore: false };
    },

    // ── Release Window Comparison ────────────────────────────────────────────

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async getChangedFiles(
      tokens: TokenSet,
      repoId: string,
      baseRef: string,
      headRef: string,
      opts?: GetChangedFilesOpts,
    ): Promise<ChangedFile[]> {
      const encoded = encodeURIComponent(repoId);
      const resp = await glFetch(
        base,
        tokens.accessToken,
        `/projects/${encoded}/repository/compare?from=${encodeURIComponent(baseRef)}&to=${encodeURIComponent(headRef)}`,
      );
      const data = (await resp.json()) as Record<string, unknown>;
      const diffs = (data.diffs as Record<string, unknown>[]) ?? [];
      return diffs
        .map((d): ChangedFile => ({
          filename: d.new_path as string,
          status: d.renamed_file ? "renamed" : d.deleted_file ? "deleted" : d.new_file ? "added" : "modified",
          additions: (d.added_lines as number | undefined) ?? 0,
          deletions: (d.removed_lines as number | undefined) ?? 0,
          changes: ((d.added_lines as number | undefined) ?? 0) + ((d.removed_lines as number | undefined) ?? 0),
          patch: opts?.includeDiffs ? (d.diff as string | undefined) : undefined,
          previousFilename: d.renamed_file ? (d.old_path as string) : undefined,
        }))
        .filter((f) => opts?.path == null || f.filename.startsWith(opts.path));
    },
  };
}
