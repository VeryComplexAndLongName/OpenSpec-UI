// The readiness report's shape, and the words it is described in.
//
// A leaf module so the browser can have them: `change-readiness.ts`
// itself reads the filesystem and shells out to git, and the shell needs
// the types and the wording without either. Only type imports here, so
// nothing Node-side survives compilation (the same move `change-charts`
// made, and for the same reason).
//
// The wording lives here rather than in each view because two surfaces
// describing one fact differently is two facts as far as a reader is
// concerned.

import type { Hint } from "./hints.js";
import type { WorkspaceLeaseConflict } from "./workspace-lease.js";

/** Why two changes cannot be started alongside each other.
 *
 * Three kinds, reported as themselves rather than merged into a score: a
 * reader acts differently on "these two edit the same file" than on
 * "these two touch the same capability", and differently again on "this
 * one declares it waits for that one". */
export type ChangeCollision =
  | { kind: "declared-blocker"; blocker: string }
  | { kind: "shared-capability"; capability: string }
  | { kind: "overlapping-files"; files: string[] };

export type ChangeRunState =
  /** A working directory of this repository is holding the workspace for
   * this change right now. */
  | { state: "running"; worktreePath: string; holder: WorkspaceLeaseConflict }
  /** Something this change declares is not satisfied yet. */
  | { state: "blocked"; blockedBy: string[] }
  | { state: "ready" };

export interface ChangeReadiness {
  changeName: string;
  run: ChangeRunState;
  /** The changes this one declares it is blocked by, kept to those that
   * are still active — a blocker that has archived is satisfied, and is
   * no longer a change to point at.
   *
   * Carried on every change, not only the blocked ones, because it is
   * the relation the pipeline picture draws (ADR 0025) and a running
   * change has one too. Equal to `run.blockedBy` where the change is
   * blocked. */
  blockers: string[];
  /** The capabilities this change's delta carries — the spec files it
   * will merge into at archive. */
  capabilities: string[];
  /** Its own working directory, if it has one. Without one it cannot run
   * beside anything: one directory permits one mutating run. */
  worktreePath?: string;
  /** Other ready changes this one can be started alongside. */
  canJoin: string[];
  /** Other ready changes it cannot, and what they would meet over. */
  blockedFrom: Array<{ changeName: string; collisions: ChangeCollision[] }>;
  /** Present only where the change is ready but has nowhere of its own
   * to run. The remedy is one command and naming it is most of the
   * help. */
  needsWorktree?: string;
}

export interface ChangeReadinessReport {
  changes: ChangeReadiness[];
  /** What this report suggests, where the workspace computes
   * suggestions at all.
   *
   * Optional, and **absent** rather than empty where they are turned
   * off: off means not computed, so there is nothing to report rather
   * than nothing found. A host built before this field existed ignores
   * it, which is why it rides on the report rather than wrapping it.
   * Derived by `buildHints` — see a-hint-says-what-can-run-together. */
  hints?: Hint[];
}

/** One collision in the terms a reader acts on. */
export function describeCollision(collision: ChangeCollision): string {
  switch (collision.kind) {
    case "declared-blocker":
      return `one declares it is blocked by ${collision.blocker}`;
    case "shared-capability":
      return `both deliver a delta for "${collision.capability}", which archives into one spec file`;
    case "overlapping-files":
      return collision.files.length === 1
        ? `both branches have changed ${collision.files[0]}`
        : `both branches have changed ${collision.files.length} of the same files, including ${collision.files[0]}`;
  }
}
