import { setTimeout as delay } from "node:timers/promises";
import crossSpawn from "cross-spawn";

export interface PullRequestRef {
  number: number;
  url: string;
}

export interface PullRequestCheckStatus {
  state: "pass" | "fail" | "none";
  reason?: string;
}

export interface PullRequestGateway {
  createPullRequest(headBranch: string, baseBranch: string): Promise<PullRequestRef>;
  waitForChecks(prNumber: number): Promise<PullRequestCheckStatus>;
  mergePullRequest(prNumber: number): Promise<void>;
}

export interface PullRequestGatewayOptions {
  cwd: string;
  ghBinary?: string;
  pollIntervalMs?: number;
  maxWaitMs?: number;
}

interface ExecResult {
  stdout: string;
  stderr: string;
}

interface CheckItem {
  name?: string;
  state?: string;
  conclusion?: string;
}

// `gh pr checks --json name,state` reports the states below in upper
// case; `normalizeCheckState` lower-cases before comparing. Every state
// is placed deliberately, because the previous version classified by
// falling through — anything unlisted counted as a failure, and `SKIPPED`
// is unlisted and ordinary. Two of the seven checks on this repository's
// own PR #178 are `SKIPPED` (conditional jobs that skip on every pull
// request by design), so that reading refused every pull request this
// repository can produce.
const PASS_STATES = new Set(["pass", "passed", "success", "successful"]);
/** Ran and decided nothing. Not a pass — a check that was skipped is no
 * evidence — but not a failure either. */
const NEUTRAL_STATES = new Set(["skipped", "neutral", "stale"]);
const PENDING_STATES = new Set(["pending", "in_progress", "queued", "requested", "waiting", "expected"]);

function normalizeCheckState(item: CheckItem): string {
  const raw = (item.state ?? item.conclusion ?? "").toString().toLowerCase();
  return raw;
}

/** The one non-final answer: it is what `waitForChecks` polls on, so it
 * is a named constant rather than a string compared in two places. */
const PENDING_REASON = "checks are still pending";

function parseCheckStatus(items: CheckItem[]): PullRequestCheckStatus {
  if (items.length === 0) return { state: "none", reason: "no check result was available" };

  const failed = items.find((item) => {
    const state = normalizeCheckState(item);
    return state.length > 0
      && !PASS_STATES.has(state)
      && !PENDING_STATES.has(state)
      && !NEUTRAL_STATES.has(state);
  });
  if (failed) {
    const failingName = failed.name ?? "unknown check";
    return { state: "fail", reason: `check failed: ${failingName} (${normalizeCheckState(failed)})` };
  }

  const hasPending = items.some((item) => PENDING_STATES.has(normalizeCheckState(item)));
  if (hasPending) {
    return { state: "none", reason: PENDING_REASON };
  }

  // Everything that ran was skipped or neutral, so nothing actually
  // exercised the change. ADR 0014 treats an absent result as a refusal
  // rather than as permission, and this is that case wearing a different
  // shape: checks exist, none of them decided anything.
  const anyPassed = items.some((item) => PASS_STATES.has(normalizeCheckState(item)));
  if (!anyPassed) {
    return { state: "none", reason: "every check was skipped — no check actually ran" };
  }

  return { state: "pass" };
}

function extractNoChecks(stderr: string): boolean {
  const normalized = stderr.toLowerCase();
  return normalized.includes("no checks") || normalized.includes("no status checks");
}

function execFileAsync(
  binary: string,
  args: string[],
  options: { cwd: string },
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = crossSpawn(binary, args, options);
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      reject(error);
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${binary} ${args.join(" ")} exited with code ${code ?? "unknown"}: ${stderr}`));
    });
  });
}

export function buildGitPushInvocation(remote: string, branch: string): { executable: string; args: string[] } {
  return { executable: "git", args: ["push", remote, branch] };
}

/** No `--json`: `gh pr create` does not accept it — the real binary
 * answers `unknown flag: --json` and exits non-zero (verified 2026-09-02).
 * It prints the new pull request's URL on stdout, and the number is the
 * last path segment of that URL, so nothing further needs to be asked. */
export function buildGhPrCreateInvocation(headBranch: string, baseBranch: string): { executable: string; args: string[] } {
  return {
    executable: "gh",
    args: ["pr", "create", "--fill", "--head", headBranch, "--base", baseBranch],
  };
}

const PR_URL_RE = /^https?:\/\/\S+\/pull\/(\d+)\s*$/;

/** `gh pr create` may print advisory lines before the URL, so take the
 * last line that is one. A URL that carries no number, or no URL at all,
 * is an error rather than a guess: the number is what every later call
 * addresses. */
export function parsePullRequestRef(stdout: string): PullRequestRef {
  for (const line of stdout.split(/\r?\n/).reverse()) {
    const match = PR_URL_RE.exec(line.trim());
    if (match) return { number: Number(match[1]), url: line.trim() };
  }
  throw new Error(`gh pr create printed no pull-request URL: ${stdout.trim() || "(no output)"}`);
}

export function buildGhPrMergeInvocation(prNumber: number): { executable: string; args: string[] } {
  return {
    executable: "gh",
    args: ["pr", "merge", String(prNumber), "--merge", "--delete-branch"],
  };
}

export function createPullRequestGateway(options: PullRequestGatewayOptions): PullRequestGateway {
  const ghBinary = options.ghBinary ?? "gh";
  const pollIntervalMs = options.pollIntervalMs ?? 2000;
  const maxWaitMs = options.maxWaitMs ?? 300000;

  return {
    async createPullRequest(headBranch: string, baseBranch: string): Promise<PullRequestRef> {
      const invocation = buildGhPrCreateInvocation(headBranch, baseBranch);
      const { stdout } = await execFileAsync(ghBinary, invocation.args, { cwd: options.cwd });
      return parsePullRequestRef(stdout);
    },

    async waitForChecks(prNumber: number): Promise<PullRequestCheckStatus> {
      const startedAt = Date.now();
      while (Date.now() - startedAt <= maxWaitMs) {
        try {
          const { stdout } = await execFileAsync(
            ghBinary,
            ["pr", "checks", String(prNumber), "--json", "name,state"],
            { cwd: options.cwd },
          );
          const items = JSON.parse(stdout) as CheckItem[];
          const status = parseCheckStatus(items);
          // Polling again only makes sense while something is still
          // running. Every other answer — including "all skipped" — is
          // already final, and waiting it out would turn a decided
          // refusal into a timeout that says something else.
          if (status.reason !== PENDING_REASON) return status;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (extractNoChecks(message)) {
            return { state: "none", reason: "no check result was available" };
          }
          throw error;
        }

        await delay(pollIntervalMs);
      }

      return { state: "none", reason: "checks did not reach a terminal state before timeout" };
    },

    async mergePullRequest(prNumber: number): Promise<void> {
      const invocation = buildGhPrMergeInvocation(prNumber);
      await execFileAsync(ghBinary, invocation.args, { cwd: options.cwd });
    },
  };
}
