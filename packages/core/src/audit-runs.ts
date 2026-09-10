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
