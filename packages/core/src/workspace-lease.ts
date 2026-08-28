import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Cross-host mutation isolation (docs/adr/0010-cross-host-workspace-lease.md).
// Extends ADR 0004 decision 4's "one mutating run per workspace" invariant
// across host processes (VS Code extension + standalone server), not only
// within one. Deliberately not a general-purpose distributed lock: scoped to
// exactly the mutating-run lifetime a WorkbenchProcessScheduler already
// tracks in-memory via `mutationLocked`, and written with the same
// write-then-rename atomic replacement `WorkbenchRunJournal` already uses.

export const WORKSPACE_LEASE_VERSION = 1;

/** How often a held lease's heartbeat is renewed while a mutating process
 * is running. */
export const WORKSPACE_LEASE_RENEW_INTERVAL_MS = 5_000;

/** How long since the last heartbeat before a lease is treated as no
 * longer held (4x the renew interval — tolerant of a slow disk or a GC
 * pause without leaving a genuinely stopped host's lease live for long). */
export const WORKSPACE_LEASE_STALE_AFTER_MS = 20_000;

export type WorkspaceLeaseHostKind = "vscode-extension" | "standalone-server";

export interface WorkspaceLeaseDocument {
  version: typeof WORKSPACE_LEASE_VERSION;
  holderId: string;
  hostKind: WorkspaceLeaseHostKind;
  hostname: string;
  pid: number;
  acquiredAt: string;
  heartbeatAt: string;
}

export interface WorkspaceLeaseManagerOptions {
  hostKind: WorkspaceLeaseHostKind;
  staleAfterMs?: number;
}

/** Details of the lease holder a conflicting or reclaimed acquire attempt
 * found — enough for a host to explain itself to the user. */
export interface WorkspaceLeaseConflict {
  hostKind: WorkspaceLeaseHostKind;
  hostname: string;
  pid: number;
  heartbeatAgeMs: number;
}

export type WorkspaceLeaseAcquireResult =
  | { ok: true; reclaimedFrom?: WorkspaceLeaseConflict }
  | { ok: false; conflict: WorkspaceLeaseConflict };

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function hostKindLabel(hostKind: WorkspaceLeaseHostKind): string {
  return hostKind === "vscode-extension" ? "VS Code extension" : "standalone server";
}

export function describeWorkspaceLeaseConflict(conflict: WorkspaceLeaseConflict): string {
  const heartbeatAgeSeconds = Math.round(conflict.heartbeatAgeMs / 1000);
  return (
    `Another OpenSpec UI host (${hostKindLabel(conflict.hostKind)} on ` +
    `${conflict.hostname}, pid ${conflict.pid}, last active ${heartbeatAgeSeconds}s ago) ` +
    `is currently running a mutating operation on this workspace. Wait for it to ` +
    `finish, or close it, before starting one here.`
  );
}

export function describeWorkspaceLeaseReclamation(conflict: WorkspaceLeaseConflict): string {
  const heartbeatAgeSeconds = Math.round(conflict.heartbeatAgeMs / 1000);
  return (
    `Reclaimed the workspace lease from ${hostKindLabel(conflict.hostKind)} on ` +
    `${conflict.hostname} (pid ${conflict.pid}), which stopped renewing it ` +
    `${heartbeatAgeSeconds}s ago.`
  );
}

/** One host's handle on the cross-host workspace mutation lease. Every
 * `WorkspaceLeaseManager` instance has its own random `holderId` — one
 * instance is constructed per host activation (per `WorkbenchRecoveryService`
 * or per VS Code extension activation), not per process run. */
export class WorkspaceLeaseManager {
  readonly filePath: string;
  private readonly holderId = randomUUID();
  private readonly hostKind: WorkspaceLeaseHostKind;
  private readonly staleAfterMs: number;

  constructor(root: string, options: WorkspaceLeaseManagerOptions) {
    this.filePath = path.join(path.resolve(root), ".openspec-ui", "workspace.lease.json");
    this.hostKind = options.hostKind;
    this.staleAfterMs = options.staleAfterMs ?? WORKSPACE_LEASE_STALE_AFTER_MS;
  }

  /** Acquires the lease if unheld or stale, or renews it if already held by
   * this manager. Never throws on a live foreign holder — reports a
   * conflict instead, for the caller to surface without crashing the run. */
  async acquireOrRenew(): Promise<WorkspaceLeaseAcquireResult> {
    const existing = await this.readExisting();
    if (existing && existing.holderId !== this.holderId) {
      const heartbeatAgeMs = Date.now() - Date.parse(existing.heartbeatAt);
      if (heartbeatAgeMs <= this.staleAfterMs) {
        return {
          ok: false,
          conflict: { hostKind: existing.hostKind, hostname: existing.hostname, pid: existing.pid, heartbeatAgeMs },
        };
      }
      await this.write();
      return {
        ok: true,
        reclaimedFrom: { hostKind: existing.hostKind, hostname: existing.hostname, pid: existing.pid, heartbeatAgeMs },
      };
    }
    // Renewing our own, already-held lease: keep the original `acquiredAt`
    // rather than resetting it on every heartbeat.
    await this.write(existing?.acquiredAt);
    return { ok: true };
  }

  /** Clears the lease, but only if currently held by this manager — a
   * reclaimed-away lease must never be released by its former holder. */
  async release(): Promise<void> {
    const existing = await this.readExisting();
    if (!existing || existing.holderId !== this.holderId) return;
    await rm(this.filePath, { force: true });
  }

  private async readExisting(): Promise<WorkspaceLeaseDocument | undefined> {
    let source: string;
    try {
      source = await readFile(this.filePath, "utf8");
    } catch (error) {
      if (isMissingFile(error)) return undefined;
      throw error;
    }
    let document: WorkspaceLeaseDocument;
    try {
      document = JSON.parse(source) as WorkspaceLeaseDocument;
    } catch {
      // A corrupt lease file is treated as absent, not a fatal error — the
      // next acquire simply overwrites it (unlike the run journal, a lease
      // is disposable coordination state, not user data worth preserving).
      return undefined;
    }
    if (document.version !== WORKSPACE_LEASE_VERSION) return undefined;
    return document;
  }

  private async write(acquiredAt?: string): Promise<void> {
    const now = new Date().toISOString();
    const document: WorkspaceLeaseDocument = {
      version: WORKSPACE_LEASE_VERSION,
      holderId: this.holderId,
      hostKind: this.hostKind,
      hostname: os.hostname(),
      pid: process.pid,
      acquiredAt: acquiredAt ?? now,
      heartbeatAt: now,
    };
    const directory = path.dirname(this.filePath);
    const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`;
    await mkdir(directory, { recursive: true });
    try {
      await writeFile(temporaryPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
      try {
        await rename(temporaryPath, this.filePath);
      } catch (error) {
        const code = error instanceof Error && "code" in error ? error.code : undefined;
        if (code !== "EEXIST" && code !== "EPERM") throw error;
        await rm(this.filePath, { force: true });
        await rename(temporaryPath, this.filePath);
      }
    } finally {
      await rm(temporaryPath, { force: true });
    }
  }
}
