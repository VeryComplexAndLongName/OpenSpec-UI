// What is waiting on somebody other than the implementing agent, across
// every active change.
//
// A change with one unticked human-only item looks, from outside,
// exactly like a change nobody has started: both are `in-progress` with
// a task open. That question was asked out loud on 2026-09-09 — "six
// changes not started, is that deliberate?" — about six changes that
// were finished and waiting on a live check.
//
// The VS Code tree has answered this since human-only-inbox; the
// standalone shell has not, and the collecting loop lived inside that
// tree rather than anywhere both hosts could reach. This is that loop,
// moved where it can be read twice.
//
// Since a-live-check-names-who-performs-it it also carries items
// delegated to a named agent, which are waiting on something just as
// surely as the ones waiting on a person.

import type {
  HumanOnlyInbox,
  HumanOnlyItem,
  UnmatchedTaskAgent,
  UnreadableTaskAgentsConfig,
  WaitingOn,
} from "./human-only-inbox-view.js";
import type { HarnessTaskAgents } from "./harness-step-agent.js";
import { assignTaskAgents, readTaskAgents, waitingOnFor } from "./delegated-items.js";
import { readTaskChecklist } from "./task-checklist.js";
import { discoverOpenSpecWorkspace } from "./workbench.js";

// The shape and the sentence live in `human-only-inbox-view.ts`, a leaf
// module with no Node imports: `webui` needs them, and re-exporting a
// value from here would pull `node:fs` into the browser bundle through
// `readTaskChecklist`.
export type {
  HumanOnlyInbox,
  HumanOnlyInboxState,
  HumanOnlyItem,
  UnmatchedTaskAgent,
  WaitingOn,
} from "./human-only-inbox-view.js";
export {
  describeHumanOnlyInbox,
  describeHumanOnlyInboxState,
  describeUnmatchedTaskAgent,
  describeWaitingOn,
} from "./human-only-inbox-view.js";

/** Every unticked item in every active change that no implementing agent
 * will close: the ones marked for a person, and the ones delegated to a
 * named agent.
 *
 * Which agent a delegated item names is `assignTaskAgents`' answer, not
 * this loop's: since a-delegated-item-runs-its-agent a change may name
 * one for a numbered task in its own `harness.json`, and a second copy
 * of that precedence rule here would be a second answer to the same
 * question.
 *
 * Archived changes are not read: archiving requires every task ticked,
 * so an archived change has nothing waiting by construction — and
 * reading 178 of them to confirm that would cost the caller a page load.
 */
export async function collectHumanOnlyInbox(workspaceRoot: string): Promise<HumanOnlyInbox> {
  const workspace = await discoverOpenSpecWorkspace(workspaceRoot);
  const items: HumanOnlyItem[] = [];
  const unmatchedTaskAgents: UnmatchedTaskAgent[] = [];
  const unreadableTaskAgents: UnreadableTaskAgentsConfig[] = [];

  for (const change of workspace.changes) {
    const tasks = await readTaskChecklist(workspaceRoot, change.name, false);
    // One change's unreadable `harness.json` degrades that change, not
    // the inbox. Letting it throw would hide what every other change is
    // waiting on behind a single broken file — a failure swallowing an
    // answer nobody asked it about. The change is named instead, and its
    // items resolve from their task text alone.
    let taskAgents: HarnessTaskAgents = {};
    try {
      taskAgents = await readTaskAgents(workspaceRoot, change.name);
    } catch (error) {
      unreadableTaskAgents.push({
        changeName: change.name,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
    const { byLine, unmatched } = assignTaskAgents(tasks, taskAgents);
    for (const entry of unmatched) unmatchedTaskAgents.push({ ...entry, changeName: change.name });

    for (const task of tasks) {
      if (task.done) continue;
      const assignment = byLine.get(task.lineNumber);
      const waitingOn: WaitingOn | undefined = task.humanOnly
        ? { kind: "person" }
        : assignment && waitingOnFor(assignment);
      if (!waitingOn) continue;
      items.push({
        changeName: change.name,
        changeDir: change.path,
        lineNumber: task.lineNumber,
        text: task.text,
        waitingOn,
      });
    }
  }

  return { items, changesRead: workspace.changes.length, unmatchedTaskAgents, unreadableTaskAgents };
}
