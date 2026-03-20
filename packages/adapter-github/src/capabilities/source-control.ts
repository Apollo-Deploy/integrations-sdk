/**
 * GitHub source-control capability implementation.
 * Uses @octokit/rest as the HTTP client.
 */

import { Octokit } from "@octokit/rest";
import type { SourceControlCapability } from "@apollo-deploy/integrations";
import type {
  TokenSet,
  PaginationOpts,
  CommitListOpts,
  CommitStatusInput,
  ChangedFile,
  ChangedFilesOpts,
  CodeScanAlert,
  CodeScanAlertsOpts,
  CommitStatus,
  CommitStatusesOpts,
} from "@apollo-deploy/integrations";
import { CapabilityError } from "@apollo-deploy/integrations";
import {
  mapRepository,
  mapBranch,
  mapPullRequest,
  mapCommit,
} from "../mappers/models.js";
import { mapGithubError } from "../mappers/errors.js";
import type { GithubAdapterConfig } from "../types.js";

export function createGithubSourceControl(
  _config: GithubAdapterConfig,
): SourceControlCapability {
  function client(tokens: TokenSet): Octokit {
    return new Octokit({ auth: tokens.accessToken });
  }

  function parseRepoId(repoId: string): { owner: string; repo: string } {
    const [owner, repo] = repoId.split("/");
    if (owner === "" || repo === "") {
      throw new Error(
        `Invalid GitHub repoId '${repoId}'. Expected 'owner/repo'.`,
      );
    }
    return { owner, repo };
  }

  function mapChangedFile(f: Record<string, unknown>): ChangedFile {
    const statusMap: Record<string, ChangedFile["status"]> = {
      added: "added",
      modified: "modified",
      removed: "deleted",
      renamed: "renamed",
      copied: "copied",
      unchanged: "unchanged",
    };
    return {
      filename: f.filename as string,
      status: statusMap[f.status as string] ?? "unknown",
      additions: (f.additions as number | undefined) ?? 0,
      deletions: (f.deletions as number | undefined) ?? 0,
      changes: (f.changes as number | undefined) ?? 0,
      patch: f.patch as string | undefined,
      previousFilename: f.previous_filename as string | undefined,
    };
  }

  function mapCodeScanAlert(a: Record<string, unknown>): CodeScanAlert {
    const rule = a.rule as Record<string, unknown> | undefined;
    const tool = a.tool as Record<string, unknown> | undefined;
    const driver = tool?.driver as Record<string, unknown> | undefined;
    const mostRecent = a.most_recent_instance as
      | Record<string, unknown>
      | undefined;
    const loc = mostRecent?.location as Record<string, unknown> | undefined;
    const physLoc = loc?.physical_location as
      | Record<string, unknown>
      | undefined;
    const region = physLoc?.region as Record<string, unknown> | undefined;
    const artLoc = physLoc?.artifact_location as
      | Record<string, unknown>
      | undefined;

    const severityMap: Record<string, CodeScanAlert["severity"]> = {
      critical: "critical",
      high: "high",
      medium: "medium",
      low: "low",
      warning: "warning",
      note: "note",
      error: "error",
    };

    const stateMap: Record<string, CodeScanAlert["state"]> = {
      open: "open",
      dismissed: "dismissed",
      fixed: "fixed",
    };

    const dismissedBy = a.dismissed_by as Record<string, unknown> | undefined;

    return {
      id: String(a.number),
      number: a.number as number,
      state: stateMap[(a.state as string | undefined) ?? ""] ?? "unknown",
      severity:
        severityMap[
          ((rule?.security_severity_level as string | undefined) ??
            (mostRecent?.classification as string | undefined) ??
            "")
        ] ?? "unknown",
      rule: (rule?.id as string | undefined) ?? "",
      description: (rule?.description as string | undefined) ?? "",
      tool:
        (driver?.name as string | undefined) ??
        (tool?.name as string | undefined) ??
        "",
      location: {
        path: (artLoc?.uri as string | undefined) ?? "",
        startLine: (region?.start_line as number | undefined) ?? 0,
        endLine: region?.end_line as number | undefined,
        startColumn: region?.start_column as number | undefined,
        endColumn: region?.end_column as number | undefined,
      },
      url: (a.html_url as string | undefined) ?? "",
      createdAt: new Date(
        (a.created_at as string | undefined) ?? String(Date.now()),
      ),
      dismissedAt:
        a.dismissed_at != null
          ? new Date(a.dismissed_at as string)
          : undefined,
      dismissedBy:
        dismissedBy != null
          ? {
              id: String(dismissedBy.id),
              name: (dismissedBy.login as string | undefined) ?? "",
              avatarUrl: dismissedBy.avatar_url as string | undefined,
            }
          : undefined,
      dismissedReason: a.dismissed_reason as string | undefined,
    };
  }

  function mapCommitStatus(s: Record<string, unknown>): CommitStatus {
    const stateMap: Record<string, CommitStatus["state"]> = {
      pending: "pending",
      success: "success",
      failure: "failure",
      error: "error",
    };
    const creator = s.creator as Record<string, unknown> | undefined;
    return {
      id: String(s.id),
      state: stateMap[(s.state as string | undefined) ?? ""] ?? "unknown",
      context: (s.context as string | undefined) ?? "",
      description: s.description as string | undefined,
      targetUrl: (s.target_url as string | undefined) ?? undefined,
      createdAt: new Date(
        (s.created_at as string | undefined) ?? String(Date.now()),
      ),
      creator:
        creator != null
          ? {
              id: String(creator.id),
              name: (creator.login as string | undefined) ?? "",
              avatarUrl: creator.avatar_url as string | undefined,
            }
          : undefined,
    };
  }

  return {
    async listRepositories(tokens, opts?: PaginationOpts) {
      try {
        const octokit = client(tokens);
        const perPage = opts?.limit ?? 30;
        const page = opts?.cursor != null ? Number(opts.cursor) : 1;

        const { data } = await octokit.rest.repos.listForAuthenticatedUser({
          per_page: perPage,
          page,
          sort: "updated",
        });

        return {
          items: data.map((r) =>
            mapRepository(r as unknown as Record<string, unknown>),
          ),
          hasMore: data.length === perPage,
          cursor: data.length === perPage ? String(page + 1) : undefined,
        };
      } catch (err) {
        throw mapGithubError(err);
      }
    },

    async getRepository(tokens, repoId) {
      try {
        const { owner, repo } = parseRepoId(repoId);
        const octokit = client(tokens);
        const { data } = await octokit.rest.repos.get({ owner, repo });
        return mapRepository(data as unknown as Record<string, unknown>);
      } catch (err) {
        throw mapGithubError(err);
      }
    },

    async listBranches(tokens, repoId, opts?: PaginationOpts) {
      try {
        const { owner, repo } = parseRepoId(repoId);
        const octokit = client(tokens);
        const perPage2 = opts?.limit ?? 30;
        const page2 = opts?.cursor != null ? Number(opts.cursor) : 1;

        const { data } = await octokit.rest.repos.listBranches({
          owner,
          repo,
          per_page: perPage2,
          page: page2,
        });

        return {
          items: data.map((b) =>
            mapBranch(b as unknown as Record<string, unknown>),
          ),
          hasMore: data.length === perPage2,
          cursor: data.length === perPage2 ? String(page2 + 1) : undefined,
        };
      } catch (err) {
        throw mapGithubError(err);
      }
    },

    async getPullRequest(tokens, repoId, prNumber) {
      try {
        const { owner, repo } = parseRepoId(repoId);
        const octokit = client(tokens);
        const { data } = await octokit.rest.pulls.get({
          owner,
          repo,
          pull_number: prNumber,
        });
        return mapPullRequest(data as unknown as Record<string, unknown>);
      } catch (err) {
        throw mapGithubError(err);
      }
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async createCommitStatus(tokens, repoId, sha, status: CommitStatusInput) {
      try {
        const { owner, repo } = parseRepoId(repoId);
        const octokit = client(tokens);
        await octokit.rest.repos.createCommitStatus({
          owner,
          repo,
          sha,
          state: status.state,
          target_url: status.targetUrl,
          description: status.description,
          context: status.context,
        });
      } catch (err) {
        throw mapGithubError(err);
      }
    },

    async listCommits(tokens, repoId, opts?: CommitListOpts) {
      try {
        const { owner, repo } = parseRepoId(repoId);
        const octokit = client(tokens);
        const perPage3 = opts?.limit ?? 30;
        const page3 = opts?.cursor != null ? Number(opts.cursor) : 1;

        const { data } = await octokit.rest.repos.listCommits({
          owner,
          repo,
          sha: opts?.branch,
          since: opts?.since?.toISOString(),
          until: opts?.until?.toISOString(),
          per_page: perPage3,
          page: page3,
        });

        return {
          items: data.map((c) =>
            mapCommit(c as unknown as Record<string, unknown>),
          ),
          hasMore: data.length === perPage3,
          cursor: data.length === perPage3 ? String(page3 + 1) : undefined,
        };
      } catch (err) {
        throw mapGithubError(err);
      }
    },

    // ── Changed Files ────────────────────────────────────────────────────────

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async listPullRequestFiles(tokens, repoId, prNumber, opts?: ChangedFilesOpts) {
      try {
        const { owner, repo } = parseRepoId(repoId);
        const octokit = client(tokens);
        const perPage = opts?.limit ?? 100;
        const page = opts?.cursor != null ? Number(opts.cursor) : 1;

        const { data } = await octokit.rest.pulls.listFiles({
          owner,
          repo,
          pull_number: prNumber,
          per_page: perPage,
          page,
        });

        const items = data
          .map((f) => mapChangedFile(f as unknown as Record<string, unknown>))
          .filter((f) => opts?.path == null || f.filename.startsWith(opts.path));

        return {
          items,
          hasMore: data.length === perPage,
          cursor: data.length === perPage ? String(page + 1) : undefined,
        };
      } catch (err) {
        throw mapGithubError(err);
      }
    },

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async listCommitFiles(tokens, repoId, sha, opts?: ChangedFilesOpts) {
      try {
        const { owner, repo } = parseRepoId(repoId);
        const octokit = client(tokens);

        const { data } = await octokit.rest.repos.getCommit({ owner, repo, ref: sha });
        const files = (data.files ?? []) as unknown as Record<string, unknown>[];

        const perPage = opts?.limit ?? files.length;
        const page = opts?.cursor != null ? Number(opts.cursor) : 1;
        const offset = (page - 1) * perPage;
        const slice = files.slice(offset, offset + perPage);

        const items = slice
          .map((f) => mapChangedFile(f))
          .filter((f) => opts?.path == null || f.filename.startsWith(opts.path));

        return {
          items,
          hasMore: offset + perPage < files.length,
          cursor: offset + perPage < files.length ? String(page + 1) : undefined,
        };
      } catch (err) {
        throw mapGithubError(err);
      }
    },

    // ── Code Scanning ────────────────────────────────────────────────────────

    async listCodeScanAlerts(tokens, repoId, opts?: CodeScanAlertsOpts) {
      try {
        const { owner, repo } = parseRepoId(repoId);
        const octokit = client(tokens);
        const perPage = opts?.limit ?? 30;
        const page = opts?.cursor != null ? Number(opts.cursor) : 1;

        const stateParam =
          opts?.state === "all" ? undefined : (opts?.state ?? "open");

        const { data } = await octokit.rest.codeScanning.listAlertsForRepo({
          owner,
          repo,
          state: stateParam as "open" | "dismissed" | "fixed" | undefined,
          severity: opts?.severity as string | undefined,
          ref: opts?.ref,
          per_page: perPage,
          page,
        });

        return {
          items: data.map((a) =>
            mapCodeScanAlert(a as unknown as Record<string, unknown>),
          ),
          hasMore: data.length === perPage,
          cursor: data.length === perPage ? String(page + 1) : undefined,
        };
      } catch (err) {
        // GitHub returns 404 when code scanning is not enabled for the repo.
        if (
          typeof err === "object" &&
          err !== null &&
          "status" in err &&
          (err as { status: number }).status === 404
        ) {
          throw new CapabilityError(
            "github",
            "Code scanning is not enabled for this repository.",
            false,
          );
        }
        throw mapGithubError(err);
      }
    },

    async getCodeScanAlert(tokens, repoId, alertNumber) {
      try {
        const { owner, repo } = parseRepoId(repoId);
        const octokit = client(tokens);

        const { data } = await octokit.rest.codeScanning.getAlert({
          owner,
          repo,
          alert_number: alertNumber,
        });

        return mapCodeScanAlert(data as unknown as Record<string, unknown>);
      } catch (err) {
        if (
          typeof err === "object" &&
          err !== null &&
          "status" in err &&
          (err as { status: number }).status === 404
        ) {
          throw new CapabilityError(
            "github",
            "Code scanning is not enabled for this repository.",
            false,
          );
        }
        throw mapGithubError(err);
      }
    },

    // ── Commit Statuses ──────────────────────────────────────────────────────

    // eslint-disable-next-line max-params -- implements interface; method signature is contractual
    async listCommitStatuses(tokens, repoId, sha, opts?: CommitStatusesOpts) {
      try {
        const { owner, repo } = parseRepoId(repoId);
        const octokit = client(tokens);
        const perPage = opts?.limit ?? 30;
        const page = opts?.cursor != null ? Number(opts.cursor) : 1;

        const { data } = await octokit.rest.repos.listCommitStatusesForRef({
          owner,
          repo,
          ref: sha,
          per_page: perPage,
          page,
        });

        const items = data
          .map((s) => mapCommitStatus(s as unknown as Record<string, unknown>))
          .filter(
            (s) => opts?.context == null || s.context === opts.context,
          );

        return {
          items,
          hasMore: data.length === perPage,
          cursor: data.length === perPage ? String(page + 1) : undefined,
        };
      } catch (err) {
        throw mapGithubError(err);
      }
    },
  };
}
