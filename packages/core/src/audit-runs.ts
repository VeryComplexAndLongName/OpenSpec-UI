// Which audit entries are runs — the one rule every counter reads.
//
// The audit log holds two kinds of entry. Most record an agent run: a
// `started` and, later, a terminal partner under the same `runId`. A few
// record mechanical work the runner performed itself, and one of those —
// what `verify`'s declared checks found — is a *fact about* a run rather
// than a run. It carries a single terminal entry and no `started`
// partner, so every counter that pairs entries into runs treated it as
// "a run refused before it started" and added one to the total. One
// chain run of apply and verify read as two previous runs.
//
// Stated once here rather than as a filter written out in each counter:
// two copies of "which entries are runs" drift into two answers about
// the same log, which is exactly how this went unnoticed.
//
// Pure and free of Node built-ins on purpose — the browser bundle reads
// the same rule.

import type { AuditEntry } from "./security.js";

/** The `agent` an audit entry carries when `HarnessChainRunner` recorded
 * what a `verify` stage's declared mechanical checks found, rather than
 * an agent's work.
 *
 * Named like `git-stage` for the same reason: an entry whose agent is
 * not an agent has to say so in the field a reader looks at first. Lives
 * here rather than beside its writer so the counters that must exclude
 * it, and the quality readback that must recognise it, all name the same
 * string. */
export const VERIFY_CHECKS_AGENT_NAME = "verify-checks";

/** Whether this entry records a run, as opposed to a fact about one.
 *
 * Only the checks pseudo-agent is excluded. The `git-stage` entries are
 * deliberately left in: they are mechanical too, but each is written as
 * a `started` and a terminal pair, so they were already counted as the
 * discrete actions they are rather than inflating a total by accident. */
export function isRunEntry(entry: Pick<AuditEntry, "agent">): boolean {
  return entry.agent !== VERIFY_CHECKS_AGENT_NAME;
}

/** The directory name at the end of a recorded `changeDir`, in either
 * separator — the name the change had when the run was recorded.
 *
 * Exported for the same reason `isRunEntry` is: more than one analysis
 * needs it, and two copies of "which change is this entry about" drift
 * into two answers about one log. */
export function changeNameOf(changeDir: string): string {
  const normalized = changeDir.replaceAll("\\", "/").replace(/\/+$/u, "");
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}

/** When a run happened, per change, for a host that has just read the
 * audit log and is about to ask for timelines.
 *
 * A run is evidence that work happened, and it is the only evidence for
 * work done before anyone ticked a box. Grouped here rather than in
 * each host: the server route and the extension command need the same
 * map, and two copies of "which entry belongs to which change" is the
 * drift this module exists to prevent.
 *
 * Every entry with a `changeDir` counts, including the mechanical ones
 * — `isRunEntry` excludes what would inflate a *count* of runs, and
 * this is not a count: a verify check ran against the change on the day
 * it says, and that day is evidence of work as much as any other.
 *
 * See a-date-is-one-day-in-every-source. */
export function runTimestampsByChange(
  entries: readonly AuditEntry[],
): Map<string, string[]> {
  const byChange = new Map<string, string[]>();
  for (const entry of entries) {
    if (entry.changeDir === undefined || !entry.timestamp) continue;
    const name = changeNameOf(entry.changeDir);
    if (name.length === 0) continue;
    const existing = byChange.get(name);
    if (existing) existing.push(entry.timestamp);
    else byChange.set(name, [entry.timestamp]);
  }
  return byChange;
}
