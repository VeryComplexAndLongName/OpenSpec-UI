import { describe, expect, it } from "vitest";
import type { AuditEntry } from "./security.js";
import { buildWorkspaceRunStats, ENOUGH_RUNS } from "./workspace-run-stats.js";

// what-runs-cost-here:
// pure over in-memory data — no files, no processes.

let clock = 0;
function at(): string {
  clock += 1;
  return new Date(Date.UTC(2026, 8, 9, 0, clock, 0)).toISOString();
}

function run(
  options: {
    change: string;
    agent?: string;
    effort?: AuditEntry["effort"];
    outcome?: "completed" | "failed" | "cancelled";
    costUsd?: number;
    seconds?: number;
    runId?: string;
    stage?: AuditEntry["stage"];
  },
): AuditEntry[] {
  const started = at();
  const ended = new Date(Date.parse(started) + (options.seconds ?? 60) * 1000).toISOString();
  const base = {
    agent: options.agent ?? "claude-cli-acp",
    changeDir: `/repo/openspec/changes/${options.change}`,
    cwd: "/repo",
    runId: options.runId ?? `run-${clock}`,
    ...(options.stage !== undefined ? { stage: options.stage } : {}),
    ...(options.effort !== undefined ? { effort: options.effort } : {}),
  } as Partial<AuditEntry>;
  return [
    { ...base, outcome: "started", timestamp: started } as AuditEntry,
    {
      ...base,
      outcome: options.outcome ?? "completed",
      timestamp: ended,
      ...(options.costUsd !== undefined ? { usage: { costUsd: options.costUsd } } : {}),
    } as AuditEntry,
  ];
}

const known = { active: ["live-change"], archived: ["done-change"] };

describe("buildWorkspaceRunStats", () => {
  it("excludes runs against a change that no longer exists", () => {
    // A finished change is in the archive and a live one is in changes/.
    // One in neither was deleted — an experiment, not part of the record.
    // Counting them makes this project's own testing look like its
    // behaviour: on 2026-09-09 three disposable smoke changes accounted
    // for 24 of 108 entries, and their stages were cut on purpose.
    const stats = buildWorkspaceRunStats(
      [...run({ change: "live-change" }), ...run({ change: "smoke-2026-09-08" })],
      known,
    );

    expect(stats.runs).toBe(1);
    expect(stats.entriesFromDeletedChanges).toBe(2);
    expect(stats.entriesRead).toBe(4);
  });

  it("counts an archived change", () => {
    const stats = buildWorkspaceRunStats(run({ change: "done-change" }), known);

    expect(stats.runs).toBe(1);
    expect(stats.entriesFromDeletedChanges).toBe(0);
  });

  it("reports a thin group as below the threshold rather than omitting it", () => {
    // Omitting it makes "too little is known here" indistinguishable from
    // "this has never run", which are different facts.
    const entries = Array.from({ length: ENOUGH_RUNS - 1 }, () => run({ change: "live-change" })).flat();

    const [group] = buildWorkspaceRunStats(entries, known).byAgent;
    expect(group?.runs).toBe(ENOUGH_RUNS - 1);
    expect(group?.enough).toBe(false);
  });

  it("marks a group as enough at the threshold", () => {
    const entries = Array.from({ length: ENOUGH_RUNS }, () => run({ change: "live-change" })).flat();

    expect(buildWorkspaceRunStats(entries, known).byAgent[0]?.enough).toBe(true);
  });

  it("separates having runs from having costs", () => {
    // An agent that reports nothing has runs and no costs. The gap
    // between the two counts is what says so — a median of zero would
    // say something false.
    const entries = [
      ...run({ change: "live-change", agent: "copilot-cli-acp" }),
      ...run({ change: "live-change", agent: "copilot-cli-acp" }),
    ];

    const [group] = buildWorkspaceRunStats(entries, known).byAgent;
    expect(group?.runs).toBe(2);
    expect(group?.costSamples).toBe(0);
    expect(group?.medianCostUsd).toBeUndefined();
  });

  it("reports cost and duration over the samples that have them", () => {
    const entries = [
      ...run({ change: "live-change", costUsd: 1, seconds: 60 }),
      ...run({ change: "live-change", costUsd: 3, seconds: 180 }),
      ...run({ change: "live-change", costUsd: 2, seconds: 120 }),
    ];

    const [group] = buildWorkspaceRunStats(entries, known).byAgent;
    expect(group?.medianCostUsd).toBe(2);
    expect(group?.medianSeconds).toBe(120);
    // Nearest-rank, so p90 is an observation rather than a number
    // interpolated between two of them.
    expect(group?.p90CostUsd).toBe(3);
  });

  it("groups by effort only where the run recorded one", () => {
    // Effort was known for one run in forty when this was written: the
    // field landed two days earlier.
    const entries = [
      ...run({ change: "live-change", effort: "high" }),
      ...run({ change: "live-change" }),
    ];

    const stats = buildWorkspaceRunStats(entries, known);
    expect(stats.runs).toBe(2);
    expect(stats.runsWithEffort).toBe(1);
    expect(stats.byAgent[0]?.runs).toBe(2);
    expect(stats.byAgentAndEffort).toHaveLength(1);
    expect(stats.byAgentAndEffort[0]?.effort).toBe("high");
  });

  it("counts completions apart from runs", () => {
    const entries = [
      ...run({ change: "live-change", outcome: "completed" }),
      ...run({ change: "live-change", outcome: "cancelled" }),
    ];

    const [group] = buildWorkspaceRunStats(entries, known).byAgent;
    expect(group?.runs).toBe(2);
    expect(group?.completed).toBe(1);
  });

  it("pairs a stage that ran twice under one runId", () => {
    // A chain that returned from verify to apply has two `started` and
    // two terminal entries sharing a runId and a stage. Matching on the
    // key alone would take the wrong end time.
    const first = run({ change: "live-change", runId: "r1", stage: "apply", seconds: 60 });
    const second = run({ change: "live-change", runId: "r1", stage: "apply", seconds: 600 });

    const [group] = buildWorkspaceRunStats([...first, ...second], known).byAgent;
    expect(group?.runs).toBe(2);
    // Both durations are in the data, which is what says each `started`
    // found its own terminal entry rather than both taking the first.
    // Asserted on p90 rather than the median: with two samples the
    // nearest-rank median is the lower one, so it would pass even if the
    // longer run had been paired to the wrong end time.
    expect(group?.p90Seconds).toBe(600);
    expect(group?.medianSeconds).toBe(60);
  });
});
