// The task a run says it is on — a-run-says-which-task-it-is-on (ADR 0029).
//
// The implementing instruction asks the agent to print a line of its own,
// `Starting task <number>`, before it starts a task. This reads such a line,
// and pairs the number it names with the change's task list. Nothing here
// guesses: prose such as "working on 2.3" names no task, and a number the
// list does not have names none either.

import { TASK_NUMBER_PATTERN } from "./harness-step-agent.js";
import { taskNumberOf, type TaskChecklistItem } from "./task-checklist.js";

/** Leading quote, heading and list marks, however many and in any order:
 * `> - Starting task 2.3`, `## Starting task 2.3`. A `*` here also takes
 * the opening half of bold, which the pattern below allows to close. */
const LEADING_MARKS_RE = /^(?:[>#*-]\s*)+/;

/** An optional emphasis mark: bold, underline bold, or a single backtick. */
const EMPHASIS = "(?:\\*\\*|__|`)?";

/** `Starting task`, a number of digits separated by single dots, then the
 * end of the line, a full stop, or a colon and whatever follows it. The
 * emphasis a model wraps the marker in may close before or after the full
 * stop or the colon. */
const MARKER_RE = new RegExp(
  `^${EMPHASIS}Starting task (\\d+(?:\\.\\d+)*)${EMPHASIS}\\.?${EMPHASIS}(?::.*)?$`,
);

/** The task number a marker line names, or `undefined` for any other line.
 *
 * Only at the start of a line: `I am starting task 2.3` is prose, and so is
 * `Starting task 2.3 now`. */
export function readTaskMarker(line: string): string | undefined {
  const text = line.trim().replace(LEADING_MARKS_RE, "");
  const number = MARKER_RE.exec(text)?.[1];
  return number !== undefined && TASK_NUMBER_PATTERN.test(number) ? number : undefined;
}

/** What a status record says about the task in hand. */
export interface RecordedTask {
  number: string;
  /** `agent`: the agent's own marker. `command`: the task the run was
   * started for, as a delegated item is. */
  source: "agent" | "command";
  since: string;
}

export interface TaskInHand {
  number: string;
  /** The task's text as `tasks.md` has it, without its number. */
  text: string;
  source: "agent" | "command";
}

/** The change's task that a record's task number names, or `undefined`
 * when the record names none or names a number the list does not have.
 *
 * Paired where the list is read anyway — the survey, `openspec-ui-cli
 * status` — rather than in the writer, which would read `tasks.md` inside a
 * run's event loop on every marker. */
export function taskInHand(task: RecordedTask | null, items: readonly TaskChecklistItem[]): TaskInHand | undefined {
  if (task === null) return undefined;
  const item = items.find((candidate) => taskNumberOf(candidate.text) === task.number);
  if (item === undefined) return undefined;
  return { number: task.number, text: item.text.trim().slice(task.number.length).trim(), source: task.source };
}
