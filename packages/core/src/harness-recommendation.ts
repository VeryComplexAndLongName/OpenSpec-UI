// Which named configuration suits a change, and on what grounds.
//
// This deliberately recommends a template and never a figure. Measured
// 2026-09-08 across this repository's own audit log: of 22 changes
// carrying any record, 13 have exactly one run and 16 have no run that
// reported a cost. A per-change cost drawn from that is arithmetic
// wearing the costume of evidence — and it would be believed, because it
// looks computed.
//
// The grounds travel with the answer rather than being available on
// request. A recommendation whose reasons are hidden can only be accepted
// or ignored, never disagreed with, and the cases where a reader would
// disagree are exactly the ones where it is worst.

import type { ChangeCostReport } from "./change-cost-report.js";
import { HARNESS_TEMPLATES, type HarnessTemplate } from "./harness-templates.js";

/** Roomier to thriftier. Moving "one up" means moving towards the front
 * of this list. */
const BY_ROOM: readonly string[] = ["overnight", "careful", "thrifty"];

/** Above this many open tasks a change is treated as long work. Chosen,
 * not measured: the audit log records what runs cost, never how many
 * tasks the change had at the time, so no distribution exists to draw
 * this from. Said plainly rather than implied. */
const MANY_OPEN_TASKS = 12;

export interface HarnessRecommendation {
  /** The template recommended, or `undefined` where the answer is that a
   * person should look rather than that a configuration should change. */
  template?: HarnessTemplate;
  /** Every observation this was drawn from, including "nothing is known".
   * Never empty: an empty list is what silently presenting a default
   * would look like. */
  grounds: string[];
  /** Set when the recommendation is that a person takes over. */
  needsPerson?: true;
}

function templateById(id: string): HarnessTemplate | undefined {
  return HARNESS_TEMPLATES.find((template) => template.id === id);
}

function oneStepRoomier(id: string): string {
  const index = BY_ROOM.indexOf(id);
  return index <= 0 ? BY_ROOM[0] as string : BY_ROOM[index - 1] as string;
}

export interface RecommendationInput {
  /** Tasks still unchecked in the change. */
  openTaskCount: number;
  /** What has been recorded against this change, or `undefined` where
   * nothing has run. */
  history?: ChangeCostReport;
}

/** Recommends one named configuration for a change.
 *
 * Reads only what exists for every change: how much is left to do, and
 * how previous runs ended. Not the diff, which does not exist before
 * `apply`; not the delta count, which says little about cost. */
export function recommendTemplate(input: RecommendationInput): HarnessRecommendation {
  const grounds: string[] = [];
  const rows = input.history?.rows ?? [];

  grounds.push(input.openTaskCount === 1
    ? "1 task still open"
    : `${input.openTaskCount} tasks still open`);

  if (rows.length === 0) {
    // Said in the same breath as the answer, so "nothing is known about
    // this change" cannot be mistaken for "this is what the evidence
    // suggests".
    grounds.push("no previous run to go on");
    const id = input.openTaskCount > MANY_OPEN_TASKS ? "careful" : "thrifty";
    grounds.push(input.openTaskCount > MANY_OPEN_TASKS
      ? `more than ${MANY_OPEN_TASKS} open tasks reads as long work`
      : `at most ${MANY_OPEN_TASKS} open tasks reads as short work`);
    return { template: templateById(id), grounds };
  }

  const cutRows = rows.filter((row) => row.outcome === "cancelled" && row.reason !== undefined);
  grounds.push(rows.length === 1 ? "1 previous run" : `${rows.length} previous runs`);

  if (cutRows.length === 0) {
    grounds.push("no previous run was stopped by a ceiling");
    const id = input.openTaskCount > MANY_OPEN_TASKS ? "careful" : "thrifty";
    return { template: templateById(id), grounds };
  }

  const last = cutRows[cutRows.length - 1];
  grounds.push(`the last run was stopped: ${last?.reason ?? "a ceiling was reached"}`);

  if (cutRows.length > 1) {
    // Twice cut at the roomiest configuration is not an argument for a
    // bigger ceiling. It is an argument for a person.
    grounds.push(`stopped by a ceiling ${cutRows.length} times`);
    grounds.push("a larger ceiling has already been tried; this needs a person rather than more room");
    return { grounds, needsPerson: true };
  }

  const previous = input.openTaskCount > MANY_OPEN_TASKS ? "careful" : "thrifty";
  const id = oneStepRoomier(previous);
  grounds.push(`recommending one step roomier than "${previous}"`);
  return { template: templateById(id), grounds };
}
