// The order a column's cards stand in (the-board-sorts-its-cards).
//
// A column of the picture says where a change is - its step, or its stage.
// Within a column the order was the change's name compared as a string,
// which put "change-10" before "change-2" and gave a person who numbers
// their changes a column out of order. The order is now chosen: by name,
// compared as a person reads numbers; by how far each change has got; or
// by when each was last worked on. Browser-safe: no Node import.

import type { ChangeCard } from "./change-card.js";
import type { SurveyedChange } from "./worktree-survey-facts.js";

/** The orders a column can be sorted in. */
export const CHANGE_ORDERS = ["name", "progress", "recent"] as const;
export type ChangeOrder = (typeof CHANGE_ORDERS)[number];

/** What a card knows that an order can compare. Each is optional: a card
 * that lacks a fact goes after every card that has it, in name order. */
export interface ChangeOrderFacts {
  /** Tasks done, and in all. A change with no task list has neither. */
  done?: number;
  total?: number;
  /** When the change was last worked on, as an ISO timestamp or date:
   * the later of its task list's last change and its last run's end, or
   * the day it was archived. Compared as text, which orders ISO forms. */
  lastActivity?: string;
}

/** What each order is called where a person picks it. */
export function describeChangeOrder(order: ChangeOrder): string {
  switch (order) {
    case "name":
      return "Name";
    case "progress":
      return "Progress";
    case "recent":
      return "Recently changed";
  }
}

const NAMES = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

/** Two change names in the order a person reads them: digits as numbers,
 * so "change-2" comes before "change-10", and case aside. Names equal
 * that way fall back to the plain comparison, so the order is total. */
export function compareChangeNames(left: string, right: string): number {
  return NAMES.compare(left, right) || (left < right ? -1 : left > right ? 1 : 0);
}

/** How far a change has got, from 0 to 1; undefined without a task list. */
function share(facts: ChangeOrderFacts | undefined): number | undefined {
  if (facts?.total === undefined || facts.done === undefined || facts.total <= 0) return undefined;
  return facts.done / facts.total;
}

/** Orders two present values with the larger first; a missing one after. */
function largerFirst<T extends number | string>(left: T | undefined, right: T | undefined): number {
  if (left === undefined && right === undefined) return 0;
  if (left === undefined) return 1;
  if (right === undefined) return -1;
  return left > right ? -1 : left < right ? 1 : 0;
}

/** The comparison `order` makes between two changes. Progress puts the
 * change furthest along first, since the one nearly done is the one
 * worth finishing; recent puts the one worked on last first. Ties, and
 * every name order, fall back to the name. */
export function compareChanges(
  order: ChangeOrder,
  facts: ReadonlyMap<string, ChangeOrderFacts>,
): (left: string, right: string) => number {
  return (left, right) => {
    const byFact = order === "progress"
      ? largerFirst(share(facts.get(left)), share(facts.get(right)))
      : order === "recent"
        ? largerFirst(facts.get(left)?.lastActivity, facts.get(right)?.lastActivity)
        : 0;
    return byFact || compareChangeNames(left, right);
  };
}

/** Each change's place in `order`, from 0, for a layout to stack a column
 * by. */
export function rankChanges(
  names: readonly string[],
  order: ChangeOrder,
  facts: ReadonlyMap<string, ChangeOrderFacts>,
): Map<string, number> {
  return new Map([...names].sort(compareChanges(order, facts)).map((name, index) => [name, index]));
}

/** The later of two ISO moments, either of which may be absent. */
export function laterOf(left: string | undefined, right: string | undefined): string | undefined {
  if (left === undefined) return right;
  if (right === undefined) return left;
  return left > right ? left : right;
}

/** What an order compares, from whatever a card is drawn from: this
 * checkout's card, the survey's reading of the change's directory, or the
 * archive. A change worked on by hand has no run, so its task list's last
 * change counts as much as a run's end does. */
export function orderFactsOf(from: {
  card?: Pick<ChangeCard, "progress" | "lastRun">;
  surveyed?: Pick<SurveyedChange, "tasksDone" | "tasksTotal" | "tasksUnreadable" | "tasksModifiedAt">;
  archivedOn?: string;
}): ChangeOrderFacts {
  const { card, surveyed, archivedOn } = from;
  const facts: ChangeOrderFacts = {};
  if (card?.progress !== undefined) {
    facts.done = card.progress.done;
    facts.total = card.progress.total;
  } else if (surveyed !== undefined && surveyed.tasksUnreadable === undefined) {
    facts.done = surveyed.tasksDone;
    facts.total = surveyed.tasksTotal;
  }
  const lastActivity = laterOf(laterOf(card?.lastRun?.endedAt, surveyed?.tasksModifiedAt), archivedOn);
  if (lastActivity !== undefined) facts.lastActivity = lastActivity;
  return facts;
}
