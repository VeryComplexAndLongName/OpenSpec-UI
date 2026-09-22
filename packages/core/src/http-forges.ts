// GitLab and Gitea as forges, over their REST APIs
// (the-forge-is-gitlab-or-gitea-too). The same `Forge` GitHub is through
// `gh` (ADR 0035): the pull requests by branch, a new one, and a merge
// asked for once checks pass. Nothing is installed for them: `fetch`, and
// a token the person keeps in their environment - `GITLAB_TOKEN`,
// `GITEA_TOKEN` - which is read when asked and never written anywhere.

import type { BranchPullRequest, BranchPullRequestState, Forge, PullRequestRef, PullRequestsByBranch } from "./gh-pr-gateway.js";

export type FetchLike = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

export interface HttpForgeOptions {
  /** The forge's web root: `https://gitlab.com`, `http://gitea.local:3000`. */
  base: string;
  /** The repository's path there: `owner/repo`, `group/sub/project`. */
  path: string;
  token: string | undefined;
  /** Where the token was to be found, for a sentence that says it is not. */
  tokenName: string;
  fetch?: FetchLike;
  /** Test seam: how long to wait between two readings. */
  sleep?: (ms: number) => Promise<void>;
}

class ForgeRefusal extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function call(options: HttpForgeOptions, headers: Record<string, string>, method: string, url: string, body?: unknown): Promise<unknown> {
  const fetchImpl = options.fetch ?? (globalThis.fetch as unknown as FetchLike);
  const response = await fetchImpl(url, {
    method,
    headers: { ...headers, Accept: "application/json", ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  if (!response.ok) {
    let said = text.trim();
    try {
      const parsed = JSON.parse(text) as { message?: unknown; error?: unknown };
      const message = parsed.message ?? parsed.error;
      if (message !== undefined) said = typeof message === "string" ? message : JSON.stringify(message);
    } catch {
      // Not JSON: said as it came, cut short.
    }
    if (response.status === 401) throw new ForgeRefusal(`the ${options.tokenName} was refused (401)`, 401);
    throw new ForgeRefusal(`${method} ${new URL(url).pathname} answered ${response.status}: ${said.slice(0, 200) || "no reason given"}`, response.status);
  }
  return text.length === 0 ? undefined : JSON.parse(text);
}

function why(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Keeps, per branch, an open or merged one over a closed one, and the
 * newest of those - the rule `listPullRequestsByBranch` keeps for GitHub. */
function keep(byBranch: Map<string, BranchPullRequest>, branch: string, found: BranchPullRequest): void {
  const seen = byBranch.get(branch);
  if (seen === undefined || (seen.state === "CLOSED" && found.state !== "CLOSED")) byBranch.set(branch, found);
}

const PAGES = 4;

/** The branch a Gitea pull request came from. Once a merge deletes the
 * branch, Gitea answers `head.ref` as `refs/pull/<n>/head` and keeps the
 * name in `head.label` - `owner:branch` for a fork. Checked on Gitea 1.26.4,
 * 2026-09-22 (the-forge-is-gitlab-or-gitea-too). */
export function giteaHeadBranch(head: unknown): string | undefined {
  const { ref, label } = (head ?? {}) as { ref?: unknown; label?: unknown };
  if (typeof ref === "string" && ref.length > 0 && !ref.startsWith("refs/")) return ref;
  if (typeof label === "string" && label.length > 0) return label.includes(":") ? label.slice(label.indexOf(":") + 1) : label;
  return undefined;
}

export function createGiteaForge(options: HttpForgeOptions): Forge {
  const api = `${options.base.replace(/[/]+$/u, "")}/api/v1/repos/${options.path.split("/").map(encodeURIComponent).join("/")}`;
  const headers = (): Record<string, string> => ({ Authorization: `token ${options.token ?? ""}` });
  return {
    name: "Gitea",
    async pullRequestsByBranch(): Promise<PullRequestsByBranch> {
      if (!options.token) return { available: false, reason: `${options.tokenName} is not set` };
      const byBranch = new Map<string, BranchPullRequest>();
      try {
        for (let page = 1; page <= PAGES; page += 1) {
          let items: Array<Record<string, unknown>>;
          try {
            items = await call(options, headers(), "GET", `${api}/pulls?state=all&sort=newest&limit=50&page=${page}`) as Array<Record<string, unknown>>;
          } catch (error) {
            // Gitea 1.26.4 answers this list 404 while the repository has
            // one branch only - nothing a pull request could come from.
            // A repository that is there has, then, none; one that is not
            // is still said (checked 2026-09-22).
            if (!(error instanceof ForgeRefusal) || error.status !== 404) throw error;
            await call(options, headers(), "GET", api);
            break;
          }
          if (!Array.isArray(items) || items.length === 0) break;
          for (const item of items) {
            const number = item.number;
            const ref = giteaHeadBranch(item.head);
            if (typeof number !== "number" || ref === undefined) continue;
            const state: BranchPullRequestState = item.merged === true ? "MERGED" : item.state === "open" ? "OPEN" : "CLOSED";
            keep(byBranch, ref, { number, state });
          }
          if (items.length < 50) break;
        }
      } catch (error) {
        return { available: false, reason: why(error) };
      }
      return { available: true, byBranch };
    },
    async openPullRequest(request): Promise<PullRequestRef> {
      if (!options.token) throw new Error(`${options.tokenName} is not set`);
      const made = await call(options, headers(), "POST", `${api}/pulls`, { head: request.head, base: request.base, title: request.title, body: request.body }) as { number?: unknown; html_url?: unknown };
      if (typeof made?.number !== "number") throw new Error("Gitea opened a pull request and did not say its number");
      return { number: made.number, url: typeof made.html_url === "string" ? made.html_url : `${options.base}/${options.path}/pulls/${made.number}` };
    },
    async mergeWhenChecksPass(prNumber) {
      if (!options.token) return { ok: false, reason: `${options.tokenName} is not set` };
      let reason = "no merge method was tried";
      // A repository allows some methods; squash first, as ADR 0035 asks.
      for (const method of ["squash", "merge", "rebase"]) {
        try {
          await call(options, headers(), "POST", `${api}/pulls/${prNumber}/merge`, {
            Do: method,
            merge_when_checks_succeed: true,
            delete_branch_after_merge: true,
          });
          return { ok: true, method };
        } catch (error) {
          reason = why(error);
          if (!/not allowed|merge style|405/iu.test(reason)) break;
        }
      }
      return { ok: false, reason };
    },
  };
}

/** The merge statuses GitLab reports while it has not yet decided. */
const GITLAB_UNDECIDED: ReadonlySet<string> = new Set(["checking", "unchecked", "preparing", "approvals_syncing", "cannot_be_merged_recheck"]);
const GITLAB_READINGS = 15;
const GITLAB_ATTEMPTS = 3;
const GITLAB_WAIT_MS = 2000;

export function createGitLabForge(options: HttpForgeOptions): Forge {
  const api = `${options.base.replace(/[/]+$/u, "")}/api/v4/projects/${encodeURIComponent(options.path)}`;
  const headers = (): Record<string, string> => ({ "PRIVATE-TOKEN": options.token ?? "" });
  return {
    name: "GitLab",
    async pullRequestsByBranch(): Promise<PullRequestsByBranch> {
      if (!options.token) return { available: false, reason: `${options.tokenName} is not set` };
      const byBranch = new Map<string, BranchPullRequest>();
      try {
        for (let page = 1; page <= PAGES; page += 1) {
          const items = await call(options, headers(), "GET", `${api}/merge_requests?state=all&order_by=created_at&sort=desc&per_page=50&page=${page}`) as Array<Record<string, unknown>>;
          if (!Array.isArray(items) || items.length === 0) break;
          for (const item of items) {
            const number = item.iid;
            const ref = item.source_branch;
            if (typeof number !== "number" || typeof ref !== "string") continue;
            const state: BranchPullRequestState = item.state === "merged" ? "MERGED" : item.state === "opened" ? "OPEN" : "CLOSED";
            keep(byBranch, ref, { number, state });
          }
          if (items.length < 50) break;
        }
      } catch (error) {
        return { available: false, reason: why(error) };
      }
      return { available: true, byBranch };
    },
    async openPullRequest(request): Promise<PullRequestRef> {
      if (!options.token) throw new Error(`${options.tokenName} is not set`);
      const made = await call(options, headers(), "POST", `${api}/merge_requests`, {
        source_branch: request.head,
        target_branch: request.base,
        title: request.title,
        description: request.body,
        remove_source_branch: true,
        squash: true,
      }) as { iid?: unknown; web_url?: unknown };
      if (typeof made?.iid !== "number") throw new Error("GitLab opened a merge request and did not say its number");
      return { number: made.iid, url: typeof made.web_url === "string" ? made.web_url : `${options.base}/${options.path}/-/merge_requests/${made.iid}` };
    },
    async mergeWhenChecksPass(prNumber) {
      if (!options.token) return { ok: false, reason: `${options.tokenName} is not set` };
      const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
      // GitLab works out whether a new merge request can merge after it
      // answers, and refuses a merge meanwhile with 422 "Branch cannot be
      // merged" - seen live on gitlab.com on 2026-09-22, a moment after
      // opening one. So it is read until it has decided, and a 422 is
      // tried again a few times before it is believed.
      for (let reading = 0; reading < GITLAB_READINGS; reading += 1) {
        try {
          const request = await call(options, headers(), "GET", `${api}/merge_requests/${prNumber}`) as { detailed_merge_status?: unknown; merge_status?: unknown };
          const status = String(request?.detailed_merge_status ?? request?.merge_status ?? "");
          if (!GITLAB_UNDECIDED.has(status)) break;
        } catch {
          break;
        }
        await sleep(GITLAB_WAIT_MS);
      }
      let reason = "no merge was asked for";
      for (let attempt = 0; attempt < GITLAB_ATTEMPTS; attempt += 1) {
        try {
          // `auto_merge` merges when the pipeline passes, and at once where
          // the project runs none.
          await call(options, headers(), "PUT", `${api}/merge_requests/${prNumber}/merge`, {
            auto_merge: true,
            should_remove_source_branch: true,
            squash: true,
          });
          return { ok: true, method: "squash" };
        } catch (error) {
          reason = why(error);
          if (!(error instanceof ForgeRefusal) || error.status !== 422) break;
          await sleep(GITLAB_WAIT_MS);
        }
      }
      return { ok: false, reason };
    },
  };
}
