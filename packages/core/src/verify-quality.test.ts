import { describe, expect, it } from "vitest";
import { buildVerifyQuality, describeVerifyQuality, ENOUGH_VERIFIES } from "./verify-quality.js";
import type { AuditEntry } from "./security.js";

// quality-of-what-a-verify-found:
// pure over in-memory entries — no log, no files.

const known = { active: ["kept"], archived: ["2026-09-01-old"] };

function entry(overrides: Partial<AuditEntry>): AuditEntry {
  return {
    runId: "r1",
    agent: "claude-cli",
    outcome: "completed",
    cwd: "/workspace",
    timestamp: "2026-09-10T09:00:00.000Z",
    changeDir: "/workspace/openspec/changes/kept",
    ...overrides,
  } as AuditEntry;
}

describe("buildVerifyQuality", () => {
  it("counts the stages that reported, and the ones that found something", () => {
    const quality = buildVerifyQuality([
      entry({ checksRan: 3, checksFailed: 0 }),
      entry({ checksRan: 3, checksFailed: 1 }),
      entry({ checksRan: 2, checksFailed: 2 }),
    ], known);

    expect(quality.byAgent).toEqual([{
      agent: "claude-cli",
      verifies: 3,
      withFailures: 2,
      checksRan: 8,
      checksFailed: 3,
      enough: false,
    }]);
  });

  it("says a group is thin rather than leaving it out", () => {
    // Omitting it would make "too little is known" look like "this
    // agent never fails".
    const thin = buildVerifyQuality([entry({ checksRan: 1, checksFailed: 1 })], known);
    expect(thin.byAgent[0]?.enough).toBe(false);

    const enough = buildVerifyQuality(
      Array.from({ length: ENOUGH_VERIFIES }, () => entry({ checksRan: 1, checksFailed: 0 })),
      known,
    );
    expect(enough.byAgent[0]?.enough).toBe(true);
  });

  it("ignores an entry that never reached a verifying stage", () => {
    // Most entries are like this: a `started`, or a stage that is not
    // verify. Counting them as clean verifies would invent quality out
    // of runs that never checked anything.
    const quality = buildVerifyQuality([entry({}), entry({ outcome: "started" })], known);

    expect(quality.entriesRead).toBe(2);
    expect(quality.entriesWithChecks).toBe(0);
    expect(quality.byAgent).toEqual([]);
  });

  it("excludes a run against a change that no longer exists", () => {
    // The same rule the cost figures apply: a deleted change was an
    // experiment, and charging an agent for it counts this project's own
    // testing as its behaviour.
    const quality = buildVerifyQuality([
      entry({ checksRan: 2, checksFailed: 2, changeDir: "/workspace/openspec/changes/deleted-smoke" }),
    ], known);

    expect(quality.entriesWithChecks).toBe(0);
  });

  it("separates agents, busiest first", () => {
    const quality = buildVerifyQuality([
      entry({ agent: "codex-cli", checksRan: 1, checksFailed: 0 }),
      entry({ agent: "claude-cli", checksRan: 1, checksFailed: 0 }),
      entry({ agent: "claude-cli", checksRan: 1, checksFailed: 1 }),
    ], known);

    expect(quality.byAgent.map((group) => group.agent)).toEqual(["claude-cli", "codex-cli"]);
  });
});

describe("describeVerifyQuality", () => {
  it("tells an empty log apart from a log whose runs never verified", () => {
    // Two different facts, and only one of them is fixed by running
    // something.
    expect(describeVerifyQuality(buildVerifyQuality([], known)))
      .toContain("no runs have been logged");

    const noChecks = describeVerifyQuality(buildVerifyQuality([entry({}), entry({})], known));
    expect(noChecks).toContain("2 runs recorded");
    expect(noChecks).toContain("none of which reached a verifying stage");
  });

  it("says how many groups are too thin to read as a rate", () => {
    const text = describeVerifyQuality(buildVerifyQuality([entry({ checksRan: 1, checksFailed: 0 })], known));

    expect(text).toContain(`fewer than ${ENOUGH_VERIFIES}`);
  });
});
