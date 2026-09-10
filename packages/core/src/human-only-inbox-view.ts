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
  | { kind: "agent"; agent: string; known: boolean };

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
}

/** Who one item waits on, in words — for a row's label in either host. */
export function describeWaitingOn(waitingOn: WaitingOn): string {
  if (waitingOn.kind === "person") return "a person";
  return waitingOn.known ? waitingOn.agent : `"${waitingOn.agent}", which is not a registered agent`;
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
  if (inbox.changesRead === 0) return "No active change to look at.";
  if (inbox.items.length === 0) {
    return `Nothing is waiting — ${changesRead(inbox.changesRead)} read.`;
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

  return `${head}: ${parts.join(", ")}.`;
}
