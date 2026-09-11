// What an inbox of items nobody's implementing agent will close looks
// like, and how to say what is in it.
//
// Its own leaf module with zero Node imports, for the reason
// `custom-agent-family.ts` and `harness-effort-level.ts` state in their
// own headers: `webui` renders this, and re-exporting a *value* from
// `human-only-inbox.ts` — which reads task files, so it imports
// `node:fs` through `readTaskChecklist` — pulls those built-ins into the
// browser bundle. The bundle-safety test caught exactly that when this
// lived there, with 18 unresolvable imports starting at `child_process`.
//
// See human-only-inbox-in-the-shell, and
// a-live-check-names-who-performs-it for why an item says who it waits
// on rather than being assumed to wait on a person.

/** Who an open item waits on.
 *
 * `known` is whether the named agent is in the registry. An id nothing
 * recognises is reported rather than treated as delegated: an item
 * delegated to nobody looks assigned and is not. */
export type WaitingOn =
  | { kind: "person" }
  | {
    kind: "agent";
    agent: string;
    known: boolean;
    /** Where the name came from: the change's own `harness.json`
     * (`taskAgents`) or the task's `**Delegated to <id>**` marker.
     * Absent on a reading made before a change could state one, which
     * is every reading that has no configuration to consult. */
    source?: "file" | "task-text";
    /** The agent the task's own text names, when the file names a
     * different one. Carried rather than resolved away: a disagreement
     * between two statements about the same task is worth seeing, and
     * the surface that shows only the winner hides the fact that there
     * was an argument. See a-delegated-item-runs-its-agent. */
    alsoNamedInText?: string;
  };

/** A `taskAgents` key that matched no open task line of its change.
 *
 * Reported, never ignored: an entry naming a task that no longer exists
 * is the stale-sidecar failure arriving by another route, and the only
 * defence against it is to say so. `reason` separates the two ways it
 * happens, because they are fixed differently — a renumbered task wants
 * the key changed, a task marked for a person wants the key removed. */
export interface UnmatchedTaskAgent {
  changeName: string;
  taskNumber: string;
  agent: string;
  reason: "no-such-open-task" | "task-waits-on-a-person";
}

/** A change whose `harness.json` could not be read, and why.
 *
 * Its items are still listed, from their task text alone. One change's
 * broken file hiding what the other seven are waiting on would be a
 * single failure swallowing an answer nobody asked it about. */
export interface UnreadableTaskAgentsConfig {
  changeName: string;
  reason: string;
}

export interface HumanOnlyItem {
  changeName: string;
  changeDir: string;
  /** Zero-based, as `readTaskChecklist` reports it — what a host needs
   * to open the file at the line. */
  lineNumber: number;
  text: string;
  waitingOn: WaitingOn;
}

export interface HumanOnlyInbox {
  items: HumanOnlyItem[];
  /** Active changes looked at, so an empty answer can be told apart from
   * an unread workspace. */
  changesRead: number;
  /** `taskAgents` entries that matched no open line. Optional so a
   * reading produced before changes could state one stays a valid
   * inbox; `collectHumanOnlyInbox` always sets it, empty included. */
  unmatchedTaskAgents?: UnmatchedTaskAgent[];
  /** Changes whose `harness.json` could not be read. Their items are
   * present, resolved from the task text alone. */
  unreadableTaskAgents?: UnreadableTaskAgentsConfig[];
}

/** What a host has, once it has asked.
 *
 * Three states, not two: a surface that renders a failed read as no
 * block at all says exactly what it says when nothing has been asked for
 * yet, and telling those apart is the distinction this surface exists to
 * make. See a-check-that-passes-checked-something. */
export type HumanOnlyInboxState =
  | { status: "loaded"; inbox: HumanOnlyInbox }
  | { status: "failed"; reason: string };

/** Who one item waits on, in words — for a row's label in either host.
 *
 * A disagreement between the change's configuration and the task's own
 * text is said out loud here rather than settled quietly, which is the
 * one case this sentence grew past naming an agent. */
export function describeWaitingOn(waitingOn: WaitingOn): string {
  if (waitingOn.kind === "person") return "a person";
  const named = waitingOn.known ? waitingOn.agent : `"${waitingOn.agent}", which is not a registered agent`;
  if (waitingOn.alsoNamedInText === undefined) return named;
  return `${named} (this change's harness.json names it; the task text names ${waitingOn.alsoNamedInText})`;
}

/** One unmatched `taskAgents` entry, in words. */
export function describeUnmatchedTaskAgent(unmatched: UnmatchedTaskAgent): string {
  const where = unmatched.reason === "task-waits-on-a-person"
    ? "that task is marked for a person"
    : "no open task carries that number";
  return `${unmatched.changeName} names ${unmatched.agent} for task ${unmatched.taskNumber}, but ${where}`;
}

function changesRead(count: number): string {
  return `${count} active change${count === 1 ? "" : "s"}`;
}

/** The sentence above the list.
 *
 * "Nothing is waiting" and "nothing was read" are different facts, and a
 * surface that shows an empty list for both says neither. A third fact
 * joins them here: how much of what is waiting is a question for a
 * person, and how much is assigned to an agent that has not run yet. */
export function describeHumanOnlyInbox(inbox: HumanOnlyInbox): string {
  const stale = describeUnmatched(inbox.unmatchedTaskAgents) + describeUnreadable(inbox.unreadableTaskAgents);
  if (inbox.changesRead === 0) return "No active change to look at.";
  if (inbox.items.length === 0) {
    return `Nothing is waiting — ${changesRead(inbox.changesRead)} read.${stale}`;
  }

  const changes = new Set(inbox.items.map((item) => item.changeName)).size;
  const head = `${inbox.items.length} item${inbox.items.length === 1 ? "" : "s"} waiting,`
    + ` across ${changes} of ${changesRead(inbox.changesRead)}`;

  const parts: string[] = [];
  const people = inbox.items.filter((item) => item.waitingOn.kind === "person").length;
  if (people > 0) parts.push(`${people} on a person`);

  // Busiest first, then by name, so the sentence is stable across reads
  // of the same workspace.
  const byAgent = new Map<string, { count: number; known: boolean }>();
  for (const item of inbox.items) {
    if (item.waitingOn.kind !== "agent") continue;
    const seen = byAgent.get(item.waitingOn.agent);
    if (seen) seen.count += 1;
    else byAgent.set(item.waitingOn.agent, { count: 1, known: item.waitingOn.known });
  }
  const ordered = [...byAgent.entries()].sort(
    (left, right) => right[1].count - left[1].count || left[0].localeCompare(right[0]),
  );
  for (const [agent, group] of ordered) {
    parts.push(`${group.count} on ${describeWaitingOn({ kind: "agent", agent, known: group.known })}`);
  }

  return `${head}: ${parts.join(", ")}.${stale}`;
}

/** The trailing sentence naming `taskAgents` entries nothing matched.
 *
 * Appended rather than folded into the count: what is waiting and what
 * is configured for something that is not there are different facts,
 * and an entry pointing at a task that no longer exists would otherwise
 * be visible nowhere at all. Empty when there are none, so the sentence
 * is byte-identical to what it was for every workspace without one. */
/** Appended for the same reason as the unmatched entries: a change
 * whose configuration could not be read still has its items listed, and
 * a reader who is not told would take the list as complete. */
function describeUnreadable(unreadable: readonly UnreadableTaskAgentsConfig[] | undefined): string {
  if (!unreadable || unreadable.length === 0) return "";
  const listed = unreadable.map((entry) => `${entry.changeName} (${entry.reason})`).join("; ");
  const count = unreadable.length === 1 ? "1 change's" : `${unreadable.length} changes'`;
  return ` ${count} harness.json could not be read, so their items are resolved from the task text alone: ${listed}.`;
}

function describeUnmatched(unmatched: readonly UnmatchedTaskAgent[] | undefined): string {
  if (!unmatched || unmatched.length === 0) return "";
  const listed = unmatched.map(describeUnmatchedTaskAgent).join("; ");
  const count = `${unmatched.length} taskAgents entr${unmatched.length === 1 ? "y" : "ies"}`;
  return ` ${count} matched no open task: ${listed}.`;
}

/** The same sentence, over a read that may have failed.
 *
 * A failure says so, and says why, in the place the count would have
 * been: "nothing is waiting" and "nobody could find out" are different
 * facts about a workspace, and only one of them means the reader can
 * stop looking. */
export function describeHumanOnlyInboxState(state: HumanOnlyInboxState): string {
  if (state.status === "loaded") return describeHumanOnlyInbox(state.inbox);
  const reason = state.reason.trim();
  return `What is waiting could not be read: ${reason.length > 0 ? reason : "no reason given"}.`;
}
