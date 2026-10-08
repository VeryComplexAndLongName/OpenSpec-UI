// The runs this host started and still holds — a-change-is-run-from-its-card.
//
// A card offers Answer, Stop and Stop now only for a run the host showing
// it can reach: a run it started, in this process. The status records say
// what every run is doing, wherever it runs, but not whether this host holds
// it, and a control for a run held elsewhere would send a command nothing
// here can deliver. So each host passes the events of every run it starts
// through one `LiveRuns`, and the card asks it.
//
// No IO, and nothing but type imports and one pure helper: it observes the
// events as they pass and changes none of them.

import type { AgentRunner } from "./agent-runner.js";
import { changeNameOf } from "./audit-runs.js";
import type { Command, CommandKind, Event } from "./protocol.js";

/** A run this host started and holds, as its own events describe it. */
export interface LiveRun {
  runId: string;
  /** The working directory the command named, so a host serving more
   * than one workspace answers each only with its own runs. */
  cwd: string;
  /** The change's directory name, where the command names a change. */
  changeName: string | null;
  kind: CommandKind;
  /** The agent the command named, where it named one: a request about the
   * run has to reach the runner that holds it. */
  agentId?: string;
  /** When its first `started` event said it started. */
  startedAt: string;
  /** At a checkpoint or on a permission, rather than working. */
  waiting: boolean;
  /** The permission request the run waits on, while it waits on one: what
   * an answer from a card names - the oldest of `pendingPermissions`. */
  permissionRequestId: string | null;
  /** Every permission request still open, oldest first. An agent running
   * tool calls side by side asks for several at once; a card that knew only
   * the latest had nothing to offer once it was answered, while the others
   * held the run (live, 2026-10-08). */
  pendingPermissions?: Array<{ requestId: string; description: string }>;
  /** The stop a person asked for, where one was asked and the run has not
   * ended yet. */
  stopRequested: { reason: string; by?: string } | null;
}

/** The commands that start work. Every other kind is a request about a run
 * or a quick read, and is not itself a run anything could stop. */
const RUN_KINDS: ReadonlySet<CommandKind> = new Set<CommandKind>(["plan", "implement", "review", "update", "verify", "chain"]);

function isTerminal(event: Event): boolean {
  return event.kind === "completed" || event.kind === "failed" || event.kind === "cancelled";
}

export class LiveRuns {
  private readonly runs = new Map<string, LiveRun>();

  /** Yields every event unchanged and in order, and holds the run from its
   * first `started` until it ends.
   *
   * A terminal event removes the run. A chain forwards a stage's `failed` or
   * `cancelled` that another attempt follows, so a run whose events carry on
   * after a terminal one is held again — with the time it first started —
   * and it is released for good when its events end. */
  async *track(command: Command, events: AsyncIterable<Event>): AsyncIterable<Event> {
    if (!RUN_KINDS.has(command.kind)) {
      yield* events;
      return;
    }
    let run: LiveRun | undefined;
    try {
      for await (const event of events) {
        if (run === undefined && event.kind === "started") {
          run = {
            runId: command.runId,
            cwd: command.cwd,
            changeName: command.context.changeDir ? changeNameOf(command.context.changeDir) || null : null,
            kind: command.kind,
            ...(command.agentId !== undefined ? { agentId: command.agentId } : {}),
            startedAt: event.timestamp,
            waiting: false,
            permissionRequestId: null,
            pendingPermissions: [],
            stopRequested: null,
          };
        }
        if (run !== undefined) this.observe(run, event);
        yield event;
      }
    } finally {
      if (run !== undefined && this.runs.get(run.runId) === run) this.runs.delete(run.runId);
    }
  }

  /** The same runner, with every run it starts held here — for a host that
   * hands a runner to code that starts runs itself, such as a delegated
   * item's run. */
  runner(runner: AgentRunner): AgentRunner {
    return { run: (command) => this.track(command, runner.run(command)) };
  }

  get(runId: string): LiveRun | undefined {
    const run = this.runs.get(runId);
    return run === undefined ? undefined : copyOf(run);
  }

  /** Every run held, as copies: a caller cannot change what is held. */
  list(): LiveRun[] {
    return [...this.runs.values()].map(copyOf);
  }

  private observe(run: LiveRun, event: Event): void {
    const pending = run.pendingPermissions ?? [];
    run.pendingPermissions = pending;
    if (isTerminal(event)) {
      if (this.runs.get(run.runId) === run) this.runs.delete(run.runId);
      run.waiting = false;
      run.permissionRequestId = null;
      pending.length = 0;
      run.stopRequested = null;
      return;
    }
    this.runs.set(run.runId, run);
    switch (event.kind) {
      case "checkpoint":
        run.waiting = true;
        run.permissionRequestId = null;
        pending.length = 0;
        return;
      case "permissionRequest":
        pending.push({ requestId: event.requestId, description: event.description });
        run.waiting = true;
        run.permissionRequestId = pending[0]!.requestId;
        return;
      case "permissionSettled": {
        // Answered here or anywhere else, or withdrawn: the run still waits
        // while another request is open.
        const at = pending.findIndex((request) => request.requestId === event.requestId);
        if (at !== -1) pending.splice(at, 1);
        run.permissionRequestId = pending[0]?.requestId ?? null;
        run.waiting = pending.length > 0;
        return;
      }
      case "stopRequested":
        if (event.outcome === "asked") run.stopRequested = { reason: event.reason, ...(event.by !== undefined ? { by: event.by } : {}) };
        return;
      // Reports about a run rather than the run moving on: they leave a wait
      // standing.
      case "usageReported":
      case "cancelling":
        return;
      default:
        // The agent going on says nothing about a request still open: only
        // its settling does.
        run.waiting = pending.length > 0;
        run.permissionRequestId = pending[0]?.requestId ?? null;
    }
  }
}

/** A copy a caller cannot change what is held through; the open requests
 * only where there are any, so a run waiting on none reads as it always
 * did. */
function copyOf(run: LiveRun): LiveRun {
  const { pendingPermissions, ...rest } = run;
  return pendingPermissions !== undefined && pendingPermissions.length > 0
    ? { ...rest, pendingPermissions: pendingPermissions.map((request) => ({ ...request })) }
    : rest;
}
