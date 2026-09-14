// A request to an agent and its reply share one envelope — ADR 0028's
// amendment of 2026-09-13, "a request has a reply, and both are kept".
//
// A leaf with no imports, so the browser can show a reply beneath the item
// it answers (a-change-says-where-it-stands).

/** A person, by git author, or an agent, by its id and, where known, the
 * status instance of the run. */
export type MessageParty = { person: string } | { agent: string; instance?: string };

/** How a reply left the item it answers. */
export type MessageOutcome = "closed" | "left-open" | "refused" | "failed";

export interface AuditMessage {
  id: string;
  kind: "request" | "reply";
  /** On a reply, the request it answers. */
  inReplyTo?: string;
  from: MessageParty;
  to: MessageParty;
  at: string;
  body: string;
  /** On a reply. */
  outcome?: MessageOutcome;
}

/** The latest reply to an item, as the inbox shows it beneath the item. */
export interface ItemReply {
  at: string;
  body: string;
  outcome: MessageOutcome;
}

/** A reply's outcome in the words every surface uses. */
export function describeMessageOutcome(outcome: MessageOutcome): string {
  switch (outcome) {
    case "closed":
      return "closed the item";
    case "left-open":
      return "left the item open";
    case "refused":
      return "was refused: it ticked the item with nothing written";
    case "failed":
      return "failed";
  }
}
