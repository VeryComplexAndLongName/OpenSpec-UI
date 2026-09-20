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
import type { ItemReply } from "./audit-message.js";
import { changeNameOf } from "./audit-runs.js";
import { deferredListPath, readDeferredItems } from "./deferred-items.js";
import { assignTaskAgents, readTaskAgents, waitingOnFor } from "./delegated-items.js";
import { readEnrolmentRequests } from "./enrolment.js";
import { auditLogPath, FileAuditLog, type AuditEntry } from "./security.js";
import type { EnrolmentRequest } from "./signature-facts.js";
import { readTaskChecklistOf, taskNumberOf } from "./task-checklist.js";
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
 * so an archived change has nothing waiting by construction - and
 * reading 285 of them to confirm would cost 309 ms, measured on
 * 2026-09-20. A judgement that must outlive its change moves to the
 * deferred list instead, which is one file and one read
 * (a-change-lands-with-nothing-open).
 */
export interface HumanOnlyInboxOptions {
  /** Test seam: the keys waiting to be enrolled. Production reads them
   * beside the repository's status directory. */
  readEnrolments?: (workspaceRoot: string) => Promise<EnrolmentRequest[]>;
  /** Test seam: the workspace's audit entries, where a delegated run's
   * reply is kept. Production reads the workspace's audit log. */
  readAuditEntries?: (workspaceRoot: string) => Promise<AuditEntry[]>;
}

/** The latest reply to each change's task, by `<change>|<task number>`. */
function latestReplies(entries: readonly AuditEntry[]): Map<string, ItemReply> {
  const latest = new Map<string, ItemReply>();
  for (const entry of entries) {
    const message = entry.message;
    if (message?.kind !== "reply" || message.outcome === undefined) continue;
    if (entry.changeDir === undefined || entry.taskNumber === undefined) continue;
    const key = `${changeNameOf(entry.changeDir)}|${entry.taskNumber}`;
    const seen = latest.get(key);
    if (seen === undefined || message.at >= seen.at) {
      latest.set(key, { at: message.at, body: message.body, outcome: message.outcome });
    }
  }
  return latest;
}

export async function collectHumanOnlyInbox(workspaceRoot: string, options: HumanOnlyInboxOptions = {}): Promise<HumanOnlyInbox> {
  // The active changes, read once, and each task list from that reading
  // (the-pipeline-reads-each-workspace-once).
  const workspace = await discoverOpenSpecWorkspace(workspaceRoot, { changes: "active" });
  const items: HumanOnlyItem[] = [];
  const unmatchedTaskAgents: UnmatchedTaskAgent[] = [];
  const unreadableTaskAgents: UnreadableTaskAgentsConfig[] = [];

  // Questions that outlived their changes, from the one file they move
  // to. Read first, so an empty workspace still answers with them.
  for (const deferred of await readDeferredItems(workspaceRoot)) {
    if (deferred.done) continue;
    items.push({
      changeName: deferred.fromChange ?? "(deferred)",
      changeDir: deferredListPath(workspaceRoot),
      lineNumber: deferred.lineNumber,
      text: deferred.text,
      waitingOn: { kind: "person" },
    });
  }

  for (const change of workspace.changes) {
    const { items: tasks } = await readTaskChecklistOf(change);
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

  // Best-effort, like the task agents above: a workspace that is not a git
  // repository, or has no status directory, has nobody waiting to be
  // enrolled, and the items still answer.
  const readEnrolments = options.readEnrolments
    ?? (async (root: string) => (await readEnrolmentRequests(root)).requests);
  const enrolments = await readEnrolments(workspaceRoot).catch((): EnrolmentRequest[] => []);

  // The latest reply beneath each item a delegated run answered. An audit log
  // that cannot be read shows no replies, and the items still answer.
  const readEntries = options.readAuditEntries ?? ((root: string) => new FileAuditLog(auditLogPath(root)).readEntries());
  const replies = latestReplies(await readEntries(workspaceRoot).catch((): AuditEntry[] => []));
  for (const item of items) {
    const number = taskNumberOf(item.text);
    const reply = number === undefined ? undefined : replies.get(`${item.changeName}|${number}`);
    if (reply !== undefined) item.reply = reply;
  }

  return { items, changesRead: workspace.changes.length, unmatchedTaskAgents, unreadableTaskAgents, enrolments };
}
