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

import type { ItemReply } from "./audit-message.js";
import { say, type MessageCode, type MessageLevel, type SaidMessage } from "./message-register.js";
import type { EnrolmentRequest } from "./signature-facts.js";

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
  /** The latest reply a delegated run of this item left, where one was
   * recorded (a-change-says-where-it-stands). */
  reply?: ItemReply;
}

/** A question an agent put to the operator that is not answered yet, from
 * its change's `decisions.md` (the-agent-asks-the-operator, ADR 0042). */
export interface InboxQuestion {
  changeName: string;
  changeDir: string;
  questionId: string;
  text: string;
  /** Zero-based line of its heading in `decisions.md`, for a host that
   * opens the file there. */
  lineNumber: number;
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
  /** Keys that sign a live run's record and are not enrolled, each waiting
   * on a person to say "it was me" (a-run-is-signed-by-its-person). */
  enrolments?: EnrolmentRequest[];
  /** Questions the changes' agents put to the operator and nobody has
   * answered yet. Each one holds a run still. */
  questions?: InboxQuestion[];
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

/** A formatter's line: the words to render, and the identifier they are
 * said under. `code` is absent where the words are a bare value the
 * register holds no entry for — a registered agent's own id, which is
 * data rather than a sentence. */
export type SaidLine = {
  code?: MessageCode;
  level?: MessageLevel;
  text: string;
};

/** Who one item waits on, in words — for a row's label in either host.
 *
 * A disagreement between the change's configuration and the task's own
 * text is said out loud here rather than settled quietly, which is the
 * one case this sentence grew past naming an agent. */
export function describeWaitingOn(waitingOn: WaitingOn): SaidLine {
  if (waitingOn.kind === "person") return say("OSW-TSK-015");
  const unregistered = waitingOn.known ? undefined : say("OSW-TSK-016", { agent: waitingOn.agent });
  const named = unregistered?.text ?? waitingOn.agent;
  if (waitingOn.alsoNamedInText === undefined) return unregistered ?? { text: named };
  return say("OSW-TSK-017", { waiting: named, textagent: waitingOn.alsoNamedInText });
}

/** One unmatched `taskAgents` entry, in words. */
export function describeUnmatchedTaskAgent(unmatched: UnmatchedTaskAgent): SaidMessage {
  const where = unmatched.reason === "task-waits-on-a-person"
    ? "that task is marked for a person"
    : "no open task carries that number";
  return say("OSW-TSK-018", {
    change: unmatched.changeName,
    agent: unmatched.agent,
    task: unmatched.taskNumber,
    where,
  });
}

function changesRead(count: number): string {
  return `${count} active change${count === 1 ? "" : "s"}`;
}

/** The trailing sentences, each on the same line, in the order they are
 * appended: empty where a formatter had nothing to say. */
function appended(...said: Array<SaidMessage | undefined>): string {
  return said.map((line) => (line === undefined ? "" : ` ${line.text}`)).join("");
}

/** The sentence above the list.
 *
 * "Nothing is waiting" and "nothing was read" are different facts, and a
 * surface that shows an empty list for both says neither. A third fact
 * joins them here: how much of what is waiting is a question for a
 * person, and how much is assigned to an agent that has not run yet. */
export function describeHumanOnlyInbox(inbox: HumanOnlyInbox): SaidMessage {
  const stale = appended(
    describeUnmatched(inbox.unmatchedTaskAgents),
    describeUnreadable(inbox.unreadableTaskAgents),
    describeEnrolments(inbox.enrolments),
    describeQuestions(inbox.questions),
  );
  if (inbox.changesRead === 0) {
    return say("OSW-TSK-019", { enrolments: appended(describeEnrolments(inbox.enrolments)) });
  }
  if (inbox.items.length === 0) {
    return say("OSW-TSK-020", { changes: changesRead(inbox.changesRead), stale });
  }

  const changes = new Set(inbox.items.map((item) => item.changeName)).size;
  const parts: string[] = [];
  const people = inbox.items.filter((item) => item.waitingOn.kind === "person").length;
  if (people > 0) parts.push(`${people} on ${say("OSW-TSK-015").text}`);

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
    parts.push(`${group.count} on ${describeWaitingOn({ kind: "agent", agent, known: group.known }).text}`);
  }

  const waiting = parts.join(", ");
  const total = changesRead(inbox.changesRead);
  const said = say("OSW-TSK-021", {
    items: inbox.items.length,
    changes,
    total: inbox.changesRead,
    waiting,
    stale,
  });
  // TSK-021's text is plural-only on both counts ("{items} items waiting",
  // "{total} active changes"), so a singular item or a single active change
  // is said in the carrier's own words rather than the register's; the
  // identifier still rides beside them.
  if (inbox.items.length === 1 || inbox.changesRead === 1) {
    return {
      ...said,
      text: `${inbox.items.length} item${inbox.items.length === 1 ? "" : "s"} waiting,`
        + ` across ${changes} of ${total}: ${waiting}.${stale}`,
    };
  }
  return said;
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
function describeUnreadable(unreadable: readonly UnreadableTaskAgentsConfig[] | undefined): SaidMessage | undefined {
  if (!unreadable || unreadable.length === 0) return undefined;
  const listed = unreadable.map((entry) => `${entry.changeName} (${entry.reason})`).join("; ");
  const count = unreadable.length === 1 ? "1 change's" : `${unreadable.length} changes'`;
  return say("OSW-TSK-022", { count, listed });
}

/** Appended too: a key waiting to be enrolled waits on a person as surely as
 * an item does, and it is not a task, so it is not in the count. */
function describeEnrolments(enrolments: readonly EnrolmentRequest[] | undefined): SaidMessage | undefined {
  if (!enrolments || enrolments.length === 0) return undefined;
  return enrolments.length === 1
    ? say("OSW-TSK-023")
    : say("OSW-TSK-024", { count: enrolments.length });
}

/** Appended as the keys are: a question holds a run until it is answered,
 * and it is not a task, so it is not in the count. */
function describeQuestions(questions: readonly InboxQuestion[] | undefined): SaidMessage | undefined {
  if (!questions || questions.length === 0) return undefined;
  return questions.length === 1
    ? say("OSW-TSK-025")
    : say("OSW-TSK-026", { count: questions.length });
}

function describeUnmatched(unmatched: readonly UnmatchedTaskAgent[] | undefined): SaidMessage | undefined {
  if (!unmatched || unmatched.length === 0) return undefined;
  const listed = unmatched.map((entry) => describeUnmatchedTaskAgent(entry).text).join("; ");
  const count = `${unmatched.length} taskAgents entr${unmatched.length === 1 ? "y" : "ies"}`;
  // TSK-027's text says "taskAgents entry(ies)", where this sentence has
  // always said "entry" or "entries"; the carrier's own words are kept
  // with the identifier beside them.
  return { ...say("OSW-TSK-027", { count: unmatched.length, listed }), text: `${count} matched no open task: ${listed}.` };
}

/** The same sentence, over a read that may have failed.
 *
 * A failure says so, and says why, in the place the count would have
 * been: "nothing is waiting" and "nobody could find out" are different
 * facts about a workspace, and only one of them means the reader can
 * stop looking. */
export function describeHumanOnlyInboxState(state: HumanOnlyInboxState): SaidMessage {
  if (state.status === "loaded") return describeHumanOnlyInbox(state.inbox);
  const reason = state.reason.trim();
  return say("OSW-TSK-028", { reason: reason.length > 0 ? reason : "no reason given" });
}
