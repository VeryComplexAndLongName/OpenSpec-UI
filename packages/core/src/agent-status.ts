// What a run says it is doing — docs/adr/0028-agents-coordinate-beside-the-repository.md.
//
// A hung agent renews its lease exactly as a working one does, so
// liveness is already answered and answers nothing about a hang.
// What is missing is progress: what a run says it is doing, and how
// long it has been saying it. A run this host started already streams
// its events; a session started elsewhere has nobody listening. So the
// run writes, and anybody reads — the shape the workspace lease already
// has, extended with one more file per run rather than a second lease.

import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { readAcpStreamedText } from "./acp-streamed-text.js";
import { describeAcpUpdate } from "./acp-update-line.js";
import { createGitWrapper, type GitWrapper } from "./git.js";
import { TASK_NUMBER_PATTERN } from "./harness-step-agent.js";
import type { Command, Event } from "./protocol.js";
import { readTaskMarker, type RecordedTask } from "./task-marker.js";
import { resolveWorktreeRoot, type WorktreeRootSources } from "./worktree-root.js";
import { WORKSPACE_LEASE_RENEW_INTERVAL_MS, WORKSPACE_LEASE_STALE_AFTER_MS } from "./workspace-lease.js";

export const AGENT_STATUS_VERSION = 1;

/** The lease's own cadence and window, reused rather than redefined —
 * "gone" must mean one thing, not two that can disagree. */
export const AGENT_STATUS_RENEW_INTERVAL_MS = WORKSPACE_LEASE_RENEW_INTERVAL_MS;
export const AGENT_STATUS_STALE_AFTER_MS = WORKSPACE_LEASE_STALE_AFTER_MS;

/** How often, at most, a run's streamed output rewrites its record.
 *
 * An agent can print many lines a second, and each rewrite is a
 * directory creation, a write, a rename and a removal. What a person reads
 * the record for — what a run last said, and how long ago — is not
 * sharpened by writing it more often than once a second. */
export const AGENT_STATUS_STREAM_WRITE_INTERVAL_MS = 1_000;

const LINE_BREAK = String.fromCharCode(10);

/** The most of an unfinished line a stream is allowed to hold. A stream
 * that never breaks a line — one long JSON document, say — must not grow
 * a buffer without end for the sake of a status line. */
const OPEN_LINE_LIMIT = 4_096;

/** Where every run of a repository writes its own status file: beside
 * every working directory of that repository, inside none of them, so
 * removing one never takes the record with it.
 *
 * `<worktreeRoot>/<repository>/` is ADR 0027's own container for that
 * repository's working directories — never a working directory itself —
 * so a directory beside them there is outside every one of them,
 * including the repository's own primary checkout, which sits elsewhere
 * entirely. */
export function agentStatusDirectory(worktreeRoot: string, repositoryRoot: string): string {
  return path.join(path.resolve(worktreeRoot), path.basename(path.resolve(repositoryRoot)), ".agent-status");
}

/** What a run is waiting on, where it is waiting rather than working. A
 * field rather than a phrase, so no reader has to parse words to learn it
 * (a-run-says-which-task-it-is-on). */
export type AgentStatusWaiting =
  | { kind: "checkpoint"; stage: string; nextStage: string }
  | { kind: "permission"; description: string };

export interface AgentStatusDocument {
  version: typeof AGENT_STATUS_VERSION;
  /** The run's own identifier, generated at startup and shared with
   * nobody — the device `WorkspaceLeaseManager` already uses for
   * `holderId`. Never a person's identity: one person routinely runs
   * two agents at once, and a person-named file would have them write
   * to one. Repeated here (rather than trusted from the file name)
   * because nothing prevents a process from writing a file it does not
   * own; a mismatch is a finding, not silence. */
  instanceId: string;
  /** What the run is currently doing, in a person's words. */
  activity: string;
  /** The harness stage it is in, if it is running one; `null` outside a
   * chain (a plain `apply`/`review` run, for instance). */
  stage: string | null;
  /** Which change this run is working on, if any. */
  changeName: string | null;
  /** The working directory this run is acting in. */
  workingDirectory: string;
  /** When `activity` last changed — never touched by a heartbeat alone,
   * so this is genuinely "since it last said something new". */
  activityAt: string;
  /** Renewed on every write; a heartbeat older than the staleness
   * window means the writer is gone. */
  heartbeatAt: string;
  /** The run id a host uses to cancel or answer this run. Not the
   * `instanceId`, which the run generated for itself and shares with
   * nobody. `null` in a record written before runs recorded it. */
  runId: string | null;
  /** The task the run is on: by the agent's own marker line, or, for a run
   * started for one task, the task it was given. */
  task: RecordedTask | null;
  /** What the run is waiting on, where it is waiting. */
  waiting: AgentStatusWaiting | null;
}

export interface AgentStatusWriterOptions {
  directory: string;
  workingDirectory: string;
  changeName?: string | null;
  /** The run id of the command this record is for. */
  runId?: string | null;
  /** The task a run was started for (`Command.taskNumber`). Recorded from
   * the first write, and never replaced by a marker. */
  taskNumber?: string;
  /** Test seam: the writer's own identity would otherwise always be a
   * fresh random one. */
  instanceId?: string;
  /** Test seam. */
  now?: () => Date;
  /** Test seam: the file operations a write makes, so a test can refuse
   * one on demand instead of hoping Windows will. */
  files?: AgentStatusFileOperations;
}

/** The file operations a writer makes. */
export interface AgentStatusFileOperations {
  mkdir(directory: string, options: { recursive: true }): Promise<unknown>;
  writeFile(filePath: string, data: string, encoding: "utf8"): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  rm(filePath: string, options: { force: true }): Promise<void>;
}

const NODE_FILE_OPERATIONS: AgentStatusFileOperations = { mkdir, writeFile, rename, rm };

/** What Windows answers while a name is in use for a moment — by another
 * handle, an indexer, a scanner — and what passes when asked again
 * (a-status-write-never-stops-a-run). */
const IN_USE_CODES: ReadonlySet<string> = new Set(["EPERM", "EACCES", "EBUSY"]);

/** Five tries, pausing 25, 50, 75 and 100 ms between them: a quarter of a
 * second in all, a small part of a renewal interval. */
const IN_USE_ATTEMPTS = 5;
const IN_USE_PAUSE_STEP_MS = 25;

function errorCode(error: unknown): string | undefined {
  return error instanceof Error && "code" in error ? (error as NodeJS.ErrnoException).code : undefined;
}

/** Runs a file operation, asking again while its name is only in use. */
async function retryWhileInUse(operation: () => Promise<void>): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await operation();
      return;
    } catch (error) {
      const code = errorCode(error);
      if (code === undefined || !IN_USE_CODES.has(code) || attempt >= IN_USE_ATTEMPTS) throw error;
      await new Promise<void>((resolve) => setTimeout(resolve, IN_USE_PAUSE_STEP_MS * attempt));
    }
  }
}

function sameWaiting(a: AgentStatusWaiting | null, b: AgentStatusWaiting | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** One run's handle on its own status file. Never touches another
 * run's file — there is exactly one file per instance, named by its own
 * `instanceId`.
 *
 * Reporting never stops the run it reports on: every write waits its
 * turn, and only the first record's failure reaches a caller. */
export class AgentStatusWriter {
  readonly instanceId: string;
  readonly filePath: string;
  private readonly directory: string;
  private readonly workingDirectory: string;
  private changeName: string | null;
  private readonly runId: string | null;
  private stage: string | null = null;
  private activity = "";
  private activityAt: string;
  private task: RecordedTask | null;
  private waiting: AgentStatusWaiting | null = null;
  private readonly now: () => Date;
  private readonly files: AgentStatusFileOperations;
  private timer: NodeJS.Timeout | undefined;
  private stopped = false;
  /** When the record was last written, and whether it holds everything
   * reported since — so streamed activity can wait for the next write
   * instead of forcing one. */
  private lastWrittenAtMs = Number.NEGATIVE_INFINITY;
  private unwritten = false;
  /** Every write, one after another, so two never rename onto the record
   * at once. Never rejects: each write settles its own failure. */
  private queue: Promise<void> = Promise.resolve();

  constructor(options: AgentStatusWriterOptions) {
    this.instanceId = options.instanceId ?? randomUUID();
    this.directory = path.resolve(options.directory);
    this.workingDirectory = path.resolve(options.workingDirectory);
    this.changeName = options.changeName ?? null;
    this.runId = options.runId ?? null;
    this.now = options.now ?? (() => new Date());
    this.files = options.files ?? NODE_FILE_OPERATIONS;
    this.filePath = path.join(this.directory, `${this.instanceId}.json`);
    this.activityAt = this.now().toISOString();
    this.task = options.taskNumber !== undefined
      ? { number: options.taskNumber, source: "command", since: this.activityAt }
      : null;
  }

  /** Writes the first record and starts renewing it on the lease's own
   * interval.
   *
   * The first record is the one write whose failure reaches the caller: a
   * writer whose record never landed is not handed to a run
   * (`startAgentStatusWriter`), which then goes unreported rather than
   * half-reported. */
  async start(initialActivity = "starting"): Promise<void> {
    this.activity = initialActivity;
    this.activityAt = this.now().toISOString();
    // What runs that will never write again left behind goes before this
    // run adds its own (a-stale-status-is-swept). A sweep that fails is no
    // reason for this run to go unreported.
    await sweepAgentStatuses(this.directory, { now: this.now }).catch(() => undefined);
    await this.enqueue();
    this.timer = setInterval(() => {
      // `writeQuietly` never rejects. A rejection left unhandled here is
      // what ended a run on Windows.
      void this.writeQuietly();
    }, AGENT_STATUS_RENEW_INTERVAL_MS);
    // Never hold a process open on the heartbeat alone.
    this.timer.unref?.();
  }

  /** Records what the run is doing now. `activityAt` only moves when
   * the text actually changes, so silence under an unchanged activity is
   * visible rather than hidden behind a heartbeat that keeps ticking.
   * Resolves once the write has landed or been dropped; never rejects. */
  async reportActivity(activity: string, stage?: string | null): Promise<void> {
    this.setActivity(activity);
    if (stage !== undefined) this.stage = stage;
    await this.writeQuietly();
  }

  /** Records activity from a stream that may speak many times a second.
   *
   * The record is rewritten at most once per
   * `AGENT_STATUS_STREAM_WRITE_INTERVAL_MS`; an activity noted in between
   * reaches the disk with the next write — the next streamed line past
   * the interval, a stage change, or the heartbeat, whichever comes
   * first. `activityAt` is still the moment the activity changed, not the
   * moment it was written. Never rejects. */
  async noteStreamedActivity(activity: string): Promise<void> {
    if (activity !== this.activity) {
      this.setActivity(activity);
      this.unwritten = true;
    }
    if (this.unwritten && this.now().getTime() - this.lastWrittenAtMs >= AGENT_STATUS_STREAM_WRITE_INTERVAL_MS) {
      await this.writeQuietly();
    }
  }

  /** Records the task the run says it is on, and writes at once: a marker
   * is rare, and the once-a-second limit keeps only the newest text, so the
   * line after a marker would take it with it.
   *
   * A run started for one task keeps that task. A marker naming another
   * says the run has left the item it was given, and the record keeps
   * saying what it was asked to do, as its audit entry does. Never
   * rejects. */
  async reportTask(number: string, source: RecordedTask["source"]): Promise<void> {
    if (this.task?.source === "command" && source === "agent") return;
    if (this.task?.number === number && this.task.source === source) return;
    this.task = { number, source, since: this.now().toISOString() };
    await this.writeQuietly();
  }

  /** Records what the run is waiting on, or that it is no longer waiting,
   * and writes at once when that changed. `activity`, when given, is set in
   * the same write. Never rejects. */
  async reportWaiting(waiting: AgentStatusWaiting | null, activity?: string): Promise<void> {
    const waitingChanged = !sameWaiting(this.waiting, waiting);
    const activityChanged = activity !== undefined && activity !== this.activity;
    if (!waitingChanged && !activityChanged) return;
    this.waiting = waiting;
    if (activity !== undefined) this.setActivity(activity);
    await this.writeQuietly();
  }

  setChangeName(changeName: string | null): void {
    this.changeName = changeName;
  }

  /** Removes the record. Called on a clean end; a crash removes
   * nothing, which is what the staleness window is for.
   *
   * Waits for a write already under way, which would otherwise put the
   * record back after it was removed; a write queued behind it writes
   * nothing. A removal that still cannot be made is left to the staleness
   * window rather than told to the run. */
  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    await this.queue;
    await retryWhileInUse(() => this.files.rm(this.filePath, { force: true })).catch(() => undefined);
  }

  private setActivity(activity: string): void {
    if (activity !== this.activity) this.activityAt = this.now().toISOString();
    this.activity = activity;
  }

  /** Queues one write behind whatever write is under way. The returned
   * promise settles as this write does; the queue carries on either way. */
  private enqueue(): Promise<void> {
    const write = this.queue.then(() => this.writeNow());
    this.queue = write.catch(() => undefined);
    return write;
  }

  /** A write whose failure concerns nobody but the record: the previous
   * record stands, and the next renewal tries again. */
  private async writeQuietly(): Promise<void> {
    await this.enqueue().catch(() => undefined);
  }

  /** Builds the document when the write runs, not when it was asked for,
   * so a write that waited its turn never puts back what the one before
   * it replaced. */
  private async writeNow(): Promise<void> {
    if (this.stopped) return;
    const nowIso = this.now().toISOString();
    // Taken before the first await, so a write already under way counts
    // for anything noted while it is in flight.
    this.lastWrittenAtMs = this.now().getTime();
    this.unwritten = false;
    const document: AgentStatusDocument = {
      version: AGENT_STATUS_VERSION,
      instanceId: this.instanceId,
      activity: this.activity,
      stage: this.stage,
      changeName: this.changeName,
      workingDirectory: this.workingDirectory,
      activityAt: this.activityAt,
      heartbeatAt: nowIso,
      runId: this.runId,
      task: this.task,
      waiting: this.waiting,
    };
    await this.files.mkdir(this.directory, { recursive: true });
    const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`;
    try {
      await this.files.writeFile(temporaryPath,`${JSON.stringify(document, null, 2)}\n`, "utf8");
      await this.replaceRecord(temporaryPath);
    } finally {
      // Already gone after a rename that landed. One left by a write that
      // could not land goes here, or to a-stale-status-is-swept.
      await this.files.rm(temporaryPath, { force: true }).catch(() => undefined);
    }
  }

  /** Renames the written temporary file onto the record. A replace refused
   * as in use is asked again rather than made room for: removing the record
   * first left a live run without one, and did not help while the name was
   * in use. Only a filesystem that will not replace a name at all
   * (`EEXIST`) gets remove-then-rename, since asking again cannot help
   * there. */
  private async replaceRecord(temporaryPath: string): Promise<void> {
    try {
      await retryWhileInUse(() => this.files.rename(temporaryPath, this.filePath));
    } catch (error) {
      if (errorCode(error) !== "EEXIST") throw error;
      await this.files.rm(this.filePath, { force: true });
      await this.files.rename(temporaryPath, this.filePath);
    }
  }
}

/** One run, as read back from its file. Deliberately carries no
 * verdict: `gone` is the same staleness fact `readWorkspaceLeaseHolder`
 * already reports for a lease, and nothing here says stuck, hung or
 * unhealthy — a long turn and a hang produce the same silence, and
 * telling them apart is a person's judgement. */
export interface AgentStatusReport {
  instanceId: string;
  activity: string;
  stage: string | null;
  changeName: string | null;
  workingDirectory: string;
  /** Milliseconds since `activity` last changed. */
  activitySinceMs: number;
  /** Milliseconds since the last heartbeat. */
  heartbeatAgeMs: number;
  /** The record's own timestamps, as written. The two ages above are
   * measured at read time; a reader that shows a picture for longer than
   * a moment counts from these instead (the-pipeline-opens-in-vs-code). */
  activityAt: string;
  heartbeatAt: string;
  /** The heartbeat is older than the staleness window: the writer is
   * gone, by the same rule the workspace lease already uses. */
  gone: boolean;
  /** As the record holds them; `null` where the record has none, or one
   * that is not well-formed. */
  runId: string | null;
  task: RecordedTask | null;
  waiting: AgentStatusWaiting | null;
}

/** A record that could not be trusted as-is: unreadable, not JSON,
 * missing a required field, or found under an identity that does not
 * match its own file name. Reported rather than silently dropped, and
 * never taken as another run's record. */
export interface AgentStatusMalformed {
  fileName: string;
  reason: string;
}

export interface AgentStatusReadResult {
  reports: AgentStatusReport[];
  malformed: AgentStatusMalformed[];
}

function isMissingPath(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
}

/** A task field as a record holds it, or `null`. A field a reader does not
 * recognise is read as absent: a record from before the field existed, or
 * one written wrongly, still says what else it says. */
function readRecordedTask(value: unknown): RecordedTask | null {
  if (typeof value !== "object" || value === null) return null;
  const task = value as Record<string, unknown>;
  if (typeof task.number !== "string" || !TASK_NUMBER_PATTERN.test(task.number)) return null;
  if (task.source !== "agent" && task.source !== "command") return null;
  if (typeof task.since !== "string") return null;
  return { number: task.number, source: task.source, since: task.since };
}

function readWaiting(value: unknown): AgentStatusWaiting | null {
  if (typeof value !== "object" || value === null) return null;
  const waiting = value as Record<string, unknown>;
  if (waiting.kind === "checkpoint" && typeof waiting.stage === "string" && typeof waiting.nextStage === "string") {
    return { kind: "checkpoint", stage: waiting.stage, nextStage: waiting.nextStage };
  }
  if (waiting.kind === "permission" && typeof waiting.description === "string") {
    return { kind: "permission", description: waiting.description };
  }
  return null;
}

/** One record as every reader judges it: a run's report, a record that
 * cannot be trusted, or a file that went away between being listed and
 * being read. */
type AgentStatusRecordReading =
  | { kind: "report"; report: AgentStatusReport }
  | { kind: "malformed"; reason: string }
  | { kind: "missing" };

async function readAgentStatusRecord(
  directory: string,
  fileName: string,
  now: () => Date,
  staleAfterMs: number,
): Promise<AgentStatusRecordReading> {
  const filePath = path.join(directory, fileName);
  const expectedId = fileName.slice(0, -".json".length);
  try {
    const raw = await readFile(filePath, "utf8");
    let document: Partial<Record<keyof AgentStatusDocument, unknown>>;
    try {
      document = JSON.parse(raw) as Partial<Record<keyof AgentStatusDocument, unknown>>;
    } catch {
      return { kind: "malformed", reason: "not valid JSON" };
    }
    if (
      typeof document.instanceId !== "string" ||
      typeof document.activity !== "string" ||
      typeof document.workingDirectory !== "string" ||
      typeof document.activityAt !== "string" ||
      typeof document.heartbeatAt !== "string"
    ) {
      return { kind: "malformed", reason: "missing or invalid required fields" };
    }
    if (document.instanceId !== expectedId) {
      return {
        kind: "malformed",
        reason: `record identity "${document.instanceId}" does not match file name "${expectedId}"`,
      };
    }
    const activitySinceMs = now().getTime() - Date.parse(document.activityAt);
    const heartbeatAgeMs = now().getTime() - Date.parse(document.heartbeatAt);
    if (!Number.isFinite(activitySinceMs) || !Number.isFinite(heartbeatAgeMs)) {
      return { kind: "malformed", reason: "activityAt or heartbeatAt is not a valid timestamp" };
    }
    return {
      kind: "report",
      report: {
        instanceId: document.instanceId,
        activity: document.activity,
        stage: typeof document.stage === "string" ? document.stage : null,
        changeName: typeof document.changeName === "string" ? document.changeName : null,
        workingDirectory: document.workingDirectory,
        activitySinceMs,
        heartbeatAgeMs,
        activityAt: document.activityAt,
        heartbeatAt: document.heartbeatAt,
        gone: heartbeatAgeMs > staleAfterMs,
        runId: typeof document.runId === "string" ? document.runId : null,
        task: readRecordedTask(document.task),
        waiting: readWaiting(document.waiting),
      },
    };
  } catch (error) {
    // A file `readdir` just listed can vanish before it is read: a writer
    // on a filesystem that will not replace a name removes the destination
    // before renaming onto it, and a sweep removes records. That is a race
    // this design survives, not a malformed record — the same reasoning
    // `readWorkspaceLeaseHolder` already applies to a lease that goes
    // missing between being listed and being read.
    if (isMissingPath(error)) return { kind: "missing" };
    return { kind: "malformed", reason: error instanceof Error ? error.message : String(error) };
  }
}

/** Every run's status in one repository, read as a pure function over
 * its directory: the same answer for the CLI, the standalone shell, and
 * anything else that asks. A repository with nothing running reads as
 * an empty list, not an error. Reading never removes anything; that is
 * `sweepAgentStatuses`. */
export async function readAgentStatuses(
  directory: string,
  options: { now?: () => Date; staleAfterMs?: number } = {},
): Promise<AgentStatusReadResult> {
  const now = options.now ?? (() => new Date());
  const staleAfterMs = options.staleAfterMs ?? AGENT_STATUS_STALE_AFTER_MS;
  const reports: AgentStatusReport[] = [];
  const malformed: AgentStatusMalformed[] = [];

  let entries: string[];
  try {
    entries = await readdir(directory);
  } catch (error) {
    if (isMissingPath(error)) return { reports, malformed };
    throw error;
  }

  for (const fileName of entries) {
    if (!fileName.endsWith(".json")) continue;
    const reading = await readAgentStatusRecord(directory, fileName, now, staleAfterMs);
    if (reading.kind === "report") reports.push(reading.report);
    else if (reading.kind === "malformed") malformed.push({ fileName, reason: reading.reason });
  }

  return { reports, malformed };
}

/** What a sweep removed, by file name, so a caller can say so. */
export interface AgentStatusSweepResult {
  /** Records whose writers are gone: past the staleness window, and still
   * past it when read again immediately before removal. */
  removedRecords: string[];
  /** Temporary files a write that never finished left behind. */
  removedTemporaryFiles: string[];
}

export interface AgentStatusSweepOptions {
  now?: () => Date;
  staleAfterMs?: number;
  /** Test seam: runs between finding a record stale and reading it again,
   * which is where a slow writer's renewal can land. */
  beforeReread?: (fileName: string) => Promise<void>;
}

/** Removes what nobody will write again — a-stale-status-is-swept.
 *
 * A record is removed only when, read again immediately before removal,
 * its heartbeat is still past the window: a writer that was slow, not
 * dead, keeps its record. A temporary `<id>.json.<uuid>.tmp` goes once it
 * is older than the same window. A malformed record is never removed — it
 * is evidence, and the reader keeps reporting it. Nothing in a record is
 * worth collecting first: a status record holds only the present, and a
 * run's history is in the audit log already.
 *
 * Separate from `readAgentStatuses`, which stays a pure function. */
export async function sweepAgentStatuses(
  directory: string,
  options: AgentStatusSweepOptions = {},
): Promise<AgentStatusSweepResult> {
  const now = options.now ?? (() => new Date());
  const staleAfterMs = options.staleAfterMs ?? AGENT_STATUS_STALE_AFTER_MS;
  const result: AgentStatusSweepResult = { removedRecords: [], removedTemporaryFiles: [] };

  let entries: string[];
  try {
    entries = await readdir(directory);
  } catch (error) {
    if (isMissingPath(error)) return result;
    throw error;
  }

  for (const fileName of entries) {
    const filePath = path.join(directory, fileName);
    if (fileName.endsWith(".json")) {
      const first = await readAgentStatusRecord(directory, fileName, now, staleAfterMs);
      if (first.kind !== "report" || !first.report.gone) continue;
      await options.beforeReread?.(fileName);
      const again = await readAgentStatusRecord(directory, fileName, now, staleAfterMs);
      if (again.kind !== "report" || !again.report.gone) continue;
      if (await removeIfStillThere(filePath)) result.removedRecords.push(fileName);
    } else if (fileName.includes(".json.") && fileName.endsWith(".tmp")) {
      let modifiedAtMs: number;
      try {
        modifiedAtMs = (await stat(filePath)).mtimeMs;
      } catch {
        continue;
      }
      if (now().getTime() - modifiedAtMs <= staleAfterMs) continue;
      if (await removeIfStillThere(filePath)) result.removedTemporaryFiles.push(fileName);
    }
  }

  return result;
}

/** Removes a file that another sweep, or its writer, may be touching at
 * the same moment. Already gone is another sweep's work; in use for a
 * moment is the next sweep's. Neither is an error. */
async function removeIfStillThere(filePath: string): Promise<boolean> {
  try {
    await rm(filePath);
    return true;
  } catch (error) {
    const code = errorCode(error);
    if (code === "ENOENT" || (code !== undefined && IN_USE_CODES.has(code))) return false;
    throw error;
  }
}

/** Where a run's status belongs, resolved the same way every reader of a
 * repository's working directories already resolves it (`change-
 * worktrees.ts`): from the main working tree — the one that holds every
 * branch a change was cut from — rather than from whichever working
 * directory this particular run happens to be in. A run started inside
 * a change's own worktree and one started from the main checkout must
 * land in the same shared directory, not two. */
export async function resolveAgentStatusDirectory(
  git: Pick<GitWrapper, "worktreeList">,
  repositoryRoot: string,
  rootSources: WorktreeRootSources = {},
): Promise<string> {
  const worktrees = await git.worktreeList();
  const mainPath = worktrees[0]?.path ?? repositoryRoot;
  const { root } = await resolveWorktreeRoot(mainPath, rootSources);
  return agentStatusDirectory(root, mainPath);
}

/** The completed non-empty lines of a piece of text, trimmed. */
function nonEmptyLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** What each stream has said since its last line break. A chunk is cut
 * wherever its producer flushed — mid-line, often mid-word — so the last
 * line of a chunk is a fragment until the break that ends it arrives.
 *
 * An agent's reply and its reasoning are kept apart: a reasoning chunk must
 * never complete a line the reply began, since only the reply can name a
 * task (a-run-says-which-task-it-is-on). */
interface OpenLines {
  stdout: string;
  reply: string;
  reasoning: string;
}

function openLines(): OpenLines {
  return { stdout: "", reply: "", reasoning: "" };
}

/** Adds a chunk to what its stream left open, and returns every line the
 * chunk completed. The activity is the last of them; each is read for a
 * marker, because a message that arrives whole carries its marker ahead of
 * the lines that follow it. */
function takeCompleteLines(open: OpenLines, stream: keyof OpenLines, chunk: string): string[] {
  const text = open[stream] + chunk;
  const lastBreak = text.lastIndexOf(LINE_BREAK);
  if (lastBreak === -1) {
    open[stream] = text.slice(-OPEN_LINE_LIMIT);
    return [];
  }
  open[stream] = text.slice(lastBreak + 1).slice(-OPEN_LINE_LIMIT);
  return nonEmptyLines(text.slice(0, lastBreak));
}

/** Whatever the streams left unfinished, taken as said once something
 * else happens: a reply that ends without a line break is still what the
 * run last said. The reply first, then reasoning, then stdout. Clears all
 * three. */
function takeOpenLines(open: OpenLines): { line: string; stream: keyof OpenLines } | undefined {
  let taken: { line: string; stream: keyof OpenLines } | undefined;
  for (const stream of ["reply", "reasoning", "stdout"] as const) {
    const line = nonEmptyLines(open[stream]).at(-1);
    if (taken === undefined && line !== undefined) taken = { line, stream };
    open[stream] = "";
  }
  return taken;
}

/** Tells the writer about every marker among `lines`, in order, so the
 * latest one wins. */
async function reportMarkers(writer: AgentStatusWriter, lines: readonly string[]): Promise<void> {
  for (const line of lines) {
    const number = readTaskMarker(line);
    if (number !== undefined) await writer.reportTask(number, "agent");
  }
}

/** Taps a chain or agent run's own event stream into its status record,
 * yielding every event through unchanged. This is the one place that
 * turns "what a run reports about itself" into "what its record says it
 * is doing" (see `packages/core` owning all business logic, ADR 0001).
 * Hosts do not call it directly: they wrap their run loop with
 * `withAgentStatus`, which starts the record and calls this.
 *
 * The record is removed only when the run ends cleanly
 * (`completed`/`failed`/`cancelled` — the run said how it ended).
 * Anything else — a crash, a killed process, a stream that simply stops
 * — leaves the record for the staleness window to cover, exactly as a
 * crashed host leaves its workspace lease. */
export async function* reportEventsToAgentStatus(
  events: AsyncIterable<Event>,
  writer: AgentStatusWriter,
): AsyncGenerator<Event> {
  const open = openLines();
  for await (const event of events) {
    await applyEventToAgentStatus(writer, event, open);
    yield event;
  }
}

async function applyEventToAgentStatus(writer: AgentStatusWriter, event: Event, open: OpenLines): Promise<void> {
  // Waiting ends with whatever the run does next.
  if (event.kind === "checkpoint") {
    await writer.reportWaiting(
      { kind: "checkpoint", stage: event.stage, nextStage: event.nextStage },
      `waiting to continue to ${event.nextStage}`,
    );
    return;
  }
  if (event.kind === "permissionRequest") {
    await writer.reportWaiting({ kind: "permission", description: event.description });
    return;
  }
  await writer.reportWaiting(null);

  if (event.kind === "stdout") {
    const lines = takeCompleteLines(open, "stdout", event.chunk);
    await reportMarkers(writer, lines);
    const last = lines.at(-1);
    if (last !== undefined) await writer.noteStreamedActivity(last);
    return;
  }
  const streamed = event.kind === "agentUpdate" ? readAcpStreamedText(event.update) : undefined;
  if (streamed !== undefined) {
    // Reasoning says "I'll start task 2.3 after this" long before the
    // agent starts it. Only the reply names a task.
    const stream = streamed.kind === "agent_thought_chunk" ? "reasoning" : "reply";
    const lines = takeCompleteLines(open, stream, streamed.text);
    if (stream === "reply") await reportMarkers(writer, lines);
    const last = lines.at(-1);
    if (last !== undefined) await writer.noteStreamedActivity(last);
    return;
  }

  const unfinished = takeOpenLines(open);
  if (unfinished !== undefined) {
    if (unfinished.stream !== "reasoning") await reportMarkers(writer, [unfinished.line]);
    await writer.noteStreamedActivity(unfinished.line);
  }

  if (event.kind === "agentUpdate") {
    // A tool call, a failed one, a plan: the line every surface shows for
    // it, read by the same core reader, so the record says `Bash: npm test`
    // exactly where the terminal does. An update that says nothing leaves
    // the activity as it was. Noted like streamed output, because an agent
    // can make several calls a second. Never read for a marker: a tool
    // call's title is not the agent speaking.
    const line = describeAcpUpdate(event.update);
    if (line !== undefined) await writer.noteStreamedActivity(line);
    return;
  }

  switch (event.kind) {
    case "stageStarted":
      await writer.reportActivity(`running ${event.stage}`, event.stage);
      return;
    case "stageCompleted":
      await writer.reportActivity(`running ${event.nextStage}`, event.nextStage);
      return;
    case "progress":
      await writer.reportActivity(event.message);
      return;
    case "completed":
    case "failed":
    case "cancelled":
      await writer.stop();
      return;
    default:
      return;
  }
}

/** Where a host's run reports, and what it is running. */
export interface AgentStatusRunOptions {
  /** The run's working directory. */
  cwd: string;
  changeName: string | null;
  /** The command's run id. */
  runId?: string | null;
  /** The task the command was started for. */
  taskNumber?: string;
  /** Test seam: resolves the shared status directory for `cwd`. */
  resolveDirectory?: (cwd: string) => Promise<string>;
}

const statusDirectoryByWorkspace = new Map<string, Promise<string>>();

/** The shared status directory for a working directory, resolved once
 * per directory for the life of the process. A host serving many runs
 * against one checkout would otherwise start a `git worktree list` for
 * every run. A failed resolution is forgotten, so the next run tries
 * again rather than inheriting the failure. */
function cachedAgentStatusDirectory(cwd: string): Promise<string> {
  const key = path.resolve(cwd);
  let cached = statusDirectoryByWorkspace.get(key);
  if (!cached) {
    cached = (async () => await resolveAgentStatusDirectory(createGitWrapper({ cwd: key }), key))();
    statusDirectoryByWorkspace.set(key, cached);
    cached.catch(() => statusDirectoryByWorkspace.delete(key));
  }
  return cached;
}

/** Starts a run's status record, best-effort: reporting progress must
 * never be why a run fails. `undefined` when no record could be started —
 * a directory that is not a git repository, an unreadable settings file —
 * and the run goes on exactly as it would have without one. */
export async function startAgentStatusWriter(options: AgentStatusRunOptions): Promise<AgentStatusWriter | undefined> {
  try {
    const directory = await (options.resolveDirectory ?? cachedAgentStatusDirectory)(options.cwd);
    const writer = new AgentStatusWriter({
      directory,
      workingDirectory: options.cwd,
      changeName: options.changeName,
      runId: options.runId ?? null,
      ...(options.taskNumber !== undefined ? { taskNumber: options.taskNumber } : {}),
    });
    await writer.start(options.changeName ? `starting "${options.changeName}"` : "starting");
    return writer;
  } catch {
    return undefined;
  }
}

/** The command kinds that are a run — an agent's or a chain's — and so
 * keep a status record. The rest — reading a change, a cancel, the answer
 * to a checkpoint — do no work of their own to report, and a record
 * started for one would never be ended by a terminal event of its own. */
const REPORTED_COMMAND_KINDS: ReadonlySet<Command["kind"]> = new Set<Command["kind"]>([
  "plan",
  "implement",
  "review",
  "verify",
  "chain",
]);

/** A command's events, with its status record kept alongside — the one
 * wrapper every host (the CLI, the standalone server, the VS Code
 * extension) puts around its own run loop, so none of them carries a copy
 * of the fallback or the mapping. A command that is not a run passes
 * through untouched.
 *
 * The record starts as the run starts, and neither the run nor its events
 * ever wait for it: finding the directory can take a git subprocess, and a
 * run is not held back for a diagnostic about itself. Each event is queued
 * behind the record's start and told to it, in order, as soon as the
 * record exists — not when the next event happens to arrive, since a run
 * that goes quiet after its first events is exactly the run a person reads
 * the record for. A run that ends first still removes the record it
 * started: the wrapper finishes only after the queue has.
 *
 * Every host passes the command it runs, so the record carries its run id
 * and the task it was started for (a-run-says-which-task-it-is-on). */
export async function* withAgentStatus(
  events: AsyncIterable<Event>,
  command: Pick<Command, "kind" | "cwd" | "context" | "runId" | "taskNumber">,
  seams: Pick<AgentStatusRunOptions, "resolveDirectory"> = {},
): AsyncGenerator<Event> {
  if (!REPORTED_COMMAND_KINDS.has(command.kind)) {
    yield* events;
    return;
  }
  const changeName = path.basename(command.context.changeDir) || null;
  const open = openLines();
  let reporting = startAgentStatusWriter({
    cwd: command.cwd,
    changeName,
    runId: command.runId,
    ...(command.taskNumber !== undefined ? { taskNumber: command.taskNumber } : {}),
    ...seams,
  });

  for await (const event of events) {
    reporting = reporting.then(async (writer) => {
      // Best-effort, event by event: a record that cannot be written this
      // time must not stop the next event from being told to it.
      if (writer) await applyEventToAgentStatus(writer, event, open).catch(() => undefined);
      return writer;
    });
    yield event;
  }

  await reporting;
}
