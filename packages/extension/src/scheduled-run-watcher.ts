// Starts a scheduled run when its time comes, or when the editor is
// opened after it has passed.
//
// The case this exists for is the second one: a timer inside a window
// that is closed at the appointed hour fires nothing, and a schedule
// that quietly does not happen is worse than no schedule. So the file
// outlives the process, and this reads it on activation as well as on a
// tick.
//
// It opens the run dialog rather than starting anything by itself. A
// surface that acts on a configuration and shows nothing of what it read
// is the defect that dialog exists to remove, and a delay does not
// change that — it only means the person was not the one who asked just
// now, which the dialog says.
//
// See a-run-can-be-scheduled.

import * as vscode from "vscode";
import {
  buildRunPlan,
  describeLateness,
  discoverOpenSpecWorkspace,
  readScheduledRuns,
  readSchedule,
  resolveHarnessConfig,
  withoutEntry,
  writeScheduledRuns,
} from "@openspec-ui/core";
import type { AiPanelContext } from "./webview/ai-panel.js";

/** A minute is the resolution a person schedules at; reading the file
 * faster would learn the same thing more often. */
const TICK_MS = 60_000;

export interface ScheduledRunWatcherDeps {
  getWorkspaceRoot: () => string | undefined;
  revealAiPanel: (context: AiPanelContext) => void;
  outputChannel: { appendLine: (line: string) => void };
}

/** Reads the schedule once and acts on it. Exported for its own test:
 * the tick is a timer, and a timer is not the part worth asserting. */
export async function checkScheduleOnce(deps: ScheduledRunWatcherDeps): Promise<void> {
  const workspaceRoot = deps.getWorkspaceRoot();
  if (!workspaceRoot) return;

  try {
    const entries = await readScheduledRuns(workspaceRoot);
    if (entries.length === 0) return;

    const workspace = await discoverOpenSpecWorkspace(workspaceRoot);
    const reading = readSchedule(entries, {
      active: workspace.changes.map((change) => change.name),
      archived: workspace.archivedChanges.map((change) => change.name),
    }, new Date());

    let remaining = entries;
    for (const entry of reading.dropped) {
      remaining = withoutEntry(remaining, entry);
      deps.outputChannel.appendLine(
        `OpenSpec UI: dropped a scheduled run for "${entry.changeName}", which no longer exists.`,
      );
    }

    const due = reading.start;
    if (!due) {
      if (remaining.length !== entries.length) await writeScheduledRuns(workspaceRoot, remaining);
      return;
    }

    // Removed before it opens anything: a schedule that fired and stayed
    // in the file would fire again on the next tick.
    remaining = withoutEntry(remaining, due.entry);
    await writeScheduledRuns(workspaceRoot, remaining);

    const changeDir = workspace.changes.find((change) => change.name === due.entry.changeName)?.path
      ?? workspace.archivedChanges.find((change) => change.name === due.entry.changeName)?.path;
    if (!changeDir) return;

    const config = await resolveHarnessConfig(workspaceRoot, due.entry.changeName);
    const waiting = reading.waiting.length === 0
      ? ""
      : ` ${reading.waiting.length} more scheduled run(s) are still waiting.`;
    deps.revealAiPanel({
      cwd: workspaceRoot,
      changeDir,
      changeName: due.entry.changeName,
      runPlan: buildRunPlan(config, { hasVsCodeAgent: true }),
      runNote: `${describeLateness(due)}${waiting}`,
    });
  } catch (error) {
    deps.outputChannel.appendLine(
      `OpenSpec UI: reading the schedule failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** Checks now and every minute after. Returns the disposable the caller
 * registers — a timer nobody clears is a leak, and this repository has
 * already shipped one. */
export function watchScheduledRuns(deps: ScheduledRunWatcherDeps): vscode.Disposable {
  void checkScheduleOnce(deps);
  const timer = setInterval(() => void checkScheduleOnce(deps), TICK_MS);
  return new vscode.Disposable(() => clearInterval(timer));
}
