import type { OpenPullRequestTarget } from "./gh-pr-gateway.js";
import { failureDetails, isFailedCheck, type GitHubChecksReport, type ReviewCheckOptions } from "./github-checks.js";

type Read = (suffix: string) => Promise<unknown>;
type Target = OpenPullRequestTarget & { headCommit: string };
type Result = Extract<GitHubChecksReport, { kind: "checks" }>;
type Check = Result["checks"][number];

const PAGE_SIZE = 50;

function object(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function reportedLink(value: unknown, base: string): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const origin = new URL(base);
    const url = new URL(value, origin);
    if (/^https?:$/u.test(url.protocol) && origin.origin === url.origin && !url.username && !url.password) {
      return url.href.replace(/[<>]/gu, encodeURIComponent);
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function check(name: string, state: unknown, link: unknown, base: string): Check {
  const safeLink = reportedLink(link, base);
  return { name, state: typeof state === "string" && state ? state : "unknown",
    ...(safeLink === undefined ? {} : { link: safeLink }) };
}

function expected(names: string[], checks: Check[], complete: boolean): Result["expected"] {
  return [...new Set(names)].map((name) => ({
    name, state: checks.some((one) => one.name === name) ? "Reported"
      : complete && !/[*?[\]{}]/u.test(name) ? "No result on this commit" : "Result unknown",
  }));
}

export async function readGiteaReviewChecks(read: Read, base: string, target: Target, options: ReviewCheckOptions = {}): Promise<GitHubChecksReport> {
  const [statuses, branch] = await Promise.all([
    read(`/commits/${target.headCommit}/status?limit=${PAGE_SIZE}&page=1`).then(object, () => ({} as Record<string, unknown>)),
    read(`/branches/${encodeURIComponent(target.baseBranch)}`).then(object, () => ({} as Record<string, unknown>)),
  ]);
  const checks = statuses.sha === target.headCommit && Array.isArray(statuses.statuses) ? statuses.statuses.map(object).flatMap((one) => {
    if (typeof one.context !== "string" || !one.context.trim()) return [];
    const result = check(one.context, one.status ?? one.state, one.target_url, base);
    if (options.failureDetails && isFailedCheck(result.state)) result.failureDetails = failureDetails([one.description], true);
    return [result];
  }) : [];
  const resultsComplete = statuses.sha === target.headCommit && Array.isArray(statuses.statuses)
    && checks.length === statuses.statuses.length && checks.length === statuses.total_count;
  const contexts = branch.enable_status_check === true && Array.isArray(branch.status_check_contexts)
    ? branch.status_check_contexts.filter((name): name is string => typeof name === "string" && name.trim().length > 0) : [];
  const rulesComplete = branch.name === target.baseBranch && (branch.protected === false || branch.enable_status_check === false
    || Array.isArray(branch.status_check_contexts) && branch.enable_status_check === true && contexts.length === branch.status_check_contexts.length);
  return { kind: "checks", head: target.headCommit, checks, resultsComplete, rulesComplete,
    expected: expected(contexts, checks, resultsComplete) };
}

export async function readGitLabReviewChecks(read: Read, base: string, target: Target, options: ReviewCheckOptions = {}): Promise<GitHubChecksReport> {
  const [pipelines, project] = await Promise.all([
    read(`/merge_requests/${target.number}/pipelines?per_page=${PAGE_SIZE}&page=1`).catch(() => undefined),
    read("").then(object, () => ({} as Record<string, unknown>)),
  ]);
  const rows = Array.isArray(pipelines) ? pipelines.map(object) : [];
  const pipeline = rows.reduce<Record<string, unknown> | undefined>((latest, one) =>
    one.sha === target.headCommit && typeof one.id === "number" && Number.isSafeInteger(one.id) && one.id > 0
      && (latest === undefined || one.id > (latest.id as number)) ? one : latest, undefined);
  const checks: Check[] = [];
  let resultsComplete = Array.isArray(pipelines) && pipelines.length < PAGE_SIZE;
  if (pipeline !== undefined) {
    const pipelineCheck = check("Pipeline", pipeline.status, pipeline.web_url, base);
    if (options.failureDetails && isFailedCheck(pipelineCheck.state)) pipelineCheck.failureDetails = failureDetails([], true);
    checks.push(pipelineCheck);
    const jobs = await read(`/pipelines/${String(pipeline.id)}/jobs?per_page=${PAGE_SIZE}&page=1`).catch(() => undefined);
    const listedJobs = Array.isArray(jobs) ? jobs.map(object).flatMap((job) => {
      if (typeof job.name !== "string" || !job.name.trim()) return [];
      const result = check(job.name, job.status, job.web_url, base);
      if (options.failureDetails && isFailedCheck(result.state)) result.failureDetails = failureDetails([job.failure_reason], true);
      return [result];
    }) : [];
    checks.push(...listedJobs);
    resultsComplete = resultsComplete && Array.isArray(jobs) && jobs.length < PAGE_SIZE && listedJobs.length === jobs.length;
  }
  const required = project.only_allow_merge_if_pipeline_succeeds;
  const rulesComplete = typeof required === "boolean" && project.only_allow_merge_if_all_status_checks_passed !== true;
  return { kind: "checks", head: target.headCommit, checks, resultsComplete, rulesComplete,
    expected: expected(required === true ? ["Pipeline"] : [], checks, resultsComplete) };
}
