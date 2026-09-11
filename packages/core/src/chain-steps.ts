// The steps a change may declare in its own chain — ADR 0021.
//
// A closed registry, deliberately shaped like `mechanical-checks.ts`:
// each entry is a function this repository owns, selected by a name a
// change's configuration may state. A configuration file never supplies
// a command, an argument vector, or a path to run — that boundary is
// ADR 0019's first rejected alternative, restated for a second kind of
// declaration, and it is the whole reason this capability is safe to
// have. A change file is read by a chain that drives agents with a
// working directory and an allowlist; the moment such a file can name
// something to execute, the allowlist is decoration.
//
// Every entry is something performed here, so no step can spend money.
// A part of the chain that invokes an agent is a stage, and the stages
// are the fixed six.

import { access } from "node:fs/promises";
import path from "node:path";
import { waitForExternalSignal, ExternalWaiterTimeoutError } from "./external-waiter.js";
import { CHAIN_STEP_NAMES, type ChainStepName } from "./harness-stage.js";

export { CHAIN_STEP_NAMES, type ChainStepName };

/** How often a waiting step asks again. Five seconds: a change landing
 * is a human-scale event, and a tighter interval would spend a
 * filesystem walk per second for an answer that cannot change that
 * fast. */
export const CHAIN_STEP_POLL_INTERVAL_MS = 5_000;

/** How long a wait may last when the declaration does not say. Thirty
 * minutes is long enough for another chain to finish a change and short
 * enough that a mistake is noticed the same afternoon — and a chain
 * holds the workspace lease while it waits, so this is also how long one
 * declaration can block the other hosts. */
export const DEFAULT_CHAIN_STEP_MAX_WAIT_MS = 30 * 60 * 1000;

export interface ChainStepResult {
  ok: boolean;
  /** Always present, on success and failure alike — what this step did,
   * in the terms the reader cares about, never "step failed". */
  reason: string;
}

export interface ChainStepContext {
  /** Absolute path to the workspace root the chain is running in. */
  workspaceRoot: string;
  /** The change whose chain this is — the one that declared the step. */
  changeName: string;
  /** How long a waiting step may wait. */
  maxWaitMs: number;
  /** Cancels a wait in progress. The chain's own cancellation, so an
   * interrupted run stops waiting rather than sitting out its ceiling. */
  signal?: AbortSignal;
  /** Test seam: how often a waiting step asks again. */
  pollIntervalMs?: number;
}

/** True while `changeName` is still an active change in this workspace.
 * Archived is the landing signal: it is the one state visible from the
 * filesystem both changes share, it is what `blocked_by` already
 * resolves on, and it is the point after which the other change's specs
 * are in `openspec/specs` where a later `verify` can read them.
 *
 * One `access` on one directory rather than a walk of the whole
 * workspace. Not only cheaper every five seconds: archiving IS a rename
 * of this directory, and on Windows a rename fails with EPERM while
 * another process holds a handle anywhere inside it. A poller that
 * walked every change's artifacts would be holding those handles, and
 * would make the very archive it is waiting for fail — which the test
 * for this step caught by doing exactly that. */
async function isStillActive(workspaceRoot: string, changeName: string): Promise<boolean> {
  try {
    await access(path.join(workspaceRoot, "openspec", "changes", changeName));
    return true;
  } catch {
    return false;
  }
}

async function awaitChange(ctx: ChainStepContext, param: string | undefined): Promise<ChainStepResult> {
  if (!param) {
    // Refused at configuration time, so reaching here is a defect rather
    // than a user error — but a step that silently did nothing would be
    // worse than one that says so.
    return { ok: false, reason: "await-change was given no change to wait for" };
  }

  // Asked before any waiting begins, so a change that has already landed
  // costs no interval at all.
  if (!(await isStillActive(ctx.workspaceRoot, param))) {
    return { ok: true, reason: `"${param}" had already landed` };
  }

  const startedAt = Date.now();
  try {
    await waitForExternalSignal({
      check: async () => !(await isStillActive(ctx.workspaceRoot, param)),
      intervalMs: ctx.pollIntervalMs ?? CHAIN_STEP_POLL_INTERVAL_MS,
      maxDurationMs: ctx.maxWaitMs,
      ...(ctx.signal ? { signal: ctx.signal } : {}),
    });
  } catch (error) {
    if (error instanceof ExternalWaiterTimeoutError) {
      return {
        ok: false,
        reason: `waited ${Math.round(ctx.maxWaitMs / 1000)}s for "${param}" to land and it did not`,
      };
    }
    return { ok: false, reason: `stopped waiting for "${param}": ${error instanceof Error ? error.message : String(error)}` };
  }

  return { ok: true, reason: `"${param}" landed after ${Math.round((Date.now() - startedAt) / 1000)}s` };
}

/** True for a step whose time is spent waiting rather than working.
 * Read by the chain, which must not count that time against a run's
 * ceiling: a chain waiting for something outside itself consumes nothing,
 * exactly as a chain paused at a checkpoint does not — and counting it
 * would stop chains behaving exactly as they were configured. */
export function isWaitingStep(name: ChainStepName): boolean {
  return name === "await-change";
}

export const CHAIN_STEPS: Readonly<
  Record<ChainStepName, (ctx: ChainStepContext, param?: string) => Promise<ChainStepResult>>
> = {
  "await-change": (ctx, param) => awaitChange(ctx, param),
};

/** Which steps require a parameter, so the configuration validator and
 * the step itself read one list rather than two that can drift. */
export const CHAIN_STEPS_REQUIRING_PARAM: readonly ChainStepName[] = ["await-change"];

/** Runs one named step. Throws for a name the registry does not have —
 * callers pass a name already validated by `harness-config.ts`, so this
 * is a defensive assertion rather than the user-facing error path, the
 * same posture `runMechanicalCheck` takes. */
export async function runChainStep(
  name: ChainStepName,
  param: string | undefined,
  ctx: ChainStepContext,
): Promise<ChainStepResult> {
  const step = CHAIN_STEPS[name];
  if (!step) {
    throw new Error(`Unknown chain step "${name}" (expected one of: ${CHAIN_STEP_NAMES.join(", ")})`);
  }
  return step(ctx, param);
}
