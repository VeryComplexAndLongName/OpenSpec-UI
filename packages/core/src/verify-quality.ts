// How often a verifying stage found something wrong, per agent.
//
// `workspace-run-stats.ts` answers what runs cost. This answers whether
// what they produced held up — the two are different questions about the
// same entries, and an agent that is cheap and fails its checks is not
// the cheap one.
//
// The evidence is `checksRan` and `checksFailed`, written by the chain's
// verify stage since verify-records-what-it-found. Measured on this
// repository 2026-09-10: 0 of 108 audit entries carry them, because no
// chain has run a verify stage since that landed. So this ships saying
// "nothing recorded yet" and means it — the alternative is a view that
// appears the day the data does, which is a day later than the data is
// worth reading.
//
// Pure over entries, like its neighbours: the caller supplies both the
// entries and which changes still exist.

import type { AuditEntry } from "./security.js";
import type { KnownChanges } from "./workspace-run-stats.js";
import { belongsToKnownChange } from "./workspace-run-stats.js";

/** How many verifying stages a group needs before its rate is offered as
 * an answer rather than as an accumulation.
 *
 * Five, the same figure `ENOUGH_RUNS` uses and for the same reason: one
 * failure in one verify is not a rate, and a threshold nobody states is
 * a threshold nobody can disagree with. */
export const ENOUGH_VERIFIES = 5;

export interface AgentQuality {
  agent: string;
  /** Verifying stages that reported what their checks found. */
  verifies: number;
  /** Of those, how many had at least one failing check. */
  withFailures: number;
  /** Individual checks that ran, across those stages. A stage that runs
   * six checks and a stage that runs one are different evidence, and the
   * rate above hides that. */
  checksRan: number;
  checksFailed: number;
  /** `false` below `ENOUGH_VERIFIES`. Reported rather than omitted:
   * leaving a thin group out makes "too little is known" look like
   * "this agent never fails". */
  enough: boolean;
}

export interface VerifyQuality {
  /** Audit entries read, so a reader can tell an empty answer from an
   * unread log. */
  entriesRead: number;
  /** Entries carrying what a verify found. Zero here is the ordinary
   * state of a workspace whose chains have not run a verify stage yet,
   * and is different from having no entries at all. */
  entriesWithChecks: number;
  byAgent: AgentQuality[];
}

/** What the verifying stages recorded, per agent.
 *
 * Runs against a change that no longer exists are excluded, the same
 * rule the cost figures apply: a deleted change was an experiment, and
 * counting its failures against an agent would charge it for work
 * nobody kept. */
export function buildVerifyQuality(
  entries: readonly AuditEntry[],
  known: KnownChanges,
): VerifyQuality {
  const byAgent = new Map<string, {
    verifies: number;
    withFailures: number;
    checksRan: number;
    checksFailed: number;
  }>();
  let entriesWithChecks = 0;

  for (const entry of entries) {
    if (entry.checksRan === undefined) continue;
    if (!belongsToKnownChange(entry, known)) continue;
    entriesWithChecks += 1;

    const group = byAgent.get(entry.agent) ?? {
      verifies: 0,
      withFailures: 0,
      checksRan: 0,
      checksFailed: 0,
    };
    group.verifies += 1;
    group.checksRan += entry.checksRan;
    // A count, not a list: the audit entry records how many checks
    // failed, not which. Naming them would need the entry to carry names
    // it does not have, and a view that invents them is worse than one
    // that counts.
    const failed = entry.checksFailed ?? 0;
    group.checksFailed += failed;
    if (failed > 0) group.withFailures += 1;
    byAgent.set(entry.agent, group);
  }

  return {
    entriesRead: entries.length,
    entriesWithChecks,
    byAgent: [...byAgent.entries()]
      .map(([agent, group]) => ({
        agent,
        verifies: group.verifies,
        withFailures: group.withFailures,
        checksRan: group.checksRan,
        checksFailed: group.checksFailed,
        enough: group.verifies >= ENOUGH_VERIFIES,
      }))
      .sort((left, right) => right.verifies - left.verifies || left.agent.localeCompare(right.agent)),
  };
}

/** The sentence a surface shows above the figures.
 *
 * Says which of the two empty states this is: a log with nothing in it
 * and a log whose runs never reached a verifying stage are different
 * facts, and only one of them is fixed by running something. */
export function describeVerifyQuality(quality: VerifyQuality): string {
  if (quality.entriesRead === 0) return "Nothing recorded yet — no runs have been logged in this workspace.";
  if (quality.entriesWithChecks === 0) {
    return `Nothing to report yet — ${quality.entriesRead} runs recorded, none of which reached a verifying stage`
      + " that reported what its checks found.";
  }
  const thin = quality.byAgent.filter((group) => !group.enough).length;
  return `${quality.entriesWithChecks} verifying stage(s) across ${quality.byAgent.length} agent(s)`
    + (thin === 0 ? "." : `; ${thin} rest${thin === 1 ? "s" : ""} on fewer than ${ENOUGH_VERIFIES} and is reported as thin.`);
}
