import path from "node:path";
import { createHash } from "node:crypto";
import type { SimpleGit } from "simple-git";
import { changeNameOf, isRunEntry, VERIFY_CHECKS_AGENT_NAME } from "./audit-runs.js";
import { CHANGE_DIFF_MAX_BYTES } from "./change-diff.js";
import { ciJUnitRequest } from "./ci-junit.js";
import { readScopeSummary } from "./change-scope.js";
import { isValidChangeName } from "./change-name.js";
import { forgeFor } from "./forge.js";
import type { Forge, OpenPullRequestTarget, PullRequestsByBranch } from "./gh-pr-gateway.js";
import type { GitHubChecksReport } from "./github-checks.js";
import { openGit } from "./git-client.js";
import { createGitWrapper } from "./git.js";
import { prepareCiRepairTask } from "./ci-repair-task.js";
import { say } from "./message-register.js";
import { editJUnitMapping, importJUnit, readJUnitReview, type JUnitMappingChoices, type JUnitMappingPreview } from "./junit-evidence.js";
import { readRepositoryAuditEntries } from "./repository-audit.js";
import { editReviewFindings, readReviewFindings, type ReviewFindings } from "./review-findings.js";
import { readScenarioEvidence, scenarioCheckState } from "./scenario-evidence.js";
import { editScenarioMapping, type ScenarioMappingChoices, type ScenarioMappingPreview } from "./scenario-mapping-edit.js";
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
  head?: string;
  lastReviewed?: string;
  sinceLastReview?: boolean;
  mappingChoices?: ScenarioMappingChoices;
  mappingPreview?: ScenarioMappingPreview;
  junitMappingChoices?: JUnitMappingChoices;
  junitMappingPreview?: JUnitMappingPreview;
  ciJUnitForge?: "Gitea" | "GitLab";
  findings?: ReviewFindings;
  ciRepairTask?: string;
}

export function prReviewMarkdown({ summary: reviewSummary, diff, truncated, ciRepairTask }: PrReviewReport): string {
  const summary = ciRepairTask === undefined ? reviewSummary : `${reviewSummary}\n\n### Prepared agent task\n\n${ciRepairTask}`;
  if (diff === null) return summary;
  if (diff.length === 0) return summary + (truncated
    ? "\n\nThe patch exceeds the display limit." : "\n\nNo committed changes in this comparison.");
  // Unified diff lines begin with a prefix, including lines with fences.
  return `${summary}\n\n### Committed diff\n\n~~~diff\n${diff}\n~~~\n`;
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

export async function defaultPreviewRef(git: SimpleGit): Promise<string | undefined> {
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
  if (base === undefined) return { kind: "unavailable", reason: say("OSW-CHG-005", { target: literal(target) }).text };
  const mergeBase = (await git.raw(["merge-base", base, head]).catch(() => "")).trim();
  if (!COMMIT.test(mergeBase)) return { kind: "unavailable", reason: say("OSW-CHG-006", { target: literal(target) }).text };

  return compareTrees(git, head, mergeBase, base);
}

async function compareTrees(git: SimpleGit, head: string, mergeBase: string, base: string): Promise<PrComparison> {
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

function forgeEvidence(forge: string, report: GitHubChecksReport, target: OpenPullRequestTarget, localHead: string): string[] {
  if (report.kind === "unavailable") return [`- ${report.reason}`];
  const noun = forge === "GitLab" ? "Merge request" : "PR";
  const lines = [`- ${noun} #${target.number}, base ${literal(target.baseBranch)}, published head ${literal(report.head)}.`];
  if (report.head !== localHead) lines.push("- These results apply to a different commit than the local comparison.");
  if (report.checks.length === 0 && report.resultsComplete) lines.push(`- ${forge} has no check results for this commit.`);
  for (const check of report.checks) {
    const state = check.state.replaceAll("_", " ");
    lines.push(`- ${literal(check.name)}: ${literal(state)}${check.link === undefined ? "" : ` · [Open run](<${check.link}>)`}`);
  }
  if (!report.resultsComplete) lines.push(`- ${forge} check results could only be read partially or were unavailable.`);
  lines.push("", "#### Expected checks on the base branch", "");
  if (!report.rulesComplete) lines.push("- The list of expected checks is partial or unavailable.");
  if (report.expected.length === 0 && report.rulesComplete) lines.push(`- ${forge} reports no required checks for this branch.`);
  for (const check of report.expected) {
    lines.push(`- ${literal(check.name)}${check.app === undefined ? "" : ` (GitHub App ${check.app})`}: ${check.state}.`);
  }
  return lines;
}

export async function readPrReview(root: string, changeName: string, sources: {
  pullRequests?: (root: string) => Promise<PullRequestsByBranch>;
  forge?: (root: string) => Promise<Forge>;
  githubChecks?: boolean;
  sinceLastReview?: boolean;
  markReviewedCommit?: string;
  scenarioMapping?: unknown;
  junitImport?: unknown;
  junitMapping?: unknown;
  ciJUnitImport?: unknown;
  reviewFinding?: unknown;
  prepareCiRepairTask?: boolean;
} = {}): Promise<PrReviewReport> {
  if (!isValidChangeName(changeName)) throw new Error("Choose an active OpenSpec change.");
  const workspace = await discoverOpenSpecWorkspace(root, { changes: "active", names: [changeName] });
  if (!workspace.changes.some((change) => change.name === changeName)) {
    throw new Error("This OpenSpec change is no longer active in its working directory.");
  }
  const title = `PR Review for ${changeName}`;
  const git = openGit(root);
  const head = await resolveCommit(git, "HEAD");
  if (sources.reviewFinding !== undefined && (sources.ciJUnitImport !== undefined || sources.junitImport !== undefined
      || sources.markReviewedCommit !== undefined || sources.junitMapping !== undefined || sources.scenarioMapping !== undefined)) {
    throw new Error("Record the review finding in a separate action.");
  }
  const ciRequest = sources.ciJUnitImport === undefined ? undefined : ciJUnitRequest.parse(sources.ciJUnitImport);
  if (ciRequest && (ciRequest.head !== head || sources.junitImport !== undefined
      || sources.markReviewedCommit !== undefined || sources.junitMapping !== undefined || sources.scenarioMapping !== undefined)) {
    throw new Error("Open the current PR Review and import CI evidence in a separate action.");
  }
  if (sources.junitImport !== undefined) await importJUnit(root, changeName, sources.junitImport, head);
  const marker = `refs/openspec-ui/reviewed/${createHash("sha256").update(changeName).digest("hex")}`;
  if (sources.markReviewedCommit !== undefined) {
    if (head === undefined || sources.markReviewedCommit !== head) {
      throw new Error(say("OSW-GIT-003").text);
    }
    await git.raw(["update-ref", marker, head]);
  }
  const lastReviewed = await resolveCommit(git, marker);
  const sinceLastReview = sources.sinceLastReview === true;
  const heading = [`## PR review for ${literal(changeName)}`, "", "### Comparison", ""];
  const refreshChecks = sources.githubChecks === true || sources.scenarioMapping !== undefined || sources.prepareCiRepairTask === true;
  let checks: string[] = ["- Checks require a unique open PR or merge request from this branch."];
  let forgeReport: GitHubChecksReport | undefined;
  let forgeName = "GitHub";
  let ciJUnitForge: PrReviewReport["ciJUnitForge"];
  let ciImported = false;
  let comparison: Awaited<ReturnType<typeof compare>> = { kind: "unavailable", reason: say("OSW-CHG-004").text };
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
    const forge = remote && ((branch && (sources.pullRequests === undefined || refreshChecks)) || ciRequest !== undefined)
      ? await (sources.forge ?? forgeFor)(root).catch(() => undefined) : undefined;
    forgeName = forge?.name ?? forgeName;
    if (forge?.readCiJUnit && (forge.name === "Gitea" || forge.name === "GitLab")) ciJUnitForge = forge.name;
    if (ciRequest && ciJUnitForge && forge?.readCiJUnit) {
      const report = await forge.readCiJUnit(ciRequest.execution);
      await importJUnit(root, changeName, { head, testedCommit: report.testedCommit, xml: report.xml }, head, report.source);
      ciImported = true;
    }
    const read = branch && remote ? await (sources.pullRequests === undefined
      ? forge?.pullRequestsByBranch() : sources.pullRequests(root))?.catch(() => undefined) : undefined;
    const targets = read?.available ? read.openTargets?.get(branch) ?? [] : [];
    const target = targets.length === 1 && targets[0]?.baseBranch ? targets[0] : undefined;
    if (target !== undefined) {
      const noun = forgeName === "GitLab" ? "Merge request" : "PR";
      heading.push(`- ${noun} #${target.number} targets ${literal(target.baseBranch)}${target.baseCommit === undefined ? " (locally known target ref)" : ""}.`);
      if (target.headCommit && COMMIT.test(target.headCommit) && target.headCommit !== head) {
        heading.push(`- Published PR head: ${literal(target.headCommit)}. This report compares the local head.`);
      }
      const remoteRef = `refs/remotes/origin/${target.baseBranch}`;
      if (!sinceLastReview) comparison = await compare(git, head, remoteRef, target.baseCommit);
      if (refreshChecks) {
        const refresh = forge?.reviewChecks ?? forge?.githubChecks;
        if (refresh === undefined) {
          checks = ["- Commit-specific checks are unavailable for this origin."];
        } else if (target.headCommit === undefined || !COMMIT.test(target.headCommit)) {
          checks = [`- ${forgeName} did not report a published head for this request.`];
        } else {
          const checked = await (sources.prepareCiRepairTask
            ? refresh({ ...target, headCommit: target.headCommit }, { failureDetails: true })
            : refresh({ ...target, headCommit: target.headCommit })).catch(
            (): GitHubChecksReport => ({ kind: "unavailable", reason: say("OSW-CHG-011", { forge: forgeName }).text }),
          );
          forgeReport = checked;
          checks = forgeEvidence(forgeName, checked, target, head);
        }
      }
    } else {
      if (refreshChecks && read?.available === false) {
        checks = [`- The open request could not be read. ${literal(read.reason)}`];
      }
      const why = targets.length > 1 ? "More than one open PR targets a base from this branch."
        : read?.available ? "No open PR target was identified for this branch." : "The open PR target could not be read.";
      heading.push(`- ${why}`);
      const ref = await defaultPreviewRef(git);
      if (!sinceLastReview) {
        comparison = ref === undefined ? { kind: "unavailable", reason: say("OSW-CHG-007").text }
          : await compare(git, head, ref, undefined);
        if (ref !== undefined) heading.push(`- Default-branch preview against ${literal(shortRef(ref))}.`);
      }
    }
    if (sinceLastReview) {
      comparison = lastReviewed === undefined
        ? { kind: "unavailable", reason: say("OSW-GIT-004").text }
        : await compareTrees(git, head, lastReviewed, lastReviewed);
    }
  }
  if (ciRequest && !ciImported) throw new Error("CI JUnit import requires a Gitea or GitLab origin with readable artifact metadata.");
  if (lastReviewed !== undefined) heading.push(`- Last reviewed locally: ${literal(lastReviewed)}.`);
  if (comparison.kind === "unavailable") {
    heading.push(`- Comparison unavailable. ${comparison.reason}`);
  } else {
    heading.push(sinceLastReview
      ? "- The diff compares the last reviewed commit directly with the current head."
      : `- Target commit: ${literal(comparison.baseCommit)}. Merge base: ${literal(comparison.mergeBase)}.`);
    heading.push(`- Changed files: ${comparison.files.length}.`);
    heading.push(...comparison.files.slice(0, SUMMARY_FILES).map((file) => `  - ${literal(file)}`));
    if (comparison.files.length > SUMMARY_FILES) heading.push(`  - ${comparison.files.length - SUMMARY_FILES} more.`);
    if (comparison.truncated) heading.push("- The displayed patch is truncated.");
  }
  const scopeLines = await readScopeSummary(git, changeName, head, comparison.kind === "diff" ? comparison.mergeBase : undefined);
  const entries = await readRepositoryAuditEntries({ git: createGitWrapper({ cwd: root }), workspaceRoot: path.resolve(root) });
  const scenarioLines: string[] = [];
  let mappingChoices: ScenarioMappingChoices | undefined;
  let mappingPreview: ScenarioMappingPreview | undefined;
  let junitMappingChoices: JUnitMappingChoices | undefined;
  let junitMappingPreview: JUnitMappingPreview | undefined;
  if (head !== undefined) {
    const linked = await readScenarioEvidence(git, head, changeName);
    if (linked.scenarios.length > 0 || linked.warnings.length > 0) {
      scenarioLines.push("", "### Scenario evidence", "");
      scenarioLines.push(...linked.warnings.map((warning) => `- ${warning}`));
      if (linked.scenarios.some((scenario) => scenario.checks.length === 0)) {
        scenarioLines.push("- Commit `scenario-checks.json` beside the proposal to associate scenarios with reported checks.");
      }
      for (const entry of linked.scenarios) {
        scenarioLines.push(`- ${literal(entry.capability)} / ${literal(entry.requirement)} / ${literal(entry.scenario)}`);
        scenarioLines.push(...(entry.checks.length === 0 ? ["  - No check linked."]
          : entry.checks.map((check) => `  - ${literal(check)}: ${literal(scenarioCheckState(check, head, forgeReport, forgeName))}.`)));
      }
    }
    const junit = await readJUnitReview(root, changeName, head, linked.scenarios);
    scenarioLines.push(...junit.lines);
    junitMappingChoices = junit.choices;
    if (linked.scenarios.length > 0 && forgeReport?.kind === "checks" && forgeReport.head === head && forgeReport.resultsComplete) {
      const counts = new Map<string, number>();
      for (const check of forgeReport.checks) counts.set(check.name, (counts.get(check.name) ?? 0) + 1);
      const uniqueChecks = [...counts].filter(([, count]) => count === 1).map(([name]) => name);
      if (uniqueChecks.length > 0) mappingChoices = { checks: uniqueChecks,
        scenarios: linked.scenarios.map(({ capability, requirement, scenario }) => ({ capability, requirement, scenario })) };
    }
  }
  if (sources.junitMapping !== undefined) {
    const edit = await editJUnitMapping(root, changeName, head, sources.junitMapping, junitMappingChoices);
    if ("preview" in edit) junitMappingPreview = edit.preview;
    else scenarioLines.push("", "**Test mapping saved.** Commit `scenario-tests.json` to include it in the review.");
  }
  if (sources.scenarioMapping !== undefined) {
    const edit = await editScenarioMapping(root, changeName, sources.scenarioMapping, head, mappingChoices);
    if ("preview" in edit) mappingPreview = edit.preview;
    else scenarioLines.push("", "**Mapping saved.** Commit `scenario-checks.json` to include it in the review.");
  }
  let findings: ReviewFindings | undefined;
  const findingLines: string[] = [];
  if (sources.reviewFinding !== undefined) {
    findings = await editReviewFindings(git, changeName, head, sources.reviewFinding);
  } else if (head) {
    try { findings = await readReviewFindings(git, changeName); }
    catch { findingLines.push("", "### Review findings", "", "- The local review findings could not be read."); }
  }
  if (findings?.entries.length) {
    findingLines.push("", "### Review findings", "");
    for (const entry of findings.entries) {
      const last = entry.decisions.at(-1);
      const location = entry.location ? ` at ${literal(entry.location.path + (entry.location.line ? ":" + entry.location.line : ""))}` : "";
      const historical = entry.status === "verified" && last?.commit !== head ? " (historical)" : "";
      findingLines.push(`- ${entry.status}${historical}: ${literal(entry.description)}${location}. Opened on ${literal(entry.openedAt)}.`);
      if (entry.status === "verified") {
        const fixed = entry.decisions.at(-2);
        if (fixed?.action === "fixed") findingLines.push(`  - Correction on ${literal(fixed.commit)}: ${literal(fixed.note)}.`);
      }
      if (last) findingLines.push(`  - ${last.action === "reopen" ? "Reopened" : "Decision"} on ${literal(last.commit)}: ${literal(last.note)}.`);
    }
  }
  const repair = sources.prepareCiRepairTask ? prepareCiRepairTask(changeName, head, forgeName, forgeReport) : undefined;
  const summary = [...heading, "", ...evidence(entries, changeName, head),
    ...(refreshChecks ? ["", `### ${forgeName} checks`, "", ...checks] : []),
    ...scopeLines,
    ...findingLines,
    ...scenarioLines,
    ...(repair?.lines ?? []),
  ].join("\n");
  return { title, summary, diff: comparison.kind === "diff" ? comparison.diff : null,
    truncated: comparison.kind === "diff" && comparison.truncated,
    ...(head === undefined ? {} : { head }), ...(lastReviewed === undefined ? {} : { lastReviewed }),
    ...(sinceLastReview ? { sinceLastReview } : {}),
    ...(mappingChoices === undefined ? {} : { mappingChoices }),
    ...(mappingPreview === undefined ? {} : { mappingPreview }),
    ...(junitMappingChoices === undefined ? {} : { junitMappingChoices }),
    ...(junitMappingPreview === undefined ? {} : { junitMappingPreview }),
    ...(ciJUnitForge === undefined ? {} : { ciJUnitForge }),
    ...(findings === undefined ? {} : { findings }),
    ...(repair?.task === undefined ? {} : { ciRepairTask: repair.task }) };
}
