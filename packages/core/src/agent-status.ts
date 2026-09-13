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
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { readAcpStreamedText } from "./acp-streamed-text.js";
import type { GitWrapper } from "./git.js";
import type { Event } from "./protocol.js";
import { resolveWorktreeRoot, type WorktreeRootSources } from "./worktree-root.js";
import { WORKSPACE_LEASE_RENEW_INTERVAL_MS, WORKSPACE_LEASE_STALE_AFTER_MS } from "./workspace-lease.js";

export const AGENT_STATUS_VERSION = 1;

/** The lease's own cadence and window, reused rather than redefined —
 * "gone" must mean one thing, not two that can disagree. */
export const AGENT_STATUS_RENEW_INTERVAL_MS = WORKSPACE_LEASE_RENEW_INTERVAL_MS;
export const AGENT_STATUS_STALE_AFTER_MS = WORKSPACE_LEASE_STALE_AFTER_MS;

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
}

export interface AgentStatusWriterOptions {
  directory: string;
  workingDirectory: string;
  changeName?: string | null;
  /** Test seam: the writer's own identity would otherwise always be a
   * fresh random one. */
  instanceId?: string;
  /** Test seam. */
  now?: () => Date;
}

/** One run's handle on its own status file. Never touches another
 * run's file — there is exactly one file per instance, named by its own
 * `instanceId`. */
export class AgentStatusWriter {
  readonly instanceId: string;
  readonly filePath: string;
  private readonly directory: string;
  private readonly workingDirectory: string;
  private changeName: string | null;
  private stage: string | null = null;
  private activity = "";
  private activityAt: string;
  private readonly now: () => Date;
  private timer: NodeJS.Timeout | undefined;
  private stopped = false;

  constructor(options: AgentStatusWriterOptions) {
    this.instanceId = options.instanceId ?? randomUUID();
    this.directory = path.resolve(options.directory);
    this.workingDirectory = path.resolve(options.workingDirectory);
    this.changeName = options.changeName ?? null;
    this.now = options.now ?? (() => new Date());
    this.filePath = path.join(this.directory, `${this.instanceId}.json`);
    this.activityAt = this.now().toISOString();
  }

  /** Writes the first record and starts renewing it on the lease's own
   * interval. */
  async start(initialActivity = "starting"): Promise<void> {
    this.activity = initialActivity;
    this.activityAt = this.now().toISOString();
    await this.write();
    this.timer = setInterval(() => {
      void this.write();
    }, AGENT_STATUS_RENEW_INTERVAL_MS);
    // Never hold a process open on the heartbeat alone.
    this.timer.unref?.();
  }

  /** Records what the run is doing now. `activityAt` only moves when
   * the text actually changes, so silence under an unchanged activity is
   * visible rather than hidden behind a heartbeat that keeps ticking. */
  async reportActivity(activity: string, stage?: string | null): Promise<void> {
    const changed = activity !== this.activity;
    this.activity = activity;
    if (stage !== undefined) this.stage = stage;
    if (changed) this.activityAt = this.now().toISOString();
    await this.write();
  }

  setChangeName(changeName: string | null): void {
    this.changeName = changeName;
  }

  /** Removes the record. Called on a clean end; a crash removes
   * nothing, which is what the staleness window is for. */
  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    await rm(this.filePath, { force: true });
  }

  private async write(): Promise<void> {
    if (this.stopped) return;
    const nowIso = this.now().toISOString();
    const document: AgentStatusDocument = {
      version: AGENT_STATUS_VERSION,
      instanceId: this.instanceId,
      activity: this.activity,
      stage: this.stage,
      changeName: this.changeName,
      workingDirectory: this.workingDirectory,
      activityAt: this.activityAt,
      heartbeatAt: nowIso,
    };
    await mkdir(this.directory, { recursive: true });
    const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
      try {
        await rename(temporaryPath, this.filePath);
      } catch (error) {
        const code = error instanceof Error && "code" in error ? (error as NodeJS.ErrnoException).code : undefined;
        if (code !== "EEXIST" && code !== "EPERM") throw error;
        await rm(this.filePath, { force: true });
        await rename(temporaryPath, this.filePath);
      }
    } finally {
      await rm(temporaryPath, { force: true });
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
  /** The heartbeat is older than the staleness window: the writer is
   * gone, by the same rule the workspace lease already uses. */
  gone: boolean;
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

/** Every run's status in one repository, read as a pure function over
 * its directory: the same answer for the CLI, the standalone shell, and
 * anything else that asks. A repository with nothing running reads as
 * an empty list, not an error. */
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
    const filePath = path.join(directory, fileName);
    const expectedId = fileName.slice(0, -".json".length);
    try {
      const raw = await readFile(filePath, "utf8");
      let document: Partial<AgentStatusDocument>;
      try {
        document = JSON.parse(raw) as Partial<AgentStatusDocument>;
      } catch {
        malformed.push({ fileName, reason: "not valid JSON" });
        continue;
      }
      if (
        typeof document.instanceId !== "string" ||
        typeof document.activity !== "string" ||
        typeof document.workingDirectory !== "string" ||
        typeof document.activityAt !== "string" ||
        typeof document.heartbeatAt !== "string"
      ) {
        malformed.push({ fileName, reason: "missing or invalid required fields" });
        continue;
      }
      if (document.instanceId !== expectedId) {
        malformed.push({
          fileName,
          reason: `record identity "${document.instanceId}" does not match file name "${expectedId}"`,
        });
        continue;
      }
      const activitySinceMs = now().getTime() - Date.parse(document.activityAt);
      const heartbeatAgeMs = now().getTime() - Date.parse(document.heartbeatAt);
      if (!Number.isFinite(activitySinceMs) || !Number.isFinite(heartbeatAgeMs)) {
        malformed.push({ fileName, reason: "activityAt or heartbeatAt is not a valid timestamp" });
        continue;
      }
      reports.push({
        instanceId: document.instanceId,
        activity: document.activity,
        stage: document.stage ?? null,
        changeName: document.changeName ?? null,
        workingDirectory: document.workingDirectory,
        activitySinceMs,
        heartbeatAgeMs,
        gone: heartbeatAgeMs > staleAfterMs,
      });
    } catch (error) {
      // A file `readdir` just listed can vanish before it is read: the
      // writer's own write-then-rename briefly removes the destination
      // when a rename lands on an existing name (Windows) before putting
      // the new one in its place. That is the race this design exists to
      // survive, not a malformed record — the same reasoning
      // `readWorkspaceLeaseHolder` already applies to a lease that goes
      // missing between being listed and being read.
      if (isMissingPath(error)) continue;
      malformed.push({ fileName, reason: error instanceof Error ? error.message : String(error) });
    }
  }

  return { reports, malformed };
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

/** The last non-empty line of a chunk of text — the line a person
 * actually reads when a stream of output is collapsed to one activity
 * string. */
function lastNonEmptyLine(text: string): string | undefined {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.at(-1);
}

/** Taps a chain or agent run's own event stream into its status record,
 * yielding every event through unchanged. This is the one place that
 * turns "what a run reports about itself" into "what its record says it
 * is doing" — every host (CLI, standalone server, VS Code extension)
 * wraps its own `for await (const event of ...)` loop with this instead
 * of reimplementing the mapping, so the mapping is written once (see
 * `packages/core` owning all business logic, ADR 0001).
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
  for await (const event of events) {
    await applyEventToAgentStatus(writer, event);
    yield event;
  }
}

async function applyEventToAgentStatus(writer: AgentStatusWriter, event: Event): Promise<void> {
  switch (event.kind) {
    case "stageStarted":
      await writer.reportActivity(`running ${event.stage}`, event.stage);
      return;
    case "stageCompleted":
      await writer.reportActivity(`running ${event.nextStage}`, event.nextStage);
      return;
    case "stdout": {
      const line = lastNonEmptyLine(event.chunk);
      if (line !== undefined) await writer.reportActivity(line);
      return;
    }
    case "progress":
      await writer.reportActivity(event.message);
      return;
    case "agentUpdate": {
      const streamed = readAcpStreamedText(event.update);
      if (streamed !== undefined) await writer.reportActivity(lastNonEmptyLine(streamed.text) ?? streamed.text);
      return;
    }
    case "completed":
    case "failed":
    case "cancelled":
      await writer.stop();
      return;
    default:
      return;
  }
}
