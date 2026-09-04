import { describe, expect, it, vi } from "vitest";
import type { AuditEntry } from "@openspec-ui/core";
import { buildChainRunnerAuditDeps, type ReadableAuditLog } from "./chain-runner-audit-deps.js";

function fakeAuditLog(entries: AuditEntry[] = []): ReadableAuditLog & { readCalls: number } {
  const log = {
    readCalls: 0,
    record: vi.fn(),
    async readEntries() {
      log.readCalls += 1;
      return entries;
    },
  };
  return log as unknown as ReadableAuditLog & { readCalls: number };
}

const entry: AuditEntry = {
  runId: "run-1",
  agent: "copilot-cli-acp",
  outcome: "completed",
  cwd: "/workspace/repo",
  timestamp: "2026-09-04T14:03:49.530Z",
  changeDir: "/workspace/repo/openspec/changes/demo",
  usage: { inputTokens: 786966, outputTokens: 4732 },
};

describe("buildChainRunnerAuditDeps (audit-log-persistence task 4.2)", () => {
  it("supplies BOTH the log and the reader, since one without the other is the defect", async () => {
    // `HarnessChainRunner` writes the chain's entries through `auditLog`
    // and reads them back through `listAuditEntries`. With only the
    // first, the chain records its spend and `checkBudget` reads
    // nothing, so a configured ceiling never fires and nothing looks
    // wrong. This asserts the pairing, not either half.
    const log = fakeAuditLog([entry]);
    const deps = buildChainRunnerAuditDeps(log);

    expect(deps.auditLog).toBe(log);
    expect(deps.listAuditEntries).toBeTypeOf("function");
    await expect(deps.listAuditEntries?.()).resolves.toEqual([entry]);
  });

  it("reads through the same log it writes to, not a second one", async () => {
    const log = fakeAuditLog([entry]);
    const deps = buildChainRunnerAuditDeps(log);

    await deps.listAuditEntries?.();

    // A reader over a different instance would see a different file and
    // silently compare a ceiling against the wrong history.
    expect(log.readCalls).toBe(1);
    expect(deps.auditLog).toBe(log);
  });

  it("supplies NEITHER when there is no audit log", () => {
    // Asserted explicitly. A reader resolving to an empty list would
    // look to `checkBudget` like a change that had spent nothing, which
    // is the reading `AuditEntry.usage` and `checkBudget` are both
    // written to avoid — absent means unreported, not free.
    const deps = buildChainRunnerAuditDeps(undefined);

    expect(deps.auditLog).toBeUndefined();
    expect(deps.listAuditEntries).toBeUndefined();
    expect(Object.keys(deps)).toEqual([]);
  });

  it("defers the read rather than performing one when the deps are built", () => {
    // Activation must not read the audit file; only a budget check
    // should. A reader built eagerly would put a file read on the
    // extension's startup path.
    const log = fakeAuditLog([entry]);
    buildChainRunnerAuditDeps(log);

    expect(log.readCalls).toBe(0);
  });
});
