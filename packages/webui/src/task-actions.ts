// What a host's answer to a card's task control says, in words — a-card-works-its-own-tasks.
//
// Both hosts carry the same answers from core (`setTaskDone`,
// `commitTaskList`, `runOwnDelegatedItem`): one over the editor's message
// bridge, one over the local server's routes. This turns any of them into
// the one line the panel shows, so the two hosts say the same thing.

import type { OpenTarget, TaskActionResult, TaskActions } from "./components/TaskPanel.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** An answer, as the panel shows it. Anything unrecognised is said to be
 * so, never taken for a success. */
export function describeTaskResult(value: unknown): TaskActionResult {
  if (!isRecord(value)) return { ok: false, said: "The host gave no answer." };
  // A delegated run's answer, which has a status rather than `ok`.
  if (value.status === "refused" || value.status === "ran") {
    return { ok: value.status === "ran", said: typeof value.message === "string" ? value.message : String(value.status) };
  }
  if (value.ok === false) return { ok: false, said: typeof value.reason === "string" ? value.reason : "Refused." };
  if (value.ok === true && typeof value.commit === "string") {
    const message = typeof value.message === "string" ? ` ("${value.message}")` : "";
    return { ok: true, said: `Committed ${value.commit.slice(0, 8)}${message} and pushed to ${String(value.pushedTo)}.` };
  }
  if (value.ok === true && typeof value.line === "string") {
    const note = typeof value.noteLine === "string" ? ", with the note under it" : "";
    return { ok: true, said: `Written: ${value.line.trim()}${note}. Commit and push to send it.` };
  }
  return { ok: false, said: "The host's answer was not understood." };
}

/** Requests a host answers: the operation, and what it names. */
export type TaskRequester = (op: "task-set" | "task-commit" | "task-run", args: Record<string, unknown>) => Promise<unknown>;

/** The card's actions over a host's requests. A request that fails in
 * transport is said as a failure, never thrown at the panel. */
export function taskActionsOver(
  request: TaskRequester,
  options: { open?: TaskActions["open"]; openTargets: readonly OpenTarget[]; canRun: boolean },
): TaskActions {
  const answer = async (op: Parameters<TaskRequester>[0], args: Record<string, unknown>): Promise<TaskActionResult> => {
    try {
      return describeTaskResult(await request(op, args));
    } catch (error) {
      return { ok: false, said: error instanceof Error ? error.message : String(error) };
    }
  };
  return {
    set: (changeName, task, done, note) => answer("task-set", {
      changeName,
      lineNumber: task.lineNumber,
      expectedText: task.text,
      done,
      ...(note !== undefined ? { note } : {}),
    }),
    commit: (changeName) => answer("task-commit", { changeName }),
    ...(options.canRun ? { run: (changeName: string, lineNumber: number) => answer("task-run", { changeName, lineNumber }) } : {}),
    ...(options.open !== undefined ? { open: options.open } : {}),
    openTargets: options.openTargets,
  };
}
