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

import type { HumanOnlyInbox, HumanOnlyItem, WaitingOn } from "./human-only-inbox-view.js";
import { AGENT_REGISTRY } from "./agents/registry.js";
import { readTaskChecklist, type TaskChecklistItem } from "./task-checklist.js";
import { discoverOpenSpecWorkspace } from "./workbench.js";

// The shape and the sentence live in `human-only-inbox-view.ts`, a leaf
// module with no Node imports: `webui` needs them, and re-exporting a
// value from here would pull `node:fs` into the browser bundle through
// `readTaskChecklist`.
export type { HumanOnlyInbox, HumanOnlyItem, WaitingOn } from "./human-only-inbox-view.js";
export { describeHumanOnlyInbox, describeWaitingOn } from "./human-only-inbox-view.js";

/** Who this task waits on, or `undefined` where it waits on the
 * implementing agent like any other task.
 *
 * The registry check happens here rather than in the parser: whether a
 * line *names* an agent is a fact about the text, and whether that name
 * *is* an agent is a fact about this build's registry. */
function waitingOnFor(task: TaskChecklistItem): WaitingOn | undefined {
  if (task.humanOnly) return { kind: "person" };
  if (task.delegatedTo === undefined) return undefined;
  return {
    kind: "agent",
    agent: task.delegatedTo,
    known: AGENT_REGISTRY.some((descriptor) => descriptor.id === task.delegatedTo),
  };
}

/** Every unticked item in every active change that no implementing agent
 * will close: the ones marked for a person, and the ones delegated to a
 * named agent.
 *
 * Archived changes are not read: archiving requires every task ticked,
 * so an archived change has nothing waiting by construction — and
 * reading 178 of them to confirm that would cost the caller a page load.
 */
export async function collectHumanOnlyInbox(workspaceRoot: string): Promise<HumanOnlyInbox> {
  const workspace = await discoverOpenSpecWorkspace(workspaceRoot);
  const items: HumanOnlyItem[] = [];

  for (const change of workspace.changes) {
    const tasks = await readTaskChecklist(workspaceRoot, change.name, false);
    for (const task of tasks) {
      if (task.done) continue;
      const waitingOn = waitingOnFor(task);
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

  return { items, changesRead: workspace.changes.length };
}
