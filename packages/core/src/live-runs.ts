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
  /** When its first `started` event said it started. */
  startedAt: string;
  /** At a checkpoint or on a permission, rather than working. */
  waiting: boolean;
  /** The stop a person asked for, where one was asked and the run has not
   * ended yet. */
  stopRequested: { reason: string; by?: string } | null;
}

/** The commands that start work. Every other kind is a request about a run
 * or a quick read, and is not itself a run anything could stop. */
const RUN_KINDS: ReadonlySet<CommandKind> = new Set<CommandKind>(["plan", "implement", "review", "verify", "chain"]);

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
            startedAt: event.timestamp,
            waiting: false,
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
    return run === undefined ? undefined : { ...run };
  }

  /** Every run held, as copies: a caller cannot change what is held. */
  list(): LiveRun[] {
    return [...this.runs.values()].map((run) => ({ ...run }));
  }

  private observe(run: LiveRun, event: Event): void {
    if (isTerminal(event)) {
      if (this.runs.get(run.runId) === run) this.runs.delete(run.runId);
      run.waiting = false;
      run.stopRequested = null;
      return;
    }
    this.runs.set(run.runId, run);
    switch (event.kind) {
      case "checkpoint":
      case "permissionRequest":
        run.waiting = true;
        return;
      case "stopRequested":
        if (event.outcome === "asked") run.stopRequested = { reason: event.reason, ...(event.by !== undefined ? { by: event.by } : {}) };
        return;
      // Reports about a run rather than the run moving on: they leave a wait
      // standing.
      case "usageReported":
      case "cancelling":
        return;
      default:
        run.waiting = false;
    }
  }
}
