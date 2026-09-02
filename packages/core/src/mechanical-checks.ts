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
   * which path, what came back", not "check failed". */
  reason: string;
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
  const label = `openspec change validate --strict ${ctx.changeName}`;
  try {
    const result = await validateChange(ctx.changeName, { cwd: ctx.workspaceRoot });
    if (result.summary.totals.failed > 0) {
      const failedIds = result.items.filter((item) => !item.valid).map((item) => item.id).join(", ");
      return { pass: false, reason: `${label}: ${result.summary.totals.failed} item(s) failed (${failedIds})` };
    }
    return { pass: true, reason: `${label}: ${result.summary.totals.passed} item(s) passed` };
  } catch (error) {
    return { pass: false, reason: `${label} failed to run: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function runNpmScript(ctx: MechanicalCheckContext, script: string): Promise<MechanicalCheckResult> {
  const label = `npm run ${script}`;
  let outcome: { code: number | null; stdout: string; stderr: string };
  try {
    outcome = await runCommand(ctx.workspaceRoot, "npm", ["run", script]);
  } catch (error) {
    return { pass: false, reason: `${label} failed to run: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (outcome.code === 0) return { pass: true, reason: `${label} exited 0` };
  const output = tail(outcome.stderr || outcome.stdout);
  return { pass: false, reason: `${label} exited ${outcome.code ?? "unknown"}:\n${output}` };
}

/** Resolves `relativePath` against `workspaceRoot` and confirms it stays
 * inside the workspace — same check `checkCwdSandbox` performs for a
 * `cwd`, applied here to a `path-unchanged` parameter (task 1.3). */
function resolveWithinWorkspace(workspaceRoot: string, relativePath: string): { path: string } | { reason: string } {
  const resolved = path.resolve(workspaceRoot, relativePath);
  const decision = checkCwdSandbox(resolved, workspaceRoot);
  if (!decision.allowed) {
    return { reason: `path "${relativePath}" resolves outside the workspace "${workspaceRoot}"` };
  }
  return { path: resolved };
}

async function checkPathUnchanged(ctx: MechanicalCheckContext, param: string | undefined): Promise<MechanicalCheckResult> {
  if (!param) {
    return { pass: false, reason: `"path-unchanged" requires a repository-relative path parameter` };
  }
  const resolved = resolveWithinWorkspace(ctx.workspaceRoot, param);
  if ("reason" in resolved) {
    return { pass: false, reason: resolved.reason };
  }
  const relativeFromRoot = path.relative(ctx.workspaceRoot, resolved.path);
  const label = `git diff -- ${relativeFromRoot}`;
  let outcome: { code: number | null; stdout: string; stderr: string };
  try {
    outcome = await runCommand(ctx.workspaceRoot, "git", ["diff", "--quiet", "--", relativeFromRoot]);
  } catch (error) {
    return { pass: false, reason: `${label} failed to run: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (outcome.code === 0) return { pass: true, reason: `${label} reported no changes` };
  if (outcome.code === 1) return { pass: false, reason: `${label} reported uncommitted changes to "${relativeFromRoot}"` };
  return { pass: false, reason: `${label} exited ${outcome.code ?? "unknown"}: ${tail(outcome.stderr || outcome.stdout)}` };
}

async function checkChangesetPresent(ctx: MechanicalCheckContext): Promise<MechanicalCheckResult> {
  const status = await checkChangesetReminder(ctx.workspaceRoot);
  if (!status.changesetsAdopted) {
    return { pass: false, reason: `no ".changeset/config.json" found under "${ctx.workspaceRoot}" — Changesets is not adopted` };
  }
  if (status.pendingChangesetCount === 0) {
    return { pass: false, reason: `no pending ".changeset/*.md" file found — run "npx changeset" for "${ctx.changeName}"` };
  }
  return { pass: true, reason: `${status.pendingChangesetCount} pending changeset file(s) found` };
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
  typecheck: (ctx) => runNpmScript(ctx, "typecheck"),
  test: (ctx) => runNpmScript(ctx, "test"),
  lint: (ctx) => runNpmScript(ctx, "lint"),
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
    throw new Error(`Unknown mechanical check "${name}" (expected one of: ${MECHANICAL_CHECK_NAMES.join(", ")})`);
  }
  return check(ctx, param);
}
