// A durable record of each process this host spawns through the shared
// adapters (spawnAndStream and the ACP session driver), so a later host can
// recognise a process it started before a restart without mistaking a reused
// PID for its own (ADR 0050).
//
// One file per process, written synchronously at spawn so a host restart
// cannot interrupt the write. Start time and exit time are added to that same
// file as they become known. The raw command line is never stored: arguments
// can carry a prompt or a secret, so only a SHA-256 hash is kept.

import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { readProcessStartTime, type StartTimeReader } from "./process-start-time.js";

export interface ProcessSnapshot {
  /** The run this process was started for, as the product names it. */
  runId: string;
  pid: number;
  /** The operating-system process creation time, or absent when it could not
   * be read. A process with no recorded start time is never eligible for a
   * kill, because its identity cannot be re-verified. */
  startTime?: string;
  executablePath: string;
  hostname: string;
  cwd: string;
  /** The change the run names, where the spawn knows one. */
  changeName?: string;
  commandLineHash: string;
  /** When this host recorded the spawn (its own clock). */
  spawnedAt: string;
  /** When the process closed, for a normal or observed exit. */
  exitedAt?: string;
}

/** A compact, secret-free fingerprint of a command line. It groups equal
 * invocations; it does not make one process instance unique — start time and
 * PID do that. */
export function commandLineHash(executable: string, args: readonly string[]): string {
  return createHash("sha256").update(`${executable}\u0000${args.join("\u0000")}`).digest("hex");
}

/** How many ledger files one host keeps before the oldest go. */
export const PROCESS_LEDGER_KEEP = 500;
/** How long an exited record is retained after its process closed. */
export const PROCESS_LEDGER_RETAIN_MS = 7 * 24 * 60 * 60 * 1000;

/** PID is per-machine, so a ledger is keyed by working directory and hostname. */
function ledgerDirectory(stateRoot: string, cwd: string, hostname: string): string {
  const cwdKey = createHash("sha256").update(path.resolve(cwd)).digest("hex");
  return path.join(stateRoot, "process-ledger", cwdKey, hostname);
}

/** The shared state root hosts opt into. Until a host sets this, the spawn
 * adapters record nothing, so tests that mock a spawn do not write real
 * ledger files into a developer's home directory. */
let processLedgerStateRoot: string | undefined;

export function setProcessLedgerStateRoot(root: string | undefined): void {
  processLedgerStateRoot = root === undefined ? undefined : path.resolve(root);
}

/** The ledger the spawn adapters use by default, or `undefined` while no
 * host has configured a shared state root. */
export function defaultProcessLedger(cwd: string): ProcessLedger | undefined {
  if (processLedgerStateRoot === undefined) return undefined;
  return ProcessLedger.defaultFor(cwd, processLedgerStateRoot);
}

export class ProcessLedger {
  constructor(readonly directory: string) {}

  /** The default ledger for a working directory, under the shared state root. */
  static defaultFor(cwd: string, stateRoot = path.join(os.homedir(), ".openspec-ui")): ProcessLedger {
    return new ProcessLedger(ledgerDirectory(stateRoot, cwd, os.hostname()));
  }

  /** Synchronously writes a spawn snapshot so it survives a host restart. */
  record(snapshot: ProcessSnapshot): void {
    mkdirSync(this.directory, { recursive: true });
    writeFileSync(this.fileFor(snapshot.runId, snapshot.pid), `${JSON.stringify(snapshot)}\n`, "utf8");
    this.prune();
  }

  setStartTime(runId: string, pid: number, startTime: string): void {
    const file = this.fileFor(runId, pid);
    const snapshot = this.read(file);
    if (snapshot === undefined) return;
    writeFileSync(file, `${JSON.stringify({ ...snapshot, startTime })}\n`, "utf8");
  }

  markExited(runId: string, pid: number, exitedAt: string): void {
    const file = this.fileFor(runId, pid);
    const snapshot = this.read(file);
    if (snapshot === undefined) return;
    writeFileSync(file, `${JSON.stringify({ ...snapshot, exitedAt })}\n`, "utf8");
  }

  list(): ProcessSnapshot[] {
    let names: string[];
    try { names = readdirSync(this.directory); } catch { return []; }
    return names
      .filter((name) => name.endsWith(".json"))
      .map((name) => this.read(path.join(this.directory, name)))
      .filter((snapshot): snapshot is ProcessSnapshot => snapshot !== undefined)
      .sort((left, right) => Date.parse(right.spawnedAt) - Date.parse(left.spawnedAt));
  }

  private fileFor(runId: string, pid: number): string {
    return path.join(this.directory, `${runId}-${pid}.json`);
  }

  private read(file: string): ProcessSnapshot | undefined {
    try {
      const snapshot = JSON.parse(readFileSync(file, "utf8")) as ProcessSnapshot;
      if (typeof snapshot.runId !== "string" || !Number.isSafeInteger(snapshot.pid)) return undefined;
      return snapshot;
    } catch {
      return undefined;
    }
  }

  private prune(): void {
    let names: string[];
    try { names = readdirSync(this.directory); } catch { return; }
    const now = Date.now();
    const kept: Array<{ file: string; mtime: number }> = [];
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      const file = path.join(this.directory, name);
      const snapshot = this.read(file);
      if (snapshot?.exitedAt !== undefined && now - Date.parse(snapshot.exitedAt) > PROCESS_LEDGER_RETAIN_MS) {
        rmSync(file, { force: true });
        continue;
      }
      kept.push({ file, mtime: statSync(file, { throwIfNoEntry: false })?.mtimeMs ?? 0 });
    }
    kept.sort((left, right) => right.mtime - left.mtime);
    for (const { file } of kept.slice(PROCESS_LEDGER_KEEP)) rmSync(file, { force: true });
  }
}

export interface ProcessSnapshotVerification {
  matches: boolean;
  reason?: string;
}

/** Re-reads the live operating-system identity of a PID and compares it to
 * the recorded snapshot before a kill may be issued. A mismatch means PID
 * reuse and is never terminated. */
export async function verifyProcessSnapshot(
  pid: number,
  snapshot: ProcessSnapshot,
  hostname = os.hostname(),
  readStart: StartTimeReader = readProcessStartTime,
): Promise<ProcessSnapshotVerification> {
  if (snapshot.hostname !== hostname) {
    return { matches: false, reason: `recorded on ${snapshot.hostname}, this host is ${hostname}` };
  }
  const live = await readStart(pid);
  if (live === undefined) {
    return { matches: false, reason: "the live process start time could not be read; refusing" };
  }
  if (snapshot.startTime === undefined) {
    return { matches: false, reason: "no start time was recorded for this process; refusing" };
  }
  const recorded = Date.parse(snapshot.startTime);
  if (!Number.isFinite(recorded)) {
    return { matches: false, reason: "the recorded start time is invalid" };
  }
  if (Math.abs(live.getTime() - recorded) > 1000) {
    return { matches: false, reason: "the live start time differs from the recorded one (PID reuse)" };
  }
  return { matches: true };
}

export interface TerminateLedgerResult {
  terminated: boolean;
  reason?: string;
}

/** Re-verifies a recorded snapshot against the operating system and only
 * then hands the PID to the supplied tree terminator. The terminator is
 * injected to keep this module free of a dependency on the agent spawn
 * helpers (which import this module). */
export async function terminateLedgerProcess(
  pid: number,
  snapshot: ProcessSnapshot,
  terminate: (pid: number) => Promise<{ attempted: boolean; reason?: string }>,
  options: { hostname?: string; readStart?: StartTimeReader } = {},
): Promise<TerminateLedgerResult> {
  const verification = await verifyProcessSnapshot(pid, snapshot, options.hostname, options.readStart);
  if (!verification.matches) return { terminated: false, reason: verification.reason };
  const outcome = await terminate(pid);
  if (!outcome.attempted) return { terminated: false, reason: outcome.reason };
  return { terminated: true };
}
