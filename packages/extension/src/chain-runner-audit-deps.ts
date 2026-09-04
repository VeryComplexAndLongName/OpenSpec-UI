// The audit half of `HarnessChainRunner`'s dependencies, decided in one
// place so it can be asserted.
//
// `HarnessChainRunner` takes two independent audit dependencies:
// `auditLog`, which it writes the chain's own entries to, and
// `listAuditEntries`, which `checkBudget` reads to decide whether a
// configured ceiling has been reached. Supplying only the first is the
// mistake worth guarding against — the chain would record its spend and
// then read nothing back, so a ceiling would never fire and nothing
// would look wrong.
//
// This lives outside `extension.ts` because that module imports
// `vscode` at the top level and its `activate()` cannot run outside a
// real Extension Host. The wiring decision does not need one, and
// keeping it here is what makes it testable at all — see
// audit-log-persistence task 4.2, which recorded that no non-live way to
// exercise `activate()` existed and left the assertion outstanding.

import type { AuditEntry, AuditLog } from "@openspec-ui/core";

/** An audit log that can also be read back. `FileAuditLog` is one; the
 * in-memory log used in tests is another. */
export interface ReadableAuditLog extends AuditLog {
  readEntries(): Promise<AuditEntry[]>;
}

export interface ChainRunnerAuditDeps {
  auditLog?: AuditLog;
  listAuditEntries?: () => AuditEntry[] | Promise<AuditEntry[]>;
}

/**
 * Both dependencies, or neither.
 *
 * There is no workspace-independent audit log — without an open folder
 * there is nowhere to write one — so `undefined` is a real case and
 * yields an empty object rather than a reader over nothing. A reader
 * that resolved to an empty list would look to `checkBudget` like a
 * change that had spent nothing, which is the reading `AuditEntry.usage`
 * and `checkBudget` are both written to avoid.
 */
export function buildChainRunnerAuditDeps(auditLog: ReadableAuditLog | undefined): ChainRunnerAuditDeps {
  if (!auditLog) return {};
  return { auditLog, listAuditEntries: () => auditLog.readEntries() };
}
