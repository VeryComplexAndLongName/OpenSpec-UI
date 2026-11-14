import path from "node:path";
import type { SimpleGit } from "simple-git";
import { changeNameOf, isRunEntry, VERIFY_CHECKS_AGENT_NAME } from "./audit-runs.js";
import { CHANGE_DIFF_MAX_BYTES } from "./change-diff.js";
import { isValidChangeName } from "./change-name.js";
import { forgeFor } from "./forge.js";
import type { PullRequestsByBranch } from "./gh-pr-gateway.js";
import { openGit } from "./git-client.js";
import { createGitWrapper } from "./git.js";
import { readRepositoryAuditEntries } from "./repository-audit.js";
import type { AuditEntry } from "./security.js";
import { discoverOpenSpecWorkspace } from "./workbench.js";

const COMMIT = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u;
const SUMMARY_FILES = 20;

interface PrComparison {
  kind: "diff";
  baseCommit: string;
  mergeBase: string;
  files: string[];
  diff: string;
  truncated: boolean;
}

export interface PrReviewReport {
  title: string;
  summary: string;
  diff: string | null;
  truncated: boolean;
}

/** The checkout identity at a mechanical-check boundary, if it equals its
 * committed tree. A dirty checkout cannot establish a check of HEAD. */
export async function cleanPrReviewCommit(root: string): Promise<string | undefined> {
  try {
    const git = openGit(root);
    const commit = await resolveCommit(git, "HEAD");
    return commit !== undefined && !(await hasWorktreeChanges(git)) ? commit : undefined;
  } catch {
    return undefined;
  }
}

async function resolveCommit(git: SimpleGit, ref: string): Promise<string | undefined> {
  const sha = (await git.raw(["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`]).catch(() => "")).trim();
  return COMMIT.test(sha) ? sha : undefined;
}

async function hasWorktreeChanges(git: SimpleGit): Promise<boolean> {
  return (await git.raw(["--no-optional-locks", "status", "--porcelain=v1", "--untracked-files=normal"])).length > 0;
}

async function defaultPreviewRef(git: SimpleGit): Promise<string | undefined> {
  const remoteHead = (await git.raw(["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"]).catch(() => "")).trim();
  if (remoteHead.startsWith("refs/remotes/origin/")) return remoteHead;
  const refs = (await git.raw(["for-each-ref", "--format=%(refname)", "refs/remotes/origin/main", "refs/remotes/origin/master", "refs/heads/main", "refs/heads/master"])).trim().split("\n");
  const candidates = refs.filter((ref) => /^(?:refs\/remotes\/origin|refs\/heads)\/(?:main|master)$/u.test(ref));
  const branches = new Set(candidates.map((ref) => ref.slice(ref.lastIndexOf("/") + 1)));
  if (branches.size !== 1) return undefined;
  return candidates.find((ref) => ref.startsWith("refs/remotes/origin/")) ?? candidates[0];
}

function shortRef(ref: string): string {
  return ref.replace(/^refs\/(?:remotes\/|heads\/)/u, "");
}

async function compare(git: SimpleGit, head: string, ref: string, baseCommit: string | undefined): Promise<PrComparison | { kind: "unavailable"; reason: string }> {
  const target = shortRef(ref);
  const base = baseCommit !== undefined && !COMMIT.test(baseCommit) ? undefined : await resolveCommit(git, baseCommit ?? ref);
  if (base === undefined) return { kind: "unavailable", reason: `The target ${literal(target)} is unavailable locally.` };
  const mergeBase = (await git.raw(["merge-base", base, head]).catch(() => "")).trim();
  if (!COMMIT.test(mergeBase)) return { kind: "unavailable", reason: `No common ancestor with ${literal(target)} is available locally.` };

  const args = ["diff", "--no-ext-diff", "--no-textconv", "--no-color"];
  const [names, patch] = await Promise.all([
    git.raw([...args, "--name-only", "-z", mergeBase, head, "--"]),
    git.raw([...args, "--patch", mergeBase, head, "--"]),
  ]);
  const bytes = Buffer.from(patch);
  const truncated = bytes.length > CHANGE_DIFF_MAX_BYTES;
  const end = truncated ? bytes.lastIndexOf(10, CHANGE_DIFF_MAX_BYTES - 1) + 1 : bytes.length;
  return {
    kind: "diff", baseCommit: base, mergeBase,
    files: names.split("\0").filter(Boolean),
    diff: bytes.subarray(0, end).toString("utf8"),
    truncated,
  };
}

function newest(entries: readonly AuditEntry[]): AuditEntry | undefined {
  return entries.reduce<AuditEntry | undefined>((last, entry) =>
    last === undefined || Date.parse(entry.timestamp) >= Date.parse(last.timestamp) ? entry : last, undefined);
}

function terminal(entry: AuditEntry): boolean {
  return ["completed", "failed", "blocked", "cancelled"].includes(entry.outcome);
}

/** Format repository and audit values as inline code, with one line per
 * value so a path or branch cannot add Markdown, mentions or links. */
function literal(value: string): string {
  const oneLine = value.replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, " ");
  const longest = Math.max(0, ...(oneLine.match(/`+/gu) ?? []).map((part) => part.length));
  const delimiter = "`".repeat(longest + 1);
  return `${delimiter} ${oneLine} ${delimiter}`;
}

function evidence(entries: readonly AuditEntry[], name: string, head: string | undefined): string[] {
  const own = entries.filter((entry) => typeof entry?.changeDir === "string"
    && changeNameOf(entry.changeDir) === name && terminal(entry)
    && typeof entry.timestamp === "string" && Number.isFinite(Date.parse(entry.timestamp))
    && typeof entry.runId === "string");
  const checks = newest(own.filter((entry) => entry.agent === VERIFY_CHECKS_AGENT_NAME
    && Number.isSafeInteger(entry.checksRan) && Number.isSafeInteger(entry.checksFailed)
    && (entry.checksRan ?? 0) > 0 && (entry.checksFailed ?? -1) >= 0
    && (entry.checksFailed ?? 0) <= (entry.checksRan ?? 0)));
  const verify = newest(own.filter((entry) => isRunEntry(entry)
    && (entry.command === "verify" || entry.stage === "verify")));
  const lines = ["### Verification", ""];
  if (checks === undefined) {
    lines.push("- Mechanical checks: no result recorded.");
  } else {
    const ran = checks.checksRan ?? 0;
    const failed = checks.checksFailed ?? 0;
    const commit = checks.checkedCommit;
    const revision = typeof commit !== "string" || !COMMIT.test(commit) ? "unknown revision"
      : commit === head ? `reviewed commit ${literal(commit)}` : `historical commit ${literal(commit)}`;
    lines.push(`- Mechanical checks: ${ran - failed} passed, ${failed} failed (${revision}). Run ${literal(checks.runId)} at ${literal(checks.timestamp)}.`);
  }
  lines.push(verify === undefined ? "- Verify agent: no outcome recorded."
    : `- Verify agent: ${literal(verify.outcome)} (unknown revision). Run ${literal(verify.runId)} at ${literal(verify.timestamp)}.`);
  return lines;
}

export async function readPrReview(root: string, changeName: string, sources: {
  pullRequests?: (root: string) => Promise<PullRequestsByBranch>;
} = {}): Promise<PrReviewReport> {
  if (!isValidChangeName(changeName)) throw new Error("Choose an active OpenSpec change.");
  const workspace = await discoverOpenSpecWorkspace(root, { changes: "active", names: [changeName] });
  if (!workspace.changes.some((change) => change.name === changeName)) {
    throw new Error("This OpenSpec change is no longer active in its working directory.");
  }
  const title = `PR Review for ${changeName}`;
  const git = openGit(root);
  const head = await resolveCommit(git, "HEAD");
  const heading = [`## PR review for ${literal(changeName)}`, "", "### Comparison", ""];
  let comparison: Awaited<ReturnType<typeof compare>> = { kind: "unavailable", reason: "No committed HEAD is available." };
  if (head !== undefined) {
    const [branchRef, dirty, remotes] = await Promise.all([
      git.raw(["symbolic-ref", "--quiet", "--short", "HEAD"]).catch(() => ""),
      hasWorktreeChanges(git),
      git.raw(["remote"]).catch(() => ""),
    ]);
    const branch = branchRef.trim();
    heading.push(`- Reviewed head: ${literal(head)}${branch ? ` on ${literal(branch)}` : " (detached)"}.`);
    if (dirty) heading.push("- Uncommitted working-tree changes are excluded.");
    const remote = remotes.split(/\r?\n/u).includes("origin");
    const read = branch && remote
      ? await (sources.pullRequests ?? (async (cwd) => (await forgeFor(cwd)).pullRequestsByBranch()))(root).catch(() => undefined)
      : undefined;
    const targets = read?.available ? read.openTargets?.get(branch) ?? [] : [];
    const target = targets.length === 1 && targets[0]?.baseBranch ? targets[0] : undefined;
    if (target !== undefined) {
      heading.push(`- PR #${target.number} targets ${literal(target.baseBranch)}${target.baseCommit === undefined ? " (locally known target ref)" : ""}.`);
      if (target.headCommit && COMMIT.test(target.headCommit) && target.headCommit !== head) {
        heading.push(`- Published PR head: ${literal(target.headCommit)}. This report compares the local head.`);
      }
      const remoteRef = `refs/remotes/origin/${target.baseBranch}`;
      comparison = await compare(git, head, remoteRef, target.baseCommit);
    } else {
      const why = targets.length > 1 ? "More than one open PR targets a base from this branch."
        : read?.available ? "No open PR target was identified for this branch." : "The open PR target could not be read.";
      heading.push(`- ${why}`);
      const ref = await defaultPreviewRef(git);
      comparison = ref === undefined ? { kind: "unavailable", reason: "No default branch is available locally." }
        : await compare(git, head, ref, undefined);
      if (ref !== undefined) heading.push(`- Default-branch preview against ${literal(shortRef(ref))}.`);
    }
  }
  if (comparison.kind === "unavailable") {
    heading.push(`- Comparison unavailable. ${comparison.reason}`);
  } else {
    heading.push(`- Target commit: ${literal(comparison.baseCommit)}. Merge base: ${literal(comparison.mergeBase)}.`);
    heading.push(`- Changed files: ${comparison.files.length}.`);
    heading.push(...comparison.files.slice(0, SUMMARY_FILES).map((file) => `  - ${literal(file)}`));
    if (comparison.files.length > SUMMARY_FILES) heading.push(`  - ${comparison.files.length - SUMMARY_FILES} more.`);
    if (comparison.truncated) heading.push("- The displayed patch is truncated.");
  }
  const entries = await readRepositoryAuditEntries({ git: createGitWrapper({ cwd: root }), workspaceRoot: path.resolve(root) });
  const summary = [...heading, "", ...evidence(entries, changeName, head)].join("\n");
  return { title, summary, diff: comparison.kind === "diff" ? comparison.diff : null, truncated: comparison.kind === "diff" && comparison.truncated };
}
