// One pass over the schedule, for the standalone shell.
//
// The decisions are not here — `planScheduleFiring` in core makes them,
// and this performs the effects the shell can perform: remove an entry
// over HTTP, load the change into the editor, start the run on the path
// the entry names, say what happened. The same loop used to live inline
// in `standalone-entry.tsx` and again in the extension's watcher, down
// to the identical sentence, and the two had already diverged.
//
// It lives in its own module for the reason `run-with-harness-dispatch.ts`
// does: `standalone-entry.tsx` is a bootstrap script and is not unit
// tested, and this is exactly the kind of logic that needs to be.
//
// See a-schedule-keeps-its-promise.

import {
  describePathNoLongerOffered,
  planScheduleFiring,
  type KnownChangeNames,
  type RunPathId,
  type ScheduledRun,
} from "@openspec-ui/core/browser";
import type { RunWithHarnessDispatch } from "./run-with-harness-dispatch.js";

export interface ScheduleFiringHost {
  /** The schedule as the server holds it. */
  loadEntries: () => Promise<ScheduledRun[]>;
  /** Takes one entry out of the schedule. */
  removeEntry: (entry: ScheduledRun) => Promise<unknown>;
  /** What the change's configuration resolves to, read fresh — a person
   * may have edited it since the schedule was made. */
  resolveDispatch: (changeName: string) => Promise<RunWithHarnessDispatch>;
  /** Loads the scheduled change into the editor, by the same path a
   * manual selection takes, so the files and revision on screen belong
   * to the change the dialog names. Returns a sentence when it did not
   * switch — unsaved edits on another change — and `undefined` when it
   * did. */
  loadChange: (changeName: string) => Promise<string | undefined>;
  /** Starts the run on the path the entry named, as if that button had
   * been pressed. */
  startRun: (path: RunPathId, dispatch: RunWithHarnessDispatch) => void;
  /** Opens the dialog for a choice, with the note that says why nothing
   * started by itself. */
  openDialog: (dispatch: RunWithHarnessDispatch, note: string) => void;
  /** Says something about the schedule, where every tab can read it. */
  say: (message: string) => void;
}

/** Reads the schedule once and acts on it.
 *
 * `known` is what the workspace overview says exists; the caller does
 * not call this until it has one. Deciding a change was deleted from a
 * list nothing has loaded yet is destructive, and once was. */
export async function fireDueSchedule(
  host: ScheduleFiringHost,
  known: KnownChangeNames,
  now: Date,
): Promise<void> {
  let firing: ReturnType<typeof planScheduleFiring>;
  try {
    const entries = await host.loadEntries();
    if (entries.length === 0) return;
    firing = planScheduleFiring(entries, known, now);
    // A drop cannot fail to be carried out, so it is applied before the
    // run that can.
    for (const drop of firing.dropped) await host.removeEntry(drop.entry);
    if (firing.dropNotes.length > 0) host.say(firing.dropNotes.join(" "));
  } catch (error) {
    // Reading is what failed, and this is the only place that may say
    // so. The message used to be printed for a failure to open the run
    // as well, which named the wrong thing and lost the run with it.
    host.say(`Reading the schedule failed: ${describe(error)}`);
    return;
  }

  const due = firing.start;
  if (!due) return;

  let dispatch: RunWithHarnessDispatch;
  let blocked: string | undefined;
  try {
    dispatch = await host.resolveDispatch(due.entry.changeName);
    blocked = await host.loadChange(due.entry.changeName);
  } catch (error) {
    // The entry stays in the file. It used to be removed first, so a
    // malformed `harness.json` spent the run and reported it as a
    // failure to read the schedule.
    host.say(`The scheduled run for ${due.entry.changeName} could not be opened: ${describe(error)}`);
    return;
  }

  await host.removeEntry(due.entry);

  const note = firing.startNote ?? "";
  if (blocked) {
    // The editor is not switched under unsaved edits, so the run is not
    // started either — the dialog waits with the reason on it.
    host.openDialog(dispatch, `${note} ${blocked}`);
    host.say(`${note} ${blocked}`);
    return;
  }
  if (!dispatch.plan.offered.some((path) => path.id === due.entry.path)) {
    const why = describePathNoLongerOffered(due.entry.path);
    host.openDialog(dispatch, `${note} ${why}`);
    host.say(`${note} ${why}`);
    return;
  }

  host.startRun(due.entry.path, dispatch);
  host.say(note);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
