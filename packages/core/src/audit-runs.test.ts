import { describe, expect, it } from "vitest";
import { isRunEntry, VERIFY_CHECKS_AGENT_NAME } from "./audit-runs.js";
import type { AuditEntry } from "./security.js";

// quality-is-charged-to-the-agent-whose-work-was-checked:
// pure over one entry — no log, no files.

function entry(agent: string): AuditEntry {
  return {
    runId: "r1",
    agent,
    outcome: "completed",
    cwd: "/workspace",
    timestamp: "2026-09-10T09:00:00.000Z",
  };
}

describe("isRunEntry", () => {
  it("says a checks entry is not a run", () => {
    // It has a terminal outcome and no `started` partner, which every
    // counter that pairs entries read as a run refused before it
    // started.
    expect(isRunEntry(entry(VERIFY_CHECKS_AGENT_NAME))).toBe(false);
  });

  it("says an agent's entry is a run", () => {
    expect(isRunEntry(entry("claude-cli"))).toBe(true);
  });

  it("leaves the git stage's mechanical entries as runs", () => {
    // Deliberate, not an oversight: each git action is written as a
    // `started` and a terminal pair, so it was already counted as the
    // discrete action it is rather than inflating a total by accident.
    expect(isRunEntry(entry("git-stage"))).toBe(true);
  });
});
