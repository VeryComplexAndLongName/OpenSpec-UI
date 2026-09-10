// What an inbox of human-only items looks like, and how to say what is
// in it.
//
// Its own leaf module with zero Node imports, for the reason
// `custom-agent-family.ts` and `harness-effort-level.ts` state in their
// own headers: `webui` renders this, and re-exporting a *value* from
// `human-only-inbox.ts` — which reads task files, so it imports
// `node:fs` through `readTaskChecklist` — pulls those built-ins into the
// browser bundle. The bundle-safety test caught exactly that when this
// lived there, with 18 unresolvable imports starting at `child_process`.
//
// See human-only-inbox-in-the-shell.

export interface HumanOnlyItem {
  changeName: string;
  changeDir: string;
  /** Zero-based, as `readTaskChecklist` reports it — what a host needs
   * to open the file at the line. */
  lineNumber: number;
  text: string;
}

export interface HumanOnlyInbox {
  items: HumanOnlyItem[];
  /** Active changes looked at, so an empty answer can be told apart from
   * an unread workspace. */
  changesRead: number;
}

/** The sentence above the list.
 *
 * "Nothing is waiting" and "nothing was read" are different facts, and a
 * surface that shows an empty list for both says neither. */
export function describeHumanOnlyInbox(inbox: HumanOnlyInbox): string {
  if (inbox.changesRead === 0) return "No active change to look at.";
  if (inbox.items.length === 0) {
    return `Nothing is waiting on a person — ${inbox.changesRead} active change${inbox.changesRead === 1 ? "" : "s"} read.`;
  }
  const changes = new Set(inbox.items.map((item) => item.changeName)).size;
  return `${inbox.items.length} item${inbox.items.length === 1 ? "" : "s"} waiting on a person,`
    + ` across ${changes} of ${inbox.changesRead} active change${inbox.changesRead === 1 ? "" : "s"}.`;
}
