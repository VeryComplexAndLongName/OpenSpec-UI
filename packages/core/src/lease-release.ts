// Asking who holds a workspace, and clearing a lease whose holder is
// gone — see openspec/changes/a-lease-says-who/design.md.
//
// The tempting design is a `--force`, and it is wrong. A holder that
// DIED stops renewing and the next acquirer reclaims the lease on its
// own once the heartbeat is stale; that case already heals. A holder
// that is ALIVE and still renewing has the workspace open, and taking
// its lease would let a second mutating run start against files it is
// still holding — which is the exact thing the lease exists to prevent.
// A stuck holder is stopped, not robbed.
//
// So clearing requires establishing that the holder is gone, and the
// two ways to establish it are below.

import { access, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  WORKSPACE_LEASE_STALE_AFTER_MS,
  readWorkspaceLeaseHolder,
  type WorkspaceLeaseConflict,
} from "./workspace-lease.js";

export type LeaseReleaseOutcome =
  /** The lease file is gone, or there was none to begin with. */
  | { kind: "cleared"; holder?: WorkspaceLeaseConflict; because: "stale" | "process-gone" | "already-free" }
  /** The holder could not be shown to be gone, so nothing was touched. */
  | { kind: "refused"; holder: WorkspaceLeaseConflict; reason: string };

/** Whether a process exists, without signalling it.
 *
 * Signal `0` performs the permission and existence checks and delivers
 * nothing. `ESRCH` is no such process; `EPERM` is one that exists and
 * belongs to somebody else, which still counts as alive. */
export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    if (code === "EPERM") return true;
    return false;
  }
}

export interface LeaseReleaseOptions {
  workspaceRoot: string;
  /** Test seams. Production reads the machine. */
  hostname?: string;
  isRunning?: (pid: number) => boolean;
  staleAfterMs?: number;
}

/** Clears the workspace's lease only where its holder can be shown to
 * be gone, and reports which of the two ways established it. */
export async function releaseWorkspaceLease(options: LeaseReleaseOptions): Promise<LeaseReleaseOutcome> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const staleAfterMs = options.staleAfterMs ?? WORKSPACE_LEASE_STALE_AFTER_MS;
  const filePath = path.join(workspaceRoot, ".openspec-ui", "workspace.lease.json");

  // `readWorkspaceLeaseHolder` already reports a stale lease as nobody,
  // which is the first of the two ways: a heartbeat older than the
  // window is what this system has always meant by a holder no longer
  // being there. A file left behind by one is cleared on the way past.
  const holder = await readWorkspaceLeaseHolder(workspaceRoot, { staleAfterMs });
  if (!holder) {
    const existed = await removeIfPresent(filePath);
    return { kind: "cleared", because: existed ? "stale" : "already-free" };
  }

  const hostname = options.hostname ?? os.hostname();
  if (holder.hostname !== hostname) {
    return {
      kind: "refused",
      holder,
      reason: `the holder is on ${holder.hostname} and this is ${hostname}, so whether its process is still`
        + " running cannot be checked from here. Clear it there, or wait for its lease to go stale.",
    };
  }

  const isRunning = options.isRunning ?? isProcessRunning;
  if (isRunning(holder.pid)) {
    return {
      kind: "refused",
      holder,
      reason: `process ${holder.pid} is still running. Taking its lease would let a second mutating run start`
        + " against files it still has open, which is what the lease prevents — stop that process instead.",
    };
  }

  await removeIfPresent(filePath);
  return { kind: "cleared", holder, because: "process-gone" };
}

async function removeIfPresent(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
  } catch {
    return false;
  }
  await rm(filePath, { force: true });
  return true;
}
