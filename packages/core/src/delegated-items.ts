// Which agent runs which open item of a change, and where that answer
// came from.
//
// `a-live-check-names-who-performs-it` gave a task a way to name the
// agent that closes it, and both hosts a way to show the name. Nothing
// acted on it: seven delegated items were closed on 2026-09-11 and a
// person drove every one. This is the reading half of acting on it —
// the run itself is `delegated-item-run.ts`.
//
// Two statements can name an agent for one task: the change's own
// `harness.json` (`taskAgents`, keyed by the task's number) and the
// task's `**Delegated to <id>**` marker. The file wins, and where they
// disagree both are carried out rather than one being resolved away in
// silence — see a-delegated-item-runs-its-agent's design.md.

import { AGENT_REGISTRY } from "./agents/registry.js";
import { readChangeHarnessConfig } from "./harness-config.js";
import { normalizeStepAgent, type HarnessStepAgent, type HarnessTaskAgents } from "./harness-step-agent.js";
import type { UnmatchedTaskAgent, WaitingOn } from "./human-only-inbox-view.js";
import { readTaskChecklist, taskNumberOf, type TaskChecklistItem } from "./task-checklist.js";
import { discoverOpenSpecWorkspace } from "./workbench.js";

/** What one open task's agent resolved to, and from which statement. */
export interface TaskAgentAssignment {
  /** The registry id that will be run. */
  agent: string;
  /** Whether `agent` is an id this build carries. An unknown id is
   * carried, not dropped: an item delegated to nobody looks assigned
   * and is not, and the run refuses it by name. */
  known: boolean;
  source: "file" | "task-text";
  /** The entry to run with — the configured object (model, effort,
   * budget, custom agent) when the file named it, or the bare id when
   * the task text did. */
  entry: HarnessStepAgent;
  /** The task text's own agent, when the file overrode a different one. */
  alsoNamedInText?: string;
}

export interface DelegatedItem extends TaskAgentAssignment {
  changeName: string;
  changeDir: string;
  /** Zero-based, as `readTaskChecklist` reports it. */
  lineNumber: number;
  text: string;
  /** The leading number of the task's line, where it has one. A task
   * with no number can still be delegated by its own text; it just
   * cannot be named by a `taskAgents` key. */
  taskNumber?: string;
}

export interface DelegatedItems {
  changeName: string;
  changeDir: string;
  /** Open items naming an agent, in the order they appear in tasks.md. */
  items: DelegatedItem[];
  unmatched: UnmatchedTaskAgent[];
}

function isRegisteredAgent(agentId: string): boolean {
  return AGENT_REGISTRY.some((descriptor) => descriptor.id === agentId);
}

/** Pure over one change's parsed tasks and its `taskAgents` map.
 *
 * Separated from the reading so both callers — the per-change resolver
 * below and `collectHumanOnlyInbox`, which walks every change — apply
 * one precedence rule rather than two copies of it.
 *
 * A done task is skipped: this answers what is still waiting. A
 * human-only task is skipped whatever the file says, because "nobody
 * can do this" is the marking's whole point — and the `taskAgents`
 * entry that named it is reported as unmatched rather than quietly
 * overriding it. */
export function assignTaskAgents(
  tasks: readonly TaskChecklistItem[],
  taskAgents: HarnessTaskAgents,
): { byLine: Map<number, TaskAgentAssignment>; unmatched: Array<Omit<UnmatchedTaskAgent, "changeName">> } {
  const byLine = new Map<number, TaskAgentAssignment>();
  const matched = new Set<string>();
  const claimedByAPerson = new Set<string>();

  for (const task of tasks) {
    if (task.done) continue;
    const taskNumber = taskNumberOf(task.text);
    const fromFile = taskNumber !== undefined ? taskAgents[taskNumber] : undefined;

    if (task.humanOnly) {
      if (taskNumber !== undefined && fromFile !== undefined) claimedByAPerson.add(taskNumber);
      continue;
    }

    if (fromFile !== undefined) {
      if (taskNumber !== undefined) matched.add(taskNumber);
      const agent = normalizeStepAgent(fromFile).agent;
      const assignment: TaskAgentAssignment = {
        agent,
        known: isRegisteredAgent(agent),
        source: "file",
        entry: fromFile,
      };
      if (task.delegatedTo !== undefined && task.delegatedTo !== agent) {
        assignment.alsoNamedInText = task.delegatedTo;
      }
      byLine.set(task.lineNumber, assignment);
      continue;
    }

    if (task.delegatedTo !== undefined) {
      byLine.set(task.lineNumber, {
        agent: task.delegatedTo,
        known: isRegisteredAgent(task.delegatedTo),
        source: "task-text",
        entry: task.delegatedTo,
      });
    }
  }

  const unmatched: Array<Omit<UnmatchedTaskAgent, "changeName">> = [];
  for (const [taskNumber, entry] of Object.entries(taskAgents)) {
    if (matched.has(taskNumber)) continue;
    unmatched.push({
      taskNumber,
      agent: normalizeStepAgent(entry).agent,
      reason: claimedByAPerson.has(taskNumber) ? "task-waits-on-a-person" : "no-such-open-task",
    });
  }

  return { byLine, unmatched };
}

/** Who an item waits on, from its assignment — the shape both hosts'
 * rows already render. */
export function waitingOnFor(assignment: TaskAgentAssignment): WaitingOn {
  return {
    kind: "agent",
    agent: assignment.agent,
    known: assignment.known,
    source: assignment.source,
    ...(assignment.alsoNamedInText !== undefined ? { alsoNamedInText: assignment.alsoNamedInText } : {}),
  };
}

/** A change's `taskAgents`, or an empty map when it has no
 * `harness.json` or the file sets none.
 *
 * A malformed file is not swallowed — it is rethrown naming the change,
 * because the caller reads many changes and `Invalid harness config:
 * ...` on its own says nothing about which one to open. */
export async function readTaskAgents(workspaceRoot: string, changeName: string): Promise<HarnessTaskAgents> {
  try {
    const override = await readChangeHarnessConfig(workspaceRoot, changeName);
    return override?.taskAgents ?? {};
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${changeName}/harness.json: ${reason}`);
  }
}

/** Every open item of one change that names an agent, plus the
 * `taskAgents` entries that named nothing. */
export async function resolveDelegatedItems(
  workspaceRoot: string,
  changeName: string,
): Promise<DelegatedItems> {
  const workspace = await discoverOpenSpecWorkspace(workspaceRoot);
  const change = workspace.changes.find((candidate) => candidate.name === changeName);
  const changeDir = change?.path ?? "";

  const tasks = await readTaskChecklist(workspaceRoot, changeName, false);
  const taskAgents = await readTaskAgents(workspaceRoot, changeName);
  const { byLine, unmatched } = assignTaskAgents(tasks, taskAgents);

  const items: DelegatedItem[] = [];
  for (const task of tasks) {
    const assignment = byLine.get(task.lineNumber);
    if (!assignment) continue;
    const taskNumber = taskNumberOf(task.text);
    items.push({
      ...assignment,
      changeName,
      changeDir,
      lineNumber: task.lineNumber,
      text: task.text,
      ...(taskNumber !== undefined ? { taskNumber } : {}),
    });
  }

  return {
    changeName,
    changeDir,
    items,
    unmatched: unmatched.map((entry) => ({ ...entry, changeName })),
  };
}
