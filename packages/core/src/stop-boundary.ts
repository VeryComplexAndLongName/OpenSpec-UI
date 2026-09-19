// Where a run asked to stop may end — a-change-is-run-from-its-card (ADR 0028).
//
// A stop is not a cancel. A cancel kills the process wherever it is; a stop
// waits for a point where the work is sound: the next task the agent says it
// is starting, a task newly ticked in the change's list, or the run's own
// end. A run waiting on a permission is answered `deny` and ends at once.
//
// One module, because two runners need exactly this: a chain's stage and a
// single-stage run. Two copies of "where a run may end" would drift into two
// answers, which is how a stop that works from one host fails from the other.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { readAcpStreamedText } from "./acp-streamed-text.js";
import type { Event } from "./protocol.js";
import { TASK_CHECKBOX_LINE_RE, taskNumberOf } from "./task-checklist.js";
import { readTaskMarker } from "./task-marker.js";

/** How often a run with a stop pending reads its task list for a newly
 * ticked task. Only while a stop is pending: nothing else reads the list
 * during a run. */
export const STOP_CHECK_INTERVAL_MS = 2_000;

/** How often a run holding a request that names a task reads its list for
 * that task.
 *
 * Shorter than the interval above, because the two answer different
 * questions. A pending stop has already decided to end and is waiting for
 * a sound point; a held request is waiting for the point itself, and every
 * moment between the task being ticked and the run learning it is a moment
 * the agent may spend starting the next task. Half a second is a file read
 * twice a second, and only while a request is held
 * (a-run-is-told-where-to-stop). */
export const STOP_AFTER_CHECK_INTERVAL_MS = 500;

/** How many of a change's tasks are ticked, or `undefined` where its task
 * list cannot be read. */
export async function countTickedTasks(changeDir: string): Promise<number | undefined> {
  let content: string;
  try {
    content = await readFile(path.join(changeDir, "tasks.md"), "utf8");
  } catch {
    return undefined;
  }
  let ticked = 0;
  for (const line of content.split(/\r?\n/u)) {
    const match = line.match(TASK_CHECKBOX_LINE_RE);
    if (match && (match[1] ?? "").toLowerCase() === "x") ticked += 1;
  }
  return ticked;
}

/** Whether one named task of a change is ticked, still open, or not in
 * the list at all.
 *
 * Read from the same file as the count above, and only while a request
 * naming a task is held: a run told to stop after 4.6 has to know when
 * 4.6 is done, and nothing else in a run reads the list by name
 * (a-run-is-told-where-to-stop). */
export async function readTaskTickState(changeDir: string, task: string): Promise<"ticked" | "open" | "absent" | "unreadable"> {
  let content: string;
  try {
    content = await readFile(path.join(changeDir, "tasks.md"), "utf8");
  } catch {
    return "unreadable";
  }
  for (const line of content.split(/\r?\n/u)) {
    const match = line.match(TASK_CHECKBOX_LINE_RE);
    if (!match) continue;
    if (taskNumberOf(match[2] ?? "") !== task) continue;
    return (match[1] ?? "").toLowerCase() === "x" ? "ticked" : "open";
  }
  return "absent";
}

/** Whether `marker` names a task that comes after `task`, comparing the
 * numbers part by part: 4.10 comes after 4.6, and 5.1 after both. A part
 * that is not a number sorts as 0, which is what an unreadable marker
 * deserves - it never ends a run early by itself. */
export function taskComesAfter(marker: string, task: string): boolean {
  const left = marker.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const right = task.split(".").map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const one = left[index] ?? 0;
    const other = right[index] ?? 0;
    if (one !== other) return one > other;
  }
  return false;
}

/** Reads the task markers out of a run's output as it passes.
 *
 * A marker is a line of its own, so a line counts once its newline arrives,
 * or once something other than more of the same text does — a reply that
 * ends without a newline is complete when the agent does something else.
 * Only stdout and an ACP agent's reply are read: its reasoning says "I'll
 * start task 2.3 next" long before it does, as the status record already
 * holds. */
export class TaskMarkerReader {
  private readonly partial = { stdout: "", reply: "" };

  /** The markers this event completes, in the order they were said. */
  read(event: Event): string[] {
    const streamed = event.kind === "agentUpdate" ? readAcpStreamedText(event.update) : undefined;
    const said = event.kind === "stdout"
      ? { key: "stdout" as const, chunk: event.chunk }
      : streamed !== undefined && streamed.kind !== "agent_thought_chunk"
        ? { key: "reply" as const, chunk: streamed.text }
        : undefined;
    // Reasoning between two slices of a reply neither completes nor breaks it.
    if (streamed?.kind === "agent_thought_chunk") return [];
    const markers: string[] = [];
    const take = (line: string) => {
      const marker = readTaskMarker(line);
      if (marker !== undefined) markers.push(marker);
    };
    for (const key of ["stdout", "reply"] as const) {
      if (said?.key !== key && this.partial[key] !== "") {
        take(this.partial[key]);
        this.partial[key] = "";
      }
    }
    if (said !== undefined) {
      const lines = (this.partial[said.key] + said.chunk).split(/\r?\n/u);
      this.partial[said.key] = lines.pop() ?? "";
      for (const line of lines) take(line);
    }
    return markers;
  }
}

export interface StopBoundaryOptions {
  /** The run's own events. */
  events: AsyncIterable<Event>;
  /** The change whose task list is read for a newly ticked task. */
  changeDir: string;
  /** Whether a stop has been asked for, read afresh at every step. */
  stopAsked: () => boolean;
  /** Receives the wake a new stop request calls, so a silent run still acts
   * on it; `undefined` withdraws it. */
  onWake: (wake: (() => void) | undefined) => void;
  /** Yields the one `stopRequested` the stop produces. */
  announce: () => AsyncIterable<Event>;
  /** Answers a pending permission request `deny`. */
  denyPermission: (requestId: string) => void;
  /** Ends the run. Its own `cancelled` follows once its process is gone. A
   * run that should end on its own passes one that does nothing. */
  endRun: () => void;
  /** Whether a permission request may be answered here. A chain under
   * `autonomous` answers them itself. */
  mayDenyPermissions?: boolean;
  /** The task a request told this run to stop after, while one is held and
   * not yet due. The run goes on working until it is
   * (a-run-is-told-where-to-stop). */
  stopAfterTask?: () => string | undefined;
  /** Called once, when the held request comes due: its task is ticked, a
   * marker names a task after it, or the list does not have it. The caller
   * turns it into the stop this boundary already knows how to end on, or
   * refuses it. */
  onStopAfterDue?: (due: { task: string; why: "ticked" | "passed" | "absent" }) => void;
  /** Test seam for the check interval. */
  intervalMs?: number;
}

/** Passes a run's events through unchanged, and, once a stop is asked, ends
 * the run at the first sound point: the next marker naming a task other
 * than the last one named, the count of ticked tasks rising above what it
 * was when the stop was announced, or the run's own end.
 *
 * Each event is raced against the wake and, while the stop is pending,
 * against a check on `intervalMs`, because a run can say nothing for
 * minutes while its task list must still be read. */
export async function* untilStopBoundary(options: StopBoundaryOptions): AsyncGenerator<Event> {
  const { changeDir, stopAsked, onWake, announce, denyPermission, endRun } = options;
  const mayDeny = options.mayDenyPermissions ?? true;
  const iterator = options.events[Symbol.asyncIterator]();
  const markers = new TaskMarkerReader();
  let pending: Promise<IteratorResult<Event>> | undefined;
  let announced = false;
  let ending = false;
  let lastMarker: string | undefined;
  let tickedAtAnnouncement: number | undefined;
  let pendingPermission: string | undefined;
  let ticker: ReturnType<typeof setInterval> | undefined;
  let wake: (() => void) | undefined;
  /** Whether the held request has been answered, so it is answered once
   * and not on every wake. */
  let answered = false;
  /** Set when a held request came due, so the stage ends on the task it
   * named rather than waiting for the next sound point after it: the tick
   * of that task is the sound point (a-run-is-told-where-to-stop). */
  let endsOnDueTask = false;
  let tickerMs: number | undefined;
  const runTicker = (ms: number) => {
    if (tickerMs === ms) return;
    if (ticker !== undefined) clearInterval(ticker);
    tickerMs = ms;
    ticker = setInterval(() => wake?.(), ms);
  };
  const heldTask = () => options.stopAfterTask?.();
  const dueNow = (task: string, why: "ticked" | "passed" | "absent") => {
    if (answered) return;
    answered = true;
    // A task the change does not have leaves the run going; the other two
    // are the point the operator named, and the stage ends there.
    if (why !== "absent") endsOnDueTask = true;
    options.onStopAfterDue?.({ task, why });
  };
  const end = () => {
    if (ending) return;
    ending = true;
    endRun();
  };
  try {
    for (;;) {
      pending ??= iterator.next();
      // A caller that can hold a request needs the ticker from the start,
      // not from the moment one arrives: the request is made from another
      // thread of control, and a silent agent leaves this loop with
      // nothing to wake it. The tick only wakes the loop; the task list
      // is read only while a request is actually held.
      if (options.stopAfterTask !== undefined) {
        const holding = !announced && !answered && heldTask() !== undefined;
        runTicker(options.intervalMs ?? (holding ? STOP_AFTER_CHECK_INTERVAL_MS : STOP_CHECK_INTERVAL_MS));
      }
      const step: IteratorResult<Event> | "wake" = stopAsked() && !announced
        ? "wake"
        : await Promise.race([
          pending,
          new Promise<"wake">((resolve) => {
            wake = () => resolve("wake");
            onWake(wake);
          }),
        ]);
      onWake(undefined);
      if (step === "wake") {
        const heldOnWake = announced || answered ? undefined : heldTask();
        if (heldOnWake !== undefined) {
          const state = await readTaskTickState(changeDir, heldOnWake);
          if (state === "ticked") dueNow(heldOnWake, "ticked");
          else if (state === "absent") dueNow(heldOnWake, "absent");
        }
        if (stopAsked() && !ending) {
          const ticked = await countTickedTasks(changeDir);
          if (!announced) {
            announced = true;
            tickedAtAnnouncement = ticked;
            yield* announce();
            runTicker(options.intervalMs ?? STOP_CHECK_INTERVAL_MS);
            if (pendingPermission !== undefined && mayDeny) {
              denyPermission(pendingPermission);
              end();
            }
            // The task the request named has just been reached, so this is
            // the point: ending here is ending on a finished task, not
            // cutting into the next one.
            if (endsOnDueTask) end();
          } else if (tickedAtAnnouncement === undefined) {
            tickedAtAnnouncement = ticked;
          } else if (ticked !== undefined && ticked > tickedAtAnnouncement) {
            end();
          }
        }
        continue;
      }
      pending = undefined;
      if (step.done) return;
      const event = step.value;

      if (event.kind === "permissionRequest") {
        pendingPermission = event.requestId;
        if (announced && !ending && mayDeny) {
          denyPermission(event.requestId);
          end();
        }
      } else if (event.kind === "stdout" || event.kind === "stderr" || event.kind === "agentUpdate" || event.kind === "progress") {
        pendingPermission = undefined;
      }
      for (const marker of markers.read(event)) {
        const heldOnMarker = announced || answered ? undefined : heldTask();
        if (heldOnMarker !== undefined && taskComesAfter(marker, heldOnMarker)) dueNow(heldOnMarker, "passed");
        if (announced && marker !== lastMarker) end();
        lastMarker = marker;
      }
      yield event;
    }
  } finally {
    if (ticker !== undefined) clearInterval(ticker);
    onWake(undefined);
    // A consumer that stops reading must not leave the run's generator
    // suspended, as `for await` would not have.
    void iterator.return?.();
  }
}
