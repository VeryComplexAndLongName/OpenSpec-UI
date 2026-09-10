// Starts a scheduled run when its time comes, or when the editor is
// opened after it has passed.
//
// The case this exists for is the second one: a timer inside a window
// that is closed at the appointed hour fires nothing, and a schedule
// that quietly does not happen is worse than no schedule. So the file
// outlives the process, and this reads it on activation as well as on a
// tick.
//
// What to do with the schedule is not decided here. `planScheduleFiring`
// in core decides it — what to drop, what to start, what to say, what to
// write back — and this performs the effects: write the file, open the
// panel, print the lines. The same loop used to be written here and
// again in the standalone shell, down to the identical sentence, and the
// two had already diverged in how they wrote back and in what they did
// with an archived change.
//
// The panel opens on the path the entry was scheduled with, rather than
// asking for the choice a second time. It still opens: a surface that
// acts on a configuration and shows nothing of what it read is the
// defect the dialog exists to remove, and the note says who asked.
//
// See a-run-can-be-scheduled, corrected by a-schedule-keeps-its-promise.

import * as vscode from "vscode";
import {
  buildRunPlan,
  describePathNoLongerOffered,
  discoverOpenSpecWorkspace,
  planScheduleFiring,
  readScheduledRuns,
  resolveHarnessConfig,
  writeScheduledRuns,
} from "@openspec-ui/core";
import type { ScheduleFiring } from "@openspec-ui/core";
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

  let firing: ScheduleFiring;
  let changeDirs: Map<string, string>;
  try {
    const entries = await readScheduledRuns(workspaceRoot);
    if (entries.length === 0) return;

    const workspace = await discoverOpenSpecWorkspace(workspaceRoot);
    changeDirs = new Map(workspace.changes.map((change) => [change.name, change.path]));
    firing = planScheduleFiring(entries, {
      active: workspace.changes.map((change) => change.name),
      archived: workspace.archivedChanges.map((change) => change.name),
    }, new Date());

    for (const note of firing.dropNotes) deps.outputChannel.appendLine(`OpenSpec UI: ${note}`);
    // Written straight away: a drop cannot fail to be carried out, and
    // holding it back would make it depend on a run that can.
    if (firing.dropped.length > 0) await writeScheduledRuns(workspaceRoot, firing.afterDrops);
  } catch (error) {
    // Reading is what failed here, and this is the only place that may
    // say so.
    deps.outputChannel.appendLine(
      `OpenSpec UI: reading the schedule failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return;
  }

  const due = firing.start;
  if (!due) return;

  try {
    // Everything that can fail happens before the entry leaves the file.
    // It used to be removed first, so a malformed `harness.json` spent
    // the run and reported it as a failure to read the schedule — which
    // is not what failed.
    const changeDir = changeDirs.get(due.entry.changeName);
    if (!changeDir) throw new Error(`no directory for change "${due.entry.changeName}"`);
    const config = await resolveHarnessConfig(workspaceRoot, due.entry.changeName);
    const runPlan = buildRunPlan(config, { hasVsCodeAgent: true });
    const offered = runPlan.offered.some((path) => path.id === due.entry.path);
    const runNote = offered
      ? firing.startNote ?? ""
      : `${firing.startNote ?? ""} ${describePathNoLongerOffered(due.entry.path)}`;

    await writeScheduledRuns(workspaceRoot, firing.remaining);
    deps.revealAiPanel({
      cwd: workspaceRoot,
      changeDir,
      changeName: due.entry.changeName,
      runPlan,
      runNote,
      // The path chosen when the run was asked for, honoured rather than
      // asked for again. Absent when this host no longer offers it, and
      // the note above says so.
      ...(offered ? { runPath: due.entry.path } : {}),
    });
    deps.outputChannel.appendLine(`OpenSpec UI: ${runNote}`);
  } catch (error) {
    // The entry is still in the file, and the sentence says what failed.
    deps.outputChannel.appendLine(
      `OpenSpec UI: the scheduled run for "${due.entry.changeName}" could not be opened: `
      + `${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** Checks now and every minute after. Returns the disposable the caller
 * registers — a timer nobody clears is a leak, and this repository has
 * already shipped one.
 *
 * A pass that outlasts the tick is not overlapped by the next: a second
 * reading of the same file would find the same entry still there and
 * open the run twice. */
export function watchScheduledRuns(deps: ScheduledRunWatcherDeps): vscode.Disposable {
  let inFlight = false;
  async function pass(): Promise<void> {
    if (inFlight) return;
    inFlight = true;
    try {
      await checkScheduleOnce(deps);
    } finally {
      inFlight = false;
    }
  }
  void pass();
  const timer = setInterval(() => void pass(), TICK_MS);
  return new vscode.Disposable(() => clearInterval(timer));
}
