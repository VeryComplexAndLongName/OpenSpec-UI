// A change's history: its events, the rules they are held to, and the
// words they are said in (ADR 0037, a-change-keeps-its-history).
//
// A leaf with no Node imports, so the browser can have it: reading the
// files and checking signatures live in `change-history.ts`.

/** The stages of a change, in order (ADR 0037 decision 5). Derived from
 * facts, never declared; listed here because a change is sent back to one
 * of them. */
export const CHANGE_STAGES = ["proposed", "planned", "in-progress", "in-review", "landed", "archived"] as const;
export type ChangeStage = (typeof CHANGE_STAGES)[number];

/** The stages a change can be sent back to: not the archive, which is
 * where it ends. */
export const SEND_BACK_STAGES = ["proposed", "planned", "in-progress", "in-review"] as const;
export type SendBackStage = (typeof SEND_BACK_STAGES)[number];

export const HISTORY_EVENT_TYPES = ["owner-set", "implementer-set", "sent-back"] as const;
export type HistoryEventType = (typeof HISTORY_EVENT_TYPES)[number];

/** Who acted: the person themselves, or an agent working for them. Either
 * way the person's key signed. */
export type HistoryActor = { kind: "person" } | { kind: "agent"; agent: string; runId?: string };

interface HistoryEventBase {
  version: 1;
  /** The change the event is about. A file moved to another change's
   * history does not become that change's. */
  change: string;
  /** When, as claimed by the signer: an ISO date-time. */
  at: string;
  /** The person whose key signed, by handle and key id. */
  by: { handle: string; keyId: string };
  actor: HistoryActor;
}

export interface ReopenedTask {
  /** The task's number as `tasks.md` writes it, such as `2.3`. */
  task: string;
  why: string;
}

export type HistoryEvent =
  | (HistoryEventBase & { type: "owner-set"; to: string })
  | (HistoryEventBase & { type: "implementer-set"; to: string | null })
  | (HistoryEventBase & { type: "sent-back"; toStage: SendBackStage; reason: string; reopened: ReopenedTask[] });

/** One file of a history, as read: whether its signature holds, and what
 * it says where it does. */
export interface HistoryEntry {
  /** The file's name inside the history directory. */
  file: string;
  signature: "verified" | "unverified" | "does-not-check-out";
  /** The signing key, where the signature holds. */
  keyId?: string;
  /** The handle of the person whose file lists the key, where verified. */
  handle?: string;
  event?: HistoryEvent;
  /** Why the file could not be read as an event, where it could not. */
  unreadable?: string;
}

export interface HistoryProblem {
  file: string;
  problem: string;
}

/** Who holds a change now. Absent means nobody. */
export interface ChangeRoles {
  owner?: string;
  implementer?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;

/** An event from a payload's parsed JSON, or why it is not one. */
export function parseHistoryEvent(value: unknown): { event: HistoryEvent } | { problem: string } {
  if (!isRecord(value)) return { problem: "it is not a JSON object" };
  if (value.version !== 1) return { problem: "it is not a version 1 event" };
  if (!isStringArray(HISTORY_EVENT_TYPES, value.type)) return { problem: "its type is not one this product knows" };
  if (typeof value.change !== "string" || value.change.length === 0) return { problem: "it names no change" };
  if (typeof value.at !== "string" || !DATE_TIME.test(value.at)) return { problem: "its time is not a date-time" };
  const by = value.by;
  if (!isRecord(by) || typeof by.handle !== "string" || typeof by.keyId !== "string") return { problem: "it does not say who signed it" };
  const actor = value.actor;
  let parsedActor: HistoryActor;
  if (isRecord(actor) && actor.kind === "person") {
    parsedActor = { kind: "person" };
  } else if (isRecord(actor) && actor.kind === "agent" && typeof actor.agent === "string" && actor.agent.length > 0) {
    parsedActor = { kind: "agent", agent: actor.agent, ...(typeof actor.runId === "string" ? { runId: actor.runId } : {}) };
  } else {
    return { problem: "it does not say whether a person or an agent acted" };
  }
  const base = { version: 1 as const, change: value.change, at: value.at, by: { handle: by.handle, keyId: by.keyId }, actor: parsedActor };

  if (value.type === "owner-set") {
    if (typeof value.to !== "string" || value.to.length === 0) return { problem: "it names no Owner" };
    return { event: { ...base, type: "owner-set", to: value.to } };
  }
  if (value.type === "implementer-set") {
    if (value.to !== null && (typeof value.to !== "string" || value.to.length === 0)) return { problem: "it names no Implementer, and does not say none" };
    return { event: { ...base, type: "implementer-set", to: value.to as string | null } };
  }
  if (!isStringArray(SEND_BACK_STAGES, value.toStage)) return { problem: "it does not name a stage a change can be sent back to" };
  if (typeof value.reason !== "string" || value.reason.trim().length === 0) return { problem: "it gives no reason" };
  if (!Array.isArray(value.reopened)) return { problem: "it does not list the tasks it reopened" };
  const reopened: ReopenedTask[] = [];
  for (const one of value.reopened) {
    if (!isRecord(one) || typeof one.task !== "string" || typeof one.why !== "string" || one.why.trim().length === 0) {
      return { problem: "a task it reopened has no number or no reason" };
    }
    reopened.push({ task: one.task, why: one.why });
  }
  return { event: { ...base, type: "sent-back", toStage: value.toStage, reason: value.reason, reopened } };
}

/** The entries in the order they happened: by their claimed time, and by
 * file name where two claim the same moment. */
export function orderHistory(entries: readonly HistoryEntry[]): HistoryEntry[] {
  return [...entries].sort((left, right) => {
    const a = left.event === undefined ? Number.NaN : Date.parse(left.event.at);
    const b = right.event === undefined ? Number.NaN : Date.parse(right.event.at);
    if (!Number.isNaN(a) && !Number.isNaN(b) && a !== b) return a - b;
    return left.file.localeCompare(right.file);
  });
}

/** Plays a change's history forward: who holds it now, and every entry
 * that breaks a rule, with why. An entry that breaks one changes nothing.
 *
 * The rules are of record, not policy (ADR 0037 decision 4): the first
 * Owner may be set by anyone on the team; after that only the Owner hands
 * the ownership on; the Owner sets the Implementer, and the Implementer may
 * set none, handing the work back; the Owner or the Implementer sends a
 * change back. Everyone named has to be on the team. */
export function playHistory(changeName: string, entries: readonly HistoryEntry[], team: ReadonlySet<string>): { roles: ChangeRoles; problems: HistoryProblem[] } {
  const roles: ChangeRoles = {};
  const problems: HistoryProblem[] = [];
  for (const entry of orderHistory(entries)) {
    const refuse = (problem: string) => problems.push({ file: entry.file, problem });
    if (entry.signature === "does-not-check-out") {
      refuse(`its signature does not check out${entry.unreadable ? `: ${entry.unreadable}` : ""}`);
      continue;
    }
    if (entry.signature === "unverified") {
      refuse(`it is signed by key ${entry.keyId ?? "?"}, which is in nobody's file in openspec/people`);
      continue;
    }
    const event = entry.event;
    if (event === undefined) {
      refuse(entry.unreadable ?? "it is not an event");
      continue;
    }
    if (event.change !== changeName) {
      refuse(`it is about ${event.change}, not ${changeName}`);
      continue;
    }
    if (event.by.keyId !== entry.keyId || event.by.handle !== entry.handle) {
      refuse("it says it was signed by someone other than whoever signed it");
      continue;
    }
    const who = event.by.handle;
    if (event.type === "owner-set") {
      if (!team.has(event.to)) refuse(`it names ${event.to} as the Owner, who is not on the team`);
      else if (roles.owner !== undefined && roles.owner !== who) refuse(`only the Owner, ${roles.owner}, hands the ownership on`);
      else roles.owner = event.to;
      continue;
    }
    if (event.type === "implementer-set") {
      const handingBack = event.to === null && roles.implementer !== undefined && roles.implementer === who;
      if (event.to !== null && !team.has(event.to)) refuse(`it names ${event.to} as the Implementer, who is not on the team`);
      else if (roles.owner === undefined && !handingBack) refuse("the change has no Owner yet, and the Owner sets the Implementer");
      else if (roles.owner !== who && !handingBack) refuse(`only the Owner, ${roles.owner}, sets the Implementer`);
      else if (event.to === null) delete roles.implementer;
      else roles.implementer = event.to;
      continue;
    }
    if (who !== roles.owner && who !== roles.implementer) {
      refuse("only the Owner or the Implementer sends a change back");
    }
  }
  return { roles, problems };
}

const STAGE_WORDS: Record<ChangeStage, string> = {
  proposed: "Proposed",
  planned: "Planned",
  "in-progress": "In progress",
  "in-review": "In review",
  landed: "Landed",
  archived: "Archived",
};

/** A stage, as every surface says it. */
export function describeStage(stage: ChangeStage): string {
  return STAGE_WORDS[stage];
}

/** How a stage is drawn beside its word: which picture stands for it, and
 * which of the palette's stage colours is its own.
 *
 * Named here rather than chosen by a surface, so the editor and the
 * standalone cannot come to disagree about what Planned looks like. The
 * colour is a token's name, never a colour: each palette gives that token
 * a value, and in the editor it is the editor's own theme that does
 * (ADR 0023 decision 4).
 *
 * Neither is ever alone. The word is always there, the picture agrees
 * with it, and the colour agrees with both: a distinction carried by
 * colour alone is one a reader of a high-contrast theme never gets
 * (the-board-wears-its-stages). */
export interface StageLook {
  /** What the picture means, in the vocabulary the surfaces already share
   * for icons. A meaning, never a glyph: which glyph draws a meaning is
   * the drawing surface's own business, and naming one here would put a
   * font's names in a module that has no font. */
  icon: "spec" | "task" | "run" | "review" | "ok" | "archive";
  /** The palette token, without its leading dashes. */
  token: `stage-${ChangeStage}`;
}

const STAGE_LOOKS: Record<ChangeStage, StageLook> = {
  // A proposal is a document; a plan is a list of tasks; work is a run;
  // review is being looked at; landed is done; archived is put away.
  proposed: { icon: "spec", token: "stage-proposed" },
  planned: { icon: "task", token: "stage-planned" },
  "in-progress": { icon: "run", token: "stage-in-progress" },
  "in-review": { icon: "review", token: "stage-in-review" },
  landed: { icon: "ok", token: "stage-landed" },
  archived: { icon: "archive", token: "stage-archived" },
};

/** How a stage is drawn, for a surface that draws one. */
export function stageLook(stage: ChangeStage): StageLook {
  return STAGE_LOOKS[stage];
}

/** One event, in the words every surface uses. The reason is quoted as
 * given: it is data, never instructions. */
export function describeHistoryEvent(event: HistoryEvent): string {
  const actor = event.actor.kind === "agent" ? `${event.by.handle}'s agent ${event.actor.agent}` : event.by.handle;
  if (event.type === "owner-set") return `${actor} made ${event.to} the Owner`;
  if (event.type === "implementer-set") {
    return event.to === null ? `${actor} left the change with no Implementer` : `${actor} made ${event.to} the Implementer`;
  }
  const tasks = event.reopened.length === 0 ? "" : `, reopening ${event.reopened.map((one) => one.task).join(", ")}`;
  return `${actor} sent it back to ${STAGE_WORDS[event.toStage]}${tasks}: ${event.reason}`;
}
