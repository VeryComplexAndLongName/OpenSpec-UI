// Running one delegated item, and refusing a tick that said nothing.
//
// The marking has named an agent since a-live-check-names-who-performs-
// it, and nothing dispatched it. This is the half that acts: one item,
// asked for deliberately, through the same `createAgentRunner` a chain
// stage goes through — so the allowlist, the working-directory sandbox
// and the audit entry are the ones already in place, and nothing new is
// trusted.
//
// The gate below is the only new judgement, and it is a narrow one.
// Nothing mechanical can decide whether written evidence is true; one
// thing can be decided, which is whether the item says anything it did
// not say before. See a-delegated-item-runs-its-agent's design.md, "the
// rubber-stamp gate is mechanical and narrow".

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolveDelegatedItems, type DelegatedItem } from "./delegated-items.js";
import { normalizeStepAgent } from "./harness-step-agent.js";
import type { AgentRunner } from "./agent-runner.js";
import type { Command, Event } from "./protocol.js";
import {
  TASK_CHECKBOX_LINE_RE,
  readTaskChecklist,
  taskNumberOf,
  tasksFilePath,
  writeTaskCheckStates,
} from "./task-checklist.js";

/** What the gate found. Its own type rather than a boolean: "the item
 * is still open", "it was ticked and something was written" and "it was
 * ticked in silence" are three different outcomes, and only the last is
 * a refusal. */
export type DelegatedItemGate =
  /** Still unticked — the run did not claim to close anything. */
  | { kind: "still-open" }
  /** Ticked, and the text carries more than it did. Left exactly as the
   * agent wrote it; nothing here says the evidence is true. */
  | { kind: "recorded" }
  /** Ticked with the text otherwise unchanged. The tick was reverted. */
  | { kind: "reverted"; reason: string }
  /** The item could not be found again after the run, so nothing could
   * be compared — reported rather than assumed either way. */
  | { kind: "item-not-found"; reason: string };

export type DelegatedItemRunResult =
  /** Nothing was spawned. */
  | { status: "refused"; reason: string; message: string }
  | {
    status: "ran";
    runId: string;
    agent: string;
    taskNumber?: string;
    outcome: "completed" | "failed" | "cancelled";
    /** Why the run failed or was cancelled, where the agent said. */
    reason?: string;
    gate: DelegatedItemGate;
    message: string;
  };

export interface DelegatedItemRunRequest {
  workspaceRoot: string;
  changeName: string;
  /** Zero-based line of the item in `tasks.md`, as the inbox reports
   * it. One item per request: fanning out across a change's items is a
   * different question, with a different argument about isolation. */
  lineNumber: number;
  /** How the host turns an agent id into a runner — the same seam
   * `HarnessChainRunner` takes, so both hosts hand over the registry
   * they already built with `buildDefaultAgentRunners`, and a test can
   * hand over a fake without a process anywhere near it. */
  resolveRunner: (agentId: string) => AgentRunner | undefined;
  runId?: string;
  /** Every event the run emitted, as it emits them — so a host can show
   * progress. The result is what the surface reports at the end. */
  onEvent?: (event: Event) => void;
}

/** The prompt for one delegated item.
 *
 * Deliberately not `commandInstruction`'s whole-change wording: a
 * delegated item is not an implement, a review or a verify — it is one
 * line of work with a stated artifact to produce. The task's own text
 * goes in verbatim, because the evidence it asks for is written in it
 * and a paraphrase is where that gets lost.
 *
 * The change's own files reach the agent separately, as data, through
 * `prepareAgentContext` — this is the instruction that sits beside
 * them. */
export function buildDelegatedItemPrompt(item: {
  changeName: string;
  text: string;
  taskNumber?: string;
}): string {
  const named = item.taskNumber !== undefined ? `task ${item.taskNumber}` : "one task";
  return [
    "# The one task you are being asked to do",
    "",
    `You are running ${named} of the OpenSpec change "${item.changeName}", and nothing else.`,
    "Do not start other tasks of this change, and do not modify another change.",
    "",
    "## The task, verbatim",
    "",
    item.text,
    "",
    "## How this task is closed",
    "",
    "Record the evidence this task names in the task's own text in tasks.md —",
    "the command you ran, the output it gave, the file and line you changed,",
    "whatever the task asked for — and only then tick its checkbox.",
    "",
    "A tick with nothing written is reverted automatically and the run is",
    "reported as refused. If you could not do the work, or could not produce",
    "the evidence, leave the box unticked and write what you found instead.",
    "That is a useful answer; a tick that stands for nothing is not.",
  ].join("\n");
}

/** One task's line and the indented body under it, verbatim.
 *
 * The body counts: a task records its evidence underneath itself, and a
 * gate that compared only the checkbox line would pass every item whose
 * agent wrote nothing but indented prose — or, worse, refuse every item
 * whose agent did exactly what was asked. */
interface TaskBlock {
  lineNumber: number;
  lines: string[];
  done: boolean;
}

function indentWidthOf(line: string): number {
  return (/^[ \t]*/.exec(line)?.[0] ?? "").length;
}

function readTaskBlockAt(lines: readonly string[], lineNumber: number): TaskBlock | undefined {
  const first = lines[lineNumber];
  const match = first?.match(TASK_CHECKBOX_LINE_RE);
  if (first === undefined || !match) return undefined;

  const indent = indentWidthOf(first);
  const block: string[] = [first];
  for (let index = lineNumber + 1; index < lines.length; index += 1) {
    const line = lines[index] as string;
    if (line.trim().length === 0) {
      block.push(line);
      continue;
    }
    if (indentWidthOf(line) <= indent) break;
    block.push(line);
  }
  // Trailing blanks belong to whatever follows, not to this item — a run
  // that only added a blank line before the next task has not written
  // anything about this one.
  while (block.length > 0 && (block[block.length - 1] as string).trim().length === 0) block.pop();

  return { lineNumber, lines: block, done: (match[1] ?? "").toLowerCase() === "x" };
}

/** The block's text with the checkbox state removed, so "did this item
 * say anything new" is asked about the words and not about the tick. */
function blockTextWithoutState(block: TaskBlock): string {
  const [first = "", ...rest] = block.lines;
  return [first.replace(/^([ \t]*-\s\[)[ xX](\])/, "$1 $2"), ...rest].join("\n");
}

async function readLines(tasksPath: string): Promise<string[]> {
  return (await readFile(tasksPath, "utf8")).split(/\r?\n/);
}

/** Finds the item again after the run: by its task number where it has
 * one, since an agent may legitimately have inserted lines above it,
 * and by line number otherwise. */
async function findBlockAfterRun(
  workspaceRoot: string,
  changeName: string,
  before: { lineNumber: number; taskNumber?: string },
  lines: readonly string[],
): Promise<TaskBlock | undefined> {
  if (before.taskNumber !== undefined) {
    const items = await readTaskChecklist(workspaceRoot, changeName, false);
    const found = items.find((item) => taskNumberOf(item.text) === before.taskNumber);
    if (found) return readTaskBlockAt(lines, found.lineNumber);
    return undefined;
  }
  return readTaskBlockAt(lines, before.lineNumber);
}

function refused(reason: string): DelegatedItemRunResult {
  return { status: "refused", reason, message: `No run was started: ${reason}.` };
}

/** What the surface says about a finished run. Says what the gate
 * checked, and says it narrowly — a passed gate is not a verified
 * claim, and a sentence that let anyone read it as one would undo the
 * reason the gate is worth having. */
function describeRun(
  item: { taskNumber?: string },
  outcome: "completed" | "failed" | "cancelled",
  reason: string | undefined,
  gate: DelegatedItemGate,
): string {
  const named = item.taskNumber !== undefined ? `Task ${item.taskNumber}` : "The item";
  const ended = outcome === "completed"
    ? "The run finished."
    : `The run ${outcome === "cancelled" ? "was cancelled" : "failed"}${reason ? `: ${reason}` : ""}.`;

  switch (gate.kind) {
    case "reverted":
      return `${ended} ${named} came back ticked with nothing written, so the tick was reverted and the run is refused.`;
    case "recorded":
      return `${ended} ${named} is ticked and its text carries more than it did.`
        + " Something was recorded; whether it is true was not checked.";
    case "item-not-found":
      return `${ended} ${named} could not be found again afterwards, so nothing was compared: ${gate.reason}.`;
    case "still-open":
      return `${ended} ${named} is still open.`;
  }
}

/** The same outcome in a few words, for a place with no room for the
 * sentence — a tree row's description, where the sentence goes in the
 * tooltip beside it.
 *
 * Derived from the result rather than written out at the call site, so
 * the short form and `message` cannot come to disagree about what
 * happened. It is deliberately never softer than `message`: a refusal
 * says "refused" in both. */
export function shortDelegatedItemOutcome(result: DelegatedItemRunResult): string {
  if (result.status === "refused") return "refused, nothing ran";
  switch (result.gate.kind) {
    case "reverted":
      return "refused: ticked with nothing written";
    case "recorded":
      return "ticked, something recorded (not checked)";
    case "item-not-found":
      return "ran; the item could not be found afterwards";
    case "still-open":
      return result.outcome === "completed" ? "ran; still open" : `${result.outcome}; still open`;
  }
}

/** Runs the agent one open delegated item names, against that item.
 *
 * Refuses before anything is spawned when the item waits on a person,
 * when it names an id this build does not carry, or when no runner is
 * configured for that id. Afterwards the gate compares the item's text
 * with what it was, and reverts a tick that said nothing new. */
export async function runDelegatedItem(request: DelegatedItemRunRequest): Promise<DelegatedItemRunResult> {
  const { workspaceRoot, changeName, lineNumber } = request;

  const tasksPath = await tasksFilePath(workspaceRoot, changeName, false);
  if (tasksPath === undefined) {
    return refused(`change "${changeName}" has no tasks.md`);
  }

  const tasks = await readTaskChecklist(workspaceRoot, changeName, false);
  const task = tasks.find((candidate) => candidate.lineNumber === lineNumber);
  if (!task) return refused(`no task at line ${lineNumber + 1} of ${changeName}/tasks.md`);
  if (task.done) return refused(`task at line ${lineNumber + 1} of ${changeName}/tasks.md is already ticked`);
  if (task.humanOnly) {
    // Not "no agent is configured" — the marking is the whole point. An
    // item nobody can close is offered no run, and saying why is what
    // keeps the two markings distinguishable.
    return refused(
      `the item at line ${lineNumber + 1} of ${changeName}/tasks.md is marked for a person, and no agent is offered for it`,
    );
  }

  const resolved = await resolveDelegatedItems(workspaceRoot, changeName);
  const item: DelegatedItem | undefined = resolved.items.find((candidate) => candidate.lineNumber === lineNumber);
  if (!item) {
    return refused(`the item at line ${lineNumber + 1} of ${changeName}/tasks.md names no agent`);
  }
  if (!item.known) {
    return refused(`"${item.agent}" is not an agent this build recognises`);
  }
  if (item.changeDir.length === 0) {
    return refused(`change "${changeName}" was not found in this workspace`);
  }

  const runner = request.resolveRunner(item.agent);
  if (!runner) {
    return refused(`no runner is configured for agent "${item.agent}"`);
  }

  const before = readTaskBlockAt(await readLines(tasksPath), lineNumber);
  if (!before) {
    return refused(`the line at ${lineNumber + 1} of ${changeName}/tasks.md is not a checklist item`);
  }
  const beforeText = blockTextWithoutState(before);

  const entry = normalizeStepAgent(item.entry);
  const runId = request.runId ?? randomUUID();
  const command: Command = {
    kind: "implement",
    cwd: workspaceRoot,
    runId,
    agentId: item.agent,
    context: {
      changeDir: item.changeDir,
      promptContext: buildDelegatedItemPrompt(item),
    },
    ...(item.taskNumber !== undefined ? { taskNumber: item.taskNumber } : {}),
    ...(entry.model !== undefined ? { model: entry.model } : {}),
    ...(entry.customAgent !== undefined ? { customAgent: entry.customAgent } : {}),
    ...(entry.effort !== undefined ? { effort: entry.effort } : {}),
    ...(entry.budget !== undefined ? { budget: entry.budget } : {}),
  };

  let outcome: "completed" | "failed" | "cancelled" = "completed";
  let reason: string | undefined;
  for await (const event of runner.run(command)) {
    request.onEvent?.(event);
    if (event.kind === "failed") {
      outcome = "failed";
      reason = event.reason;
    }
    if (event.kind === "cancelled") {
      outcome = "cancelled";
      if (event.reason !== undefined) reason = event.reason;
    }
  }

  const gate = await checkRubberStamp(workspaceRoot, changeName, tasksPath, before, beforeText, item.taskNumber);

  return {
    status: "ran",
    runId,
    agent: item.agent,
    ...(item.taskNumber !== undefined ? { taskNumber: item.taskNumber } : {}),
    outcome,
    ...(reason !== undefined ? { reason } : {}),
    gate,
    message: describeRun(item, outcome, reason, gate),
  };
}

async function checkRubberStamp(
  workspaceRoot: string,
  changeName: string,
  tasksPath: string,
  before: TaskBlock,
  beforeText: string,
  taskNumber: string | undefined,
): Promise<DelegatedItemGate> {
  const lines = await readLines(tasksPath);
  const after = await findBlockAfterRun(
    workspaceRoot,
    changeName,
    { lineNumber: before.lineNumber, ...(taskNumber !== undefined ? { taskNumber } : {}) },
    lines,
  );
  if (!after) {
    return {
      kind: "item-not-found",
      reason: taskNumber !== undefined
        ? `no open task numbered ${taskNumber} is left in ${changeName}/tasks.md`
        : `line ${before.lineNumber + 1} of ${changeName}/tasks.md is no longer a checklist item`,
    };
  }

  if (!after.done) return { kind: "still-open" };
  if (before.done) return { kind: "recorded" };
  if (blockTextWithoutState(after) !== beforeText) return { kind: "recorded" };

  const text = (after.lines[0]?.match(TASK_CHECKBOX_LINE_RE)?.[2] ?? "").trim();
  await writeTaskCheckStates(workspaceRoot, changeName, false, [
    { lineNumber: after.lineNumber, expectedText: text, done: false },
  ]);
  return {
    kind: "reverted",
    reason: "the item became ticked while saying nothing it did not say before",
  };
}
