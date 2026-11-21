// On-demand evidence for PR Review. The merge gate uses its own contract.
type GitHubGet = (path: string) => Promise<unknown>;

export interface GitHubCheckTarget {
  baseBranch: string;
  headCommit: string;
}

interface Check {
  name: string;
  state: string;
  link?: string;
  app?: number;
  failureDetails?: FailureDetails;
}

export interface FailureDetails { messages: string[]; partial: boolean }
export interface ReviewCheckOptions { failureDetails?: boolean }
export const isFailedCheck = (state: string): boolean => ["failure", "failed", "error", "timed_out", "action_required", "startup_failure"].includes(state.toLowerCase());

/** Remote diagnostic text remains bounded data, never a command. */
export function failureDetails(values: unknown[], partial = false): FailureDetails {
  const strings = values.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  return { messages: strings.slice(0, 10).map((value) => value.replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, " ").slice(0, 1500)),
    partial: partial || strings.length === 0 || strings.length > 10 || strings.some((value) => value.length > 1500) };
}

interface Expected {
  name: string;
  app?: number;
  state: "Reported" | "No result on this commit" | "Source unconfirmed" | "Result unknown";
}

export type GitHubChecksReport =
  | { kind: "unavailable"; reason: string }
  | {
    kind: "checks";
    head: string;
    checks: Check[];
    expected: Expected[];
    resultsComplete: boolean;
    rulesComplete: boolean;
  };

const PAGE_LIMIT = 100;

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function rows(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function appId(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function githubLink(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    if (url.origin === "https://github.com" && !url.username && !url.password) {
      return url.href.replace(/[<>]/gu, encodeURIComponent);
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function checkOf(name: unknown, state: unknown, url: unknown, source?: number): Check | undefined {
  if (typeof name !== "string" || name.trim().length === 0) return undefined;
  const link = githubLink(url);
  return {
    name, state: typeof state === "string" && state ? state : "unknown",
    ...(link === undefined ? {} : { link }),
    ...(source === undefined ? {} : { app: source }),
  };
}

export async function readGitHubChecks(
  get: GitHubGet,
  target: GitHubCheckTarget,
  options: ReviewCheckOptions = {},
): Promise<GitHubChecksReport> {
  const query = `per_page=${PAGE_LIMIT}`;
  const branch = encodeURIComponent(target.baseBranch);
  const commit = `/commits/${target.headCommit}`;
  const [runsValue, statusesValue, rulesValue, branchValue] = await Promise.allSettled([
    get(`${commit}/check-runs?${query}`),
    get(`${commit}/status?${query}`),
    get(`/rules/branches/${branch}?${query}`),
    get(`/branches/${branch}`),
  ]);
  const runs = record(runsValue.status === "fulfilled" ? runsValue.value : undefined);
  const statuses = record(statusesValue.status === "fulfilled" ? statusesValue.value : undefined);
  const runRows = rows(runs.check_runs);
  const statusRows = rows(statuses.statuses);
  const runSources = new Map<Check, Record<string, unknown>>();
  const statusSources = new Map<Check, Record<string, unknown>>();
  const checks: Check[] = [
    ...runRows.map((value) => {
      const run = record(value);
      const check = checkOf(run.name, run.status === "completed" ? run.conclusion : run.status,
        run.details_url, appId(record(run.app).id));
      if (check) runSources.set(check, run);
      return check;
    }),
    ...statusRows.map((value) => {
      const status = record(value);
      const check = checkOf(status.context, status.state, status.target_url);
      if (check) statusSources.set(check, status);
      return check;
    }),
  ].filter((check) => check !== undefined);
  if (options.failureDetails) {
    let requested = 0;
    await Promise.all(checks.filter((check) => isFailedCheck(check.state)).map(async (check) => {
      const run = runSources.get(check);
      const output = record(run?.output);
      const messages: unknown[] = [output.title, output.summary, output.text];
      let partial = false;
      if (run && typeof run.id === "number" && Number.isSafeInteger(run.id) && run.id > 0 && requested < 5) {
        requested += 1;
        try {
          const annotations = await get(`/check-runs/${run.id}/annotations?per_page=10&page=1`);
          if (!Array.isArray(annotations)) partial = true;
          else {
            partial = typeof output.annotations_count !== "number" || output.annotations_count > annotations.length;
            for (const value of annotations) {
              const annotation = record(value);
              if (annotation.annotation_level !== "failure") continue;
              const location = typeof annotation.path === "string" ? annotation.path.slice(0, 400) : "";
              const line = typeof annotation.start_line === "number" && Number.isSafeInteger(annotation.start_line) && annotation.start_line > 0 ? `:${annotation.start_line}` : "";
              if (typeof annotation.message === "string") messages.push(`${location}${line}: ${annotation.message}`);
            }
          }
        } catch { partial = true; }
      } else partial = true;
      if (!run) {
        messages.push(statusSources.get(check)?.description);
        partial = true;
      }
      check.failureDetails = failureDetails(messages, partial);
    }));
  }
  const resultsComplete = Array.isArray(runs.check_runs) && runs.total_count === runRows.length
    && Array.isArray(statuses.statuses) && statuses.total_count === statusRows.length
    && checks.length === runRows.length + statusRows.length;

  const rules = rulesValue.status === "fulfilled" && Array.isArray(rulesValue.value) ? rulesValue.value : undefined;
  const requiredRules = rules?.map(record).filter((rule) => rule.type === "required_status_checks") ?? [];
  const protection = record(record(branchValue.status === "fulfilled" ? branchValue.value : undefined).protection);
  const legacy = record(protection.required_status_checks);
  const configured = new Map<string, Omit<Expected, "state">>();
  const addExpected = (name: unknown, app: number | undefined) => {
    if (typeof name !== "string" || name.trim().length === 0) return;
    configured.set(JSON.stringify([name, app]), { name, ...(app === undefined ? {} : { app }) });
  };
  for (const rule of requiredRules) {
    for (const value of rows(record(rule.parameters).required_status_checks)) {
      const required = record(value);
      addExpected(required.context, appId(required.integration_id));
    }
  }
  if (protection.enabled === true) {
    const classic = rows(legacy.checks).map(record);
    for (const required of classic) addExpected(required.context, appId(required.app_id));
    for (const name of rows(legacy.contexts)) {
      if (!classic.some((required) => required.context === name)) addExpected(name, undefined);
    }
  }
  const rulesComplete = rules !== undefined && rules.length < PAGE_LIMIT
    && requiredRules.every((rule) => Array.isArray(record(rule.parameters).required_status_checks))
    && (protection.enabled === false || (protection.enabled === true
      && (Array.isArray(legacy.checks) || Array.isArray(legacy.contexts))));
  const expected: Expected[] = [...configured.values()].map((one) => {
    const matchingName = checks.filter((check) => check.name === one.name);
    const reported = matchingName.some((check) => one.app === undefined || check.app === one.app);
    return {
      ...one,
      state: reported ? "Reported" : matchingName.length > 0 ? "Source unconfirmed"
        : resultsComplete ? "No result on this commit" : "Result unknown",
    };
  });
  return { kind: "checks", head: target.headCommit, checks, expected, resultsComplete, rulesComplete };
}
