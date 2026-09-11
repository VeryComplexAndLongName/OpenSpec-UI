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

/** Every kind of host that can hold the workspace. `"cli"` is a terminal
 * run (`openspec-ui-cli run`) — ADR 0020 decision 6: a run started from a
 * terminal mutates a workspace exactly as the two interactive hosts do,
 * so it takes the same lease rather than a weaker one of its own. */
export type WorkspaceLeaseHostKind = "vscode-extension" | "standalone-server" | "cli";

export interface WorkspaceLeaseDocument {
  version: typeof WORKSPACE_LEASE_VERSION;
  holderId: string;
  hostKind: WorkspaceLeaseHostKind;
  hostname: string;
  pid: number;
  acquiredAt: string;
  heartbeatAt: string;
  /** The git identity of the working directory that took this lease.
   *
   * ATTRIBUTION, NEVER AUTHENTICATION — see a-lease-says-who. Anybody
   * can set `user.email` to anything; this is the same self-declared
   * label that signs every commit, recorded so a person can tell whose
   * run holds the workspace. Nothing is permitted or refused on it.
   *
   * Optional because every lease written before this field existed has
   * none, and a directory with no identity configured must still be
   * able to take one. */
  author?: string;
}

export interface WorkspaceLeaseManagerOptions {
  hostKind: WorkspaceLeaseHostKind;
  staleAfterMs?: number;
  /** Gathered ONCE by whoever constructs this, never read here.
   * `acquireOrRenew` runs every five seconds while a run is active, and
   * reading git config there would spawn a process twelve times a
   * minute for a value that cannot change mid-run. */
  author?: string;
}

/** Details of the lease holder a conflicting or reclaimed acquire attempt
 * found — enough for a host to explain itself to the user. */
export interface WorkspaceLeaseConflict {
  hostKind: WorkspaceLeaseHostKind;
  hostname: string;
  pid: number;
  heartbeatAgeMs: number;
  /** See `WorkspaceLeaseDocument.author`: attribution, not
   * authentication. Absent where the holder recorded none. */
  author?: string;
}

export type WorkspaceLeaseAcquireResult =
  | { ok: true; reclaimedFrom?: WorkspaceLeaseConflict }
  | { ok: false; conflict: WorkspaceLeaseConflict };

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

const HOST_KIND_LABELS: Readonly<Record<WorkspaceLeaseHostKind, string>> = {
  "vscode-extension": "VS Code extension",
  "standalone-server": "standalone server",
  cli: "terminal run",
};

/** Exhaustive by construction. This was a ternary while there were two
 * kinds, which meant any third one would have been reported to a user as
 * "standalone server" — a wrong answer that reads as a plausible one, and
 * so survives. A lease written by a build newer than the reader still
 * falls through to the raw string rather than to someone else's name. */
export function hostKindLabel(hostKind: WorkspaceLeaseHostKind): string {
  return HOST_KIND_LABELS[hostKind] ?? String(hostKind);
}

export function describeWorkspaceLeaseConflict(conflict: WorkspaceLeaseConflict): string {
  const heartbeatAgeSeconds = Math.round(conflict.heartbeatAgeMs / 1000);
  // "git author" and not "user": the value is self-declared, and a
  // message that called it a user would read as an identity this system
  // had established.
  const author = conflict.author ? `, git author ${conflict.author}` : "";
  return (
    `Another OpenSpec UI host (${hostKindLabel(conflict.hostKind)} on ` +
    `${conflict.hostname}, pid ${conflict.pid}${author}, last active ${heartbeatAgeSeconds}s ago) ` +
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

/** Who holds a working directory right now, or `undefined` when nobody
 * does — a read that never takes it.
 *
 * Everything else here acquires: `acquireOrRenew` is the only way the
 * lease was readable, and calling it to find out who holds it would
 * take it from them where it had gone stale. A reporter has to be able
 * to look without touching, so this exists (ADR 0024).
 *
 * A lease whose heartbeat is older than the staleness window reads as
 * nobody: the holder is gone and only its file is left, which is
 * exactly what `acquireOrRenew` already treats as free. */
export async function readWorkspaceLeaseHolder(
  root: string,
  options: { staleAfterMs?: number } = {},
): Promise<WorkspaceLeaseConflict | undefined> {
  const filePath = path.join(path.resolve(root), ".openspec-ui", "workspace.lease.json");
  let document: WorkspaceLeaseDocument;
  try {
    document = JSON.parse(await readFile(filePath, "utf8")) as WorkspaceLeaseDocument;
  } catch {
    // Missing, or unreadable, or not JSON: all of them mean nobody is
    // holding it, which is what a corrupt lease already means to
    // `acquireOrRenew`.
    return undefined;
  }
  if (document.version !== WORKSPACE_LEASE_VERSION) return undefined;

  const heartbeatAgeMs = Date.now() - Date.parse(document.heartbeatAt);
  if (!Number.isFinite(heartbeatAgeMs)) return undefined;
  if (heartbeatAgeMs > (options.staleAfterMs ?? WORKSPACE_LEASE_STALE_AFTER_MS)) return undefined;

  return {
    hostKind: document.hostKind,
    hostname: document.hostname,
    pid: document.pid,
    heartbeatAgeMs,
    ...(document.author !== undefined ? { author: document.author } : {}),
  };
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
  private readonly author: string | undefined;

  constructor(root: string, options: WorkspaceLeaseManagerOptions) {
    this.filePath = path.join(path.resolve(root), ".openspec-ui", "workspace.lease.json");
    this.hostKind = options.hostKind;
    this.staleAfterMs = options.staleAfterMs ?? WORKSPACE_LEASE_STALE_AFTER_MS;
    this.author = options.author;
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
          conflict: {
            hostKind: existing.hostKind,
            hostname: existing.hostname,
            pid: existing.pid,
            heartbeatAgeMs,
            ...(existing.author !== undefined ? { author: existing.author } : {}),
          },
        };
      }
      await this.write();
      return {
        ok: true,
        reclaimedFrom: {
          hostKind: existing.hostKind,
          hostname: existing.hostname,
          pid: existing.pid,
          heartbeatAgeMs,
          ...(existing.author !== undefined ? { author: existing.author } : {}),
        },
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
      ...(this.author !== undefined ? { author: this.author } : {}),
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

/** What a body run under `withWorkspaceLease` is told about how it got
 * the lease. Absent `reclaimedFrom` is the ordinary case; present means
 * a previous holder had stopped renewing and this run took the workspace
 * from it, which a caller should surface rather than swallow. */
export interface WorkspaceLeaseHold {
  reclaimedFrom?: WorkspaceLeaseConflict;
}

export type WorkspaceLeaseOutcome<T> =
  | { ok: true; value: T; reclaimedFrom?: WorkspaceLeaseConflict }
  | { ok: false; conflict: WorkspaceLeaseConflict };

/** Holds the lease for exactly one async operation: acquire, renew on the
 * standard interval while `body` runs, release on the way out including
 * on throw.
 *
 * `WorkbenchProcessScheduler` deliberately keeps its own inline version of
 * this dance rather than calling here. It releases the lease when a run is
 * suspended and re-acquires it on resume, so its hold spans two disjoint
 * intervals of one process's life — which a helper bound to a single scope
 * cannot express. Two callers with genuinely different lifetimes, not a
 * duplication to be unified; the CLI's hold (ADR 0020) is a single scope
 * and this is the shape it needs.
 *
 * A conflicting live holder is reported, never thrown: the caller decides
 * how to say "another host has this workspace", and in the CLI's case that
 * is a refusal with its own exit code. */
export async function withWorkspaceLease<T>(
  lease: WorkspaceLeaseManager,
  body: (hold: WorkspaceLeaseHold) => Promise<T>,
  options: { renewIntervalMs?: number } = {},
): Promise<WorkspaceLeaseOutcome<T>> {
  const acquired = await lease.acquireOrRenew();
  if (!acquired.ok) return { ok: false, conflict: acquired.conflict };

  const renewIntervalMs = options.renewIntervalMs ?? WORKSPACE_LEASE_RENEW_INTERVAL_MS;
  const timer = setInterval(() => {
    // A failed renewal is not fatal here: the next one may succeed, and
    // the staleness window is a multiple of this interval. Losing the
    // lease outright is surfaced by whatever the body itself does, not by
    // aborting it mid-write.
    void lease.acquireOrRenew().catch(() => undefined);
  }, renewIntervalMs);
  // Never hold a process open on the heartbeat alone — a CLI that has
  // finished its run must exit, not wait for a timer.
  timer.unref?.();

  try {
    const value = await body({ reclaimedFrom: acquired.reclaimedFrom });
    return { ok: true, value, reclaimedFrom: acquired.reclaimedFrom };
  } finally {
    clearInterval(timer);
    // `release()` is already a no-op for a lease reclaimed away from this
    // holder, so a slow run that lost the workspace never deletes the
    // file its new owner wrote.
    await lease.release();
  }
}
