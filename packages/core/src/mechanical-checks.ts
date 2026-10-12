// Mechanical task checks — see openspec/changes/harness-mechanical-checks/
// proposal.md and design.md. A closed registry of named checks a
// `tasks.md` line may select (task-checklist.ts parses the name); each
// entry is a function this module owns and runs itself, never a command
// string or argument vector supplied by a repository file — that
// boundary is ADR 0019's first rejected alternative ("free-form command
// strings, filtered by an allowlist"), and `prepareAgentContext`
// (security.ts) already holds the same line for agent prompts.

import crossSpawn from "cross-spawn";
import path from "node:path";
import { checkChangesetReminder } from "./changeset-reminder.js";
import { say, type MessageCode, type SaidMessage } from "./message-register.js";
import { validateChange } from "./openspec.js";
import { checkCwdSandbox } from "./security.js";

/** The complete, closed set of check names a `tasks.md` may select —
 * task 1.2: these are what the recurring Verification sections already
 * contain; nothing here is speculative. */
export const MECHANICAL_CHECK_NAMES = [
  "validate-change",
  "typecheck",
  "test",
  "lint",
  "path-unchanged",
  "changeset-present",
] as const;

export type MechanicalCheckName = (typeof MECHANICAL_CHECK_NAMES)[number];

export interface MechanicalCheckResult {
  pass: boolean;
  /** Always present, on both pass and fail — task 1.4: "which command,
   * which path, what came back", not "check failed". The words are the
   * register's (ADR 0046); `code` is their identifier. */
  reason: string;
  /** The identifier of the message in `reason`. */
  code: MessageCode;
}

export interface MechanicalCheckContext {
  /** Absolute path to the workspace root — where `npm`/`git`/`openspec`
   * commands for a check are run. */
  workspaceRoot: string;
  /** Absolute path to the change's own directory
   * (`openspec/changes/<changeName>`), for checks that need it. */
  changeDir: string;
  /** The change's own name, e.g. "harness-mechanical-checks". */
  changeName: string;
  /** Which npm script `typecheck`/`test`/`lint` should each run — see
   * check-script-resolution.ts. Optional and absent for every existing
   * caller (e.g. harness-chain-runner.ts), which keeps running the bare
   * script name unchanged; only a caller that resolves against a
   * workspace's own `package.json` (the extension) sets this. */
  scripts?: Partial<Record<"typecheck" | "test" | "lint", string>>;
}

/** One check's result: the register's words, and the identifier beside
 * them. */
function saidResult(pass: boolean, said: SaidMessage): MechanicalCheckResult {
  return { pass, code: said.code, reason: said.text };
}

function runCommand(
  cwd: string,
  binary: string,
  args: string[],
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = crossSpawn(binary, args, { cwd, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function tail(text: string, lines = 20): string {
  const trimmed = text.trim();
  if (!trimmed) return "(no output)";
  return trimmed.split(/\r?\n/).slice(-lines).join("\n");
}

async function checkValidateChange(ctx: MechanicalCheckContext): Promise<MechanicalCheckResult> {
  try {
    const validation = await validateChange(ctx.changeName, { cwd: ctx.workspaceRoot });
    if (validation.summary.totals.failed > 0) {
      const failedIds = validation.items.filter((item) => !item.valid).map((item) => item.id).join(", ");
      return saidResult(false, say("OSW-VAL-101", {
        change: ctx.changeName,
        count: validation.summary.totals.failed,
        ids: failedIds,
      }));
    }
    return saidResult(true, say("OSW-VAL-102", {
      change: ctx.changeName,
      count: validation.summary.totals.passed,
    }));
  } catch (error) {
    return saidResult(false, say("OSW-VAL-103", {
      change: ctx.changeName,
      error: error instanceof Error ? error.message : String(error),
    }));
  }
}

async function runNpmScript(ctx: MechanicalCheckContext, script: string): Promise<MechanicalCheckResult> {
  let outcome: { code: number | null; stdout: string; stderr: string };
  try {
    outcome = await runCommand(ctx.workspaceRoot, "npm", ["run", script]);
  } catch (error) {
    return saidResult(false, say("OSW-VAL-104", {
      script,
      error: error instanceof Error ? error.message : String(error),
    }));
  }
  if (outcome.code === 0) return saidResult(true, say("OSW-VAL-105", { script }));
  const output = tail(outcome.stderr || outcome.stdout);
  return saidResult(false, say("OSW-VAL-106", { script, code: outcome.code ?? "unknown", output }));
}

/** Resolves `relativePath` against `workspaceRoot` and confirms it stays
 * inside the workspace — same check `checkCwdSandbox` performs for a
 * `cwd`, applied here to a `path-unchanged` parameter (task 1.3). */
function resolveWithinWorkspace(
  workspaceRoot: string,
  relativePath: string,
): { path: string } | { refusal: SaidMessage } {
  const resolved = path.resolve(workspaceRoot, relativePath);
  const decision = checkCwdSandbox(resolved, workspaceRoot);
  if (!decision.allowed) {
    return { refusal: say("OSW-VAL-002", { path: relativePath, root: workspaceRoot }) };
  }
  return { path: resolved };
}

async function checkPathUnchanged(ctx: MechanicalCheckContext, param: string | undefined): Promise<MechanicalCheckResult> {
  if (!param) {
    return saidResult(false, say("OSW-VAL-001"));
  }
  const resolved = resolveWithinWorkspace(ctx.workspaceRoot, param);
  if ("refusal" in resolved) {
    return saidResult(false, resolved.refusal);
  }
  const relativeFromRoot = path.relative(ctx.workspaceRoot, resolved.path);
  let outcome: { code: number | null; stdout: string; stderr: string };
  try {
    outcome = await runCommand(ctx.workspaceRoot, "git", ["diff", "--quiet", "--", relativeFromRoot]);
  } catch (error) {
    return saidResult(false, say("OSW-VAL-107", {
      path: relativeFromRoot,
      error: error instanceof Error ? error.message : String(error),
    }));
  }
  if (outcome.code === 0) return saidResult(true, say("OSW-VAL-108", { path: relativeFromRoot }));
  if (outcome.code === 1) return saidResult(false, say("OSW-VAL-109", { path: relativeFromRoot }));
  return saidResult(false, say("OSW-VAL-110", {
    path: relativeFromRoot,
    code: outcome.code ?? "unknown",
    output: tail(outcome.stderr || outcome.stdout),
  }));
}

async function checkChangesetPresent(ctx: MechanicalCheckContext): Promise<MechanicalCheckResult> {
  const status = await checkChangesetReminder(ctx.workspaceRoot);
  if (!status.changesetsAdopted) {
    return saidResult(false, say("OSW-VAL-111", { root: ctx.workspaceRoot }));
  }
  if (status.pendingChangesetCount === 0) {
    return saidResult(false, say("OSW-VAL-112", { change: ctx.changeName }));
  }
  return saidResult(true, say("OSW-VAL-113", { count: status.pendingChangesetCount }));
}

/** The registry itself — the single place mapping a check name to the
 * function that performs it. Each entry takes the shared
 * `MechanicalCheckContext` and, for "path-unchanged" only, a parameter
 * string; every other entry ignores a parameter if one is somehow
 * present. Nothing here accepts a command string, an argument array, or
 * any shell text from a caller. */
export const MECHANICAL_CHECKS: Readonly<
  Record<MechanicalCheckName, (ctx: MechanicalCheckContext, param?: string) => Promise<MechanicalCheckResult>>
> = {
  "validate-change": (ctx) => checkValidateChange(ctx),
  typecheck: (ctx) => runNpmScript(ctx, ctx.scripts?.typecheck ?? "typecheck"),
  test: (ctx) => runNpmScript(ctx, ctx.scripts?.test ?? "test"),
  lint: (ctx) => runNpmScript(ctx, ctx.scripts?.lint ?? "lint"),
  "path-unchanged": (ctx, param) => checkPathUnchanged(ctx, param),
  "changeset-present": (ctx) => checkChangesetPresent(ctx),
};

export function isMechanicalCheckName(value: string): value is MechanicalCheckName {
  return (MECHANICAL_CHECK_NAMES as readonly string[]).includes(value);
}

/** Runs one named check. Throws if `name` is not a registered check —
 * callers are expected to only ever pass a name already validated by
 * `task-checklist.ts`'s parser (which rejects an unknown name at parse
 * time, per task 2.3), so this is a defensive assertion, not the
 * user-facing error path. */
export async function runMechanicalCheck(
  name: MechanicalCheckName,
  param: string | undefined,
  ctx: MechanicalCheckContext,
): Promise<MechanicalCheckResult> {
  const check = MECHANICAL_CHECKS[name];
  if (!check) {
    throw new Error(say("OSW-VAL-003", {
      name,
      names: MECHANICAL_CHECK_NAMES.join(", "),
    }).text);
  }
  return check(ctx, param);
}
