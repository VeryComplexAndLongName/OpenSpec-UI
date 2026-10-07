import { describe, expect, it } from "vitest";
import { changeNameOf, isRunEntry, isWorkEntry, runTimestampsByChange, VERIFY_CHECKS_AGENT_NAME, workTimestampsByChange } from "./audit-runs.js";
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

describe("runTimestampsByChange", () => {
  // a-date-is-one-day-in-every-source: the map the hosts hand to
  // `getChangeTimelines` so a run recorded before the first tick is
  // evidence of when work started.

  function ran(changeDir: string | undefined, timestamp: string): AuditEntry {
    return {
      runId: "r1",
      agent: "claude-cli",
      outcome: "completed",
      cwd: "/workspace",
      timestamp,
      ...(changeDir ? { changeDir } : {}),
    };
  }

  it("groups timestamps by the change directory's name", () => {
    const byChange = runTimestampsByChange([
      ran("/workspace/openspec/changes/one", "2026-09-01T09:00:00.000Z"),
      ran("/workspace/openspec/changes/one", "2026-09-02T09:00:00.000Z"),
      ran("/workspace/openspec/changes/two", "2026-09-03T09:00:00.000Z"),
    ]);

    expect(byChange.get("one")).toEqual(["2026-09-01T09:00:00.000Z", "2026-09-02T09:00:00.000Z"]);
    expect(byChange.get("two")).toEqual(["2026-09-03T09:00:00.000Z"]);
  });

  it("leaves out an entry with nothing to attribute it to", () => {
    expect(runTimestampsByChange([ran(undefined, "2026-09-01T09:00:00.000Z")]).size).toBe(0);
  });

  it("reads a Windows path the same as a POSIX one", () => {
    const byChange = runTimestampsByChange([
      ran("C:\\workspace\\openspec\\changes\\one", "2026-09-01T09:00:00.000Z"),
    ]);

    expect(byChange.get("one")).toEqual(["2026-09-01T09:00:00.000Z"]);
  });
});

describe("changeNameOf", () => {
  it("ignores a trailing separator", () => {
    expect(changeNameOf("/workspace/openspec/changes/one/")).toBe("one");
  });
});

// the-board-and-the-run-read-right: a planning or review run put a change
// In progress on the board, where it stayed.
describe("isWorkEntry", () => {
  const entry = (partial: Partial<AuditEntry>): AuditEntry => ({ runId: "r", agent: "claude-cli-acp", outcome: "started", cwd: "/w", timestamp: "2026-10-07T09:00:00.000Z", ...partial });

  it("counts implementing and verifying runs, the apply, verify and git stages, the checks and a task's run", () => {
    expect(isWorkEntry(entry({ command: "implement" }))).toBe(true);
    expect(isWorkEntry(entry({ command: "verify" }))).toBe(true);
    expect(isWorkEntry(entry({ stage: "apply" }))).toBe(true);
    expect(isWorkEntry(entry({ stage: "git", agent: "git-stage" }))).toBe(true);
    expect(isWorkEntry(entry({ agent: VERIFY_CHECKS_AGENT_NAME }))).toBe(true);
    expect(isWorkEntry(entry({ taskNumber: "2.1" }))).toBe(true);
  });

  it("does not count planning, review, or an entry that says neither its command nor its stage", () => {
    expect(isWorkEntry(entry({ command: "plan" }))).toBe(false);
    expect(isWorkEntry(entry({ command: "review" }))).toBe(false);
    expect(isWorkEntry(entry({ stage: "propose", command: "plan" }))).toBe(false);
    expect(isWorkEntry(entry({ stage: "review" }))).toBe(false);
    expect(isWorkEntry(entry({}))).toBe(false);
  });

  it("gives the board only the work's times", () => {
    const changeDir = "/w/openspec/changes/demo";
    const work = workTimestampsByChange([
      entry({ changeDir, command: "plan", timestamp: "2026-10-07T09:00:00.000Z" }),
      entry({ changeDir, command: "review", timestamp: "2026-10-07T09:10:00.000Z" }),
      entry({ changeDir, command: "implement", timestamp: "2026-10-07T09:20:00.000Z" }),
    ]);
    expect(work.get("demo")).toEqual(["2026-10-07T09:20:00.000Z"]);
  });
});
