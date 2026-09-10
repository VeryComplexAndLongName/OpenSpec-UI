// What is waiting on a person, across every active change.
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

import type { HumanOnlyInbox, HumanOnlyItem } from "./human-only-inbox-view.js";
import { readTaskChecklist } from "./task-checklist.js";
import { discoverOpenSpecWorkspace } from "./workbench.js";

// The shape and the sentence live in `human-only-inbox-view.ts`, a leaf
// module with no Node imports: `webui` needs them, and re-exporting a
// value from here would pull `node:fs` into the browser bundle through
// `readTaskChecklist`.
export type { HumanOnlyInbox, HumanOnlyItem } from "./human-only-inbox-view.js";
export { describeHumanOnlyInbox } from "./human-only-inbox-view.js";

/** Every unticked human-only task in every active change.
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
      if (!task.humanOnly || task.done) continue;
      items.push({
        changeName: change.name,
        changeDir: change.path,
        lineNumber: task.lineNumber,
        text: task.text,
      });
    }
  }

  return { items, changesRead: workspace.changes.length };
}
