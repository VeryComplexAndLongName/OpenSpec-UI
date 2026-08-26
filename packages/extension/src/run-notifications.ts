import type { WorkbenchProcess, WorkbenchProcessState } from "@openspec-ui/core";

/** Agent-driven operations worth a "you can stop watching now" notification.
 * `status`/`list`/`show`/`validate` are deterministic and near-instant (see
 * run-controller.ts's runDirectOpenSpecCommand) — notifying on those would
 * fire constantly for actions the user is already looking at the result of. */
const NOTIFIABLE_OPERATIONS = new Set(["plan", "implement", "review"]);

const TERMINAL_STATES = new Set<WorkbenchProcessState>(["completed", "failed"]);

/** Tracks each process's last-seen state and reports which ones just
 * transitioned into "completed" or "failed" for a notifiable operation —
 * "just transitioned" so a process already terminal when first seen (e.g.
 * restored from the run journal on activation, or any state this notifier
 * has already reported once) never re-fires. Deliberately excludes
 * "cancelled"/"interrupted"/"rolled-back": cancellation is almost always the
 * direct result of an action the user just took themselves, and interrupted/
 * rolled-back are recovery-time states from a prior session, not "the agent
 * just finished while you were away." Pure/VS-Code-API-free so it's testable
 * without a real extension host — see extension.ts for the
 * `vscode.window.show*Message` wiring. */
export class RunCompletionNotifier {
  private readonly lastSeen = new Map<string, WorkbenchProcessState>();

  constructor(initialProcesses: WorkbenchProcess[]) {
    for (const process of initialProcesses) {
      this.lastSeen.set(process.id, process.state);
    }
  }

  /** Call on every `WorkbenchProcessScheduler.onDidChange` update. Returns
   * the subset of `processes` that just became notifiable. */
  handle(processes: WorkbenchProcess[]): WorkbenchProcess[] {
    const newlyTerminal: WorkbenchProcess[] = [];
    for (const process of processes) {
      const previousState = this.lastSeen.get(process.id);
      this.lastSeen.set(process.id, process.state);
      if (
        TERMINAL_STATES.has(process.state)
        && previousState !== process.state
        && !(previousState !== undefined && TERMINAL_STATES.has(previousState))
        && NOTIFIABLE_OPERATIONS.has(process.operation)
      ) {
        newlyTerminal.push(process);
      }
    }
    return newlyTerminal;
  }
}

export function describeRunCompletion(process: WorkbenchProcess): string {
  const change = process.changeName ? ` for "${process.changeName}"` : "";
  if (process.state === "failed") {
    return `OpenSpec UI: ${process.operation}${change} failed${process.error ? ` (${process.error})` : ""}.`;
  }
  return `OpenSpec UI: ${process.operation}${change} completed${process.summary ? ` (${process.summary})` : ""}.`;
}
