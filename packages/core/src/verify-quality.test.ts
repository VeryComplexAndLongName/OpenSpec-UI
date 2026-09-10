import { describe, expect, it } from "vitest";
import { buildVerifyQuality, describeVerifyQuality, ENOUGH_VERIFIES } from "./verify-quality.js";
import { VERIFY_CHECKS_AGENT_NAME } from "./audit-runs.js";
import type { AuditEntry } from "./security.js";

// quality-of-what-a-verify-found:
// pure over in-memory entries — no log, no files.
//
// quality-is-charged-to-the-agent-whose-work-was-checked: the fixtures
// below are the shape the runner actually writes — `agent` is the
// pseudo-agent that recorded the entry, and `checkedAgent` names whose
// work was checked. The earlier fixtures set `agent: "claude-cli"`
// alongside `checksRan`, which `recordVerifyChecks` has never produced,
// so every assertion here passed against data that does not exist.

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

/** A checks entry exactly as `HarnessChainRunner.recordVerifyChecks`
 * writes one: the writer in `agent`, the agent whose work was examined
 * in `checkedAgent`. */
function checksEntry(overrides: Partial<AuditEntry> & { checksRan: number }): AuditEntry {
  return entry({
    agent: VERIFY_CHECKS_AGENT_NAME,
    stage: "verify",
    checkedAgent: "claude-cli",
    ...overrides,
  });
}

describe("buildVerifyQuality", () => {
  it("counts the stages that reported, and the ones that found something", () => {
    const quality = buildVerifyQuality([
      checksEntry({ checksRan: 3, checksFailed: 0 }),
      checksEntry({ checksRan: 3, checksFailed: 1 }),
      checksEntry({ checksRan: 2, checksFailed: 2 }),
    ], known);

    // The group names the agent whose work was checked. Grouping by
    // `agent` named the pseudo-agent that wrote the entries, so the
    // breakdown had exactly one row however many agents had run.
    expect(quality.byAgent).toEqual([{
      agent: "claude-cli",
      verifies: 3,
      withFailures: 2,
      checksRan: 8,
      checksFailed: 3,
      enough: false,
    }]);
    expect(quality.entriesBeforeAgentNamed).toBe(0);
  });

  it("counts an entry naming no checked agent rather than charging one", () => {
    // Every checks entry written before `checkedAgent` existed. Charging
    // it to the pseudo-agent in `agent` is the row this change removed,
    // and charging it to a guess would be worse.
    const quality = buildVerifyQuality([
      checksEntry({ checksRan: 2, checksFailed: 1 }),
      entry({ agent: VERIFY_CHECKS_AGENT_NAME, stage: "verify", checksRan: 4, checksFailed: 4 }),
    ], known);

    expect(quality.entriesWithChecks).toBe(2);
    expect(quality.entriesBeforeAgentNamed).toBe(1);
    expect(quality.byAgent).toEqual([{
      agent: "claude-cli",
      verifies: 1,
      withFailures: 1,
      checksRan: 2,
      checksFailed: 1,
      enough: false,
    }]);
    expect(quality.byAgent.map((group) => group.agent)).not.toContain(VERIFY_CHECKS_AGENT_NAME);
  });

  it("says a group is thin rather than leaving it out", () => {
    // Omitting it would make "too little is known" look like "this
    // agent never fails".
    const thin = buildVerifyQuality([checksEntry({ checksRan: 1, checksFailed: 1 })], known);
    expect(thin.byAgent[0]?.enough).toBe(false);

    const enough = buildVerifyQuality(
      Array.from({ length: ENOUGH_VERIFIES }, () => checksEntry({ checksRan: 1, checksFailed: 0 })),
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
      checksEntry({ checksRan: 2, checksFailed: 2, changeDir: "/workspace/openspec/changes/deleted-smoke" }),
    ], known);

    expect(quality.entriesWithChecks).toBe(0);
  });

  it("separates checked agents, busiest first", () => {
    const quality = buildVerifyQuality([
      checksEntry({ checkedAgent: "codex-cli", checksRan: 1, checksFailed: 0 }),
      checksEntry({ checkedAgent: "claude-cli", checksRan: 1, checksFailed: 0 }),
      checksEntry({ checkedAgent: "claude-cli", checksRan: 1, checksFailed: 1 }),
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
    const text = describeVerifyQuality(buildVerifyQuality([checksEntry({ checksRan: 1, checksFailed: 0 })], known));

    expect(text).toContain(`fewer than ${ENOUGH_VERIFIES}`);
  });

  it("says when stages were recorded before the checked agent was named", () => {
    const mixed = describeVerifyQuality(buildVerifyQuality([
      checksEntry({ checksRan: 1, checksFailed: 0 }),
      entry({ agent: VERIFY_CHECKS_AGENT_NAME, stage: "verify", checksRan: 1, checksFailed: 0 }),
    ], known));
    expect(mixed).toContain("1 of them named no checked agent");
    expect(mixed).toContain("charged to no agent");

    // All of them unattributed is its own state: there is nothing to
    // show per agent, and "nothing recorded" would be false.
    const allLegacy = describeVerifyQuality(buildVerifyQuality([
      entry({ agent: VERIFY_CHECKS_AGENT_NAME, stage: "verify", checksRan: 1, checksFailed: 0 }),
    ], known));
    expect(allLegacy).toContain("none of which names the agent whose work was checked");
  });
});
