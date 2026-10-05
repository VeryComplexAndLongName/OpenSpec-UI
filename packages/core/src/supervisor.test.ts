import { describe, expect, it } from "vitest";
import type { AgentStatusReport } from "./agent-status.js";
import { DEFAULT_SUPERVISOR, type ResolvedSupervisor } from "./harness-config.js";
import type { LastRun } from "./last-runs-facts.js";
import { describeSpan, superviseFailure, superviseRuns, type FailureFactsForDecision, type SuperviseInputs } from "./supervisor.js";

// the-supervisor-advises 3.2: pure over records, so every case is a record.

const MINUTE = 60_000;

function report(partial: Partial<AgentStatusReport> = {}): AgentStatusReport {
  return {
    instanceId: "i1",
    activity: "running npm test",
    stage: "apply",
    changeName: "demo",
    workingDirectory: "/work/demo",
    activitySinceMs: 30_000,
    heartbeatAgeMs: 3_000,
    activityAt: "2026-10-04T10:00:00.000Z",
    heartbeatAt: "2026-10-04T10:12:00.000Z",
    gone: false,
    runId: "r1",
    task: null,
    waiting: null,
    stopRequested: null,
    signature: "unverified",
    machine: "box",
    gitAuthor: null,
    ...partial,
  };
}

function failed(partial: Partial<LastRun> = {}): LastRun {
  return {
    runId: "c1",
    outcome: "failed",
    stage: "apply",
    endedAt: "2026-10-04T09:00:00.000Z",
    reason: "Authentication required",
    diagnosis: {
      cause: "not-signed-in",
      repeatHelps: "no",
      evidence: "Authentication required",
      remedy: "Run `copilot` in a terminal and sign in, then start the run again.",
      commands: ["copilot"],
    },
    ...partial,
  };
}

function inputs(partial: Partial<SuperviseInputs> & { supervisor?: Partial<ResolvedSupervisor> } = {}): SuperviseInputs {
  const supervisor = { ...DEFAULT_SUPERVISOR, ...partial.supervisor };
  return {
    statuses: partial.statuses ?? [],
    lastRuns: partial.lastRuns ?? { byChange: {} },
    supervisorFor: partial.supervisorFor ?? (() => supervisor),
  };
}

describe("superviseRuns — a run that says nothing new", () => {
  it("is pointed out past the threshold, with what it last said and the commands", () => {
    const hints = superviseRuns(inputs({ statuses: [report({ activitySinceMs: 12 * MINUTE })] }));
    expect(hints).toEqual([{
      id: "run-says-nothing-new:i1",
      kind: "run-says-nothing-new",
      subject: "A run on demo has said nothing new for 12 minutes",
      because: expect.stringContaining('it last said "running npm test" 12 minutes ago'),
      commands: [
        "openspec-ui-cli status --cwd /work/demo",
        'openspec-ui-cli stop i1 --reason "said nothing new for 12 minutes" --cwd /work/demo',
      ],
    }]);
    expect(hints[0]?.because).toContain("supervisor.silentAfterSeconds (600s)");
    expect(hints[0]?.because).not.toMatch(/\b(hung|stuck)\b/);
  });

  it("is not pointed out under the threshold", () => {
    expect(superviseRuns(inputs({ statuses: [report({ activitySinceMs: 9 * MINUTE })] }))).toEqual([]);
  });

  it("follows the configured threshold", () => {
    const hints = superviseRuns(inputs({ statuses: [report({ activitySinceMs: 3 * MINUTE })], supervisor: { silentAfterSeconds: 120 } }));
    expect(hints.map((hint) => hint.kind)).toEqual(["run-says-nothing-new"]);
  });

  it("leaves a run whose writer is gone, and one that does not check out, to other readers", () => {
    expect(superviseRuns(inputs({ statuses: [report({ activitySinceMs: 60 * MINUTE, gone: true })] }))).toEqual([]);
    expect(superviseRuns(inputs({ statuses: [report({ activitySinceMs: 60 * MINUTE, signature: "does-not-check-out" })] }))).toEqual([]);
  });
});

describe("superviseRuns — a run waiting on a person", () => {
  it("is pointed out past its own threshold, and not also as silent", () => {
    const hints = superviseRuns(inputs({
      statuses: [report({
        activitySinceMs: 15 * MINUTE,
        activity: "waiting for a permission",
        waiting: { kind: "permission", description: "Run npm install" },
      })],
    }));
    expect(hints).toEqual([{
      id: "run-waits-on-you:i1",
      kind: "run-waits-on-you",
      subject: "A run on demo has waited on a person for 15 minutes",
      because: expect.stringContaining("waiting for a permission: Run npm install"),
      commands: ["openspec-ui-cli status --cwd /work/demo"],
    }]);
  });

  it("is not pointed out under its threshold", () => {
    expect(superviseRuns(inputs({
      statuses: [report({ activitySinceMs: 30_000, waiting: { kind: "checkpoint", stage: "apply", nextStage: "verify" } })],
    }))).toEqual([]);
  });
});

describe("superviseRuns — a last run that cannot be repeated", () => {
  it("is pointed out with what it printed and the remedy", () => {
    const hints = superviseRuns(inputs({ lastRuns: { byChange: { demo: failed() } } }));
    expect(hints).toEqual([{
      id: "last-run-cannot-be-repeated:demo:c1",
      kind: "last-run-cannot-be-repeated",
      subject: "demo's last run failed at apply, and repeating it will not help",
      because: 'The agent is not signed in: repeating will not help. It printed: "Authentication required".'
        + " Run `copilot` in a terminal and sign in, then start the run again.",
      commands: ["copilot"],
    }]);
  });

  it("is not pointed out where repeating is likely to help, or not known to", () => {
    const likely = failed({ diagnosis: { cause: "server-error", repeatHelps: "likely" } });
    const unknown = failed({ diagnosis: { cause: "unknown", repeatHelps: "unknown" } });
    expect(superviseRuns(inputs({ lastRuns: { byChange: { a: likely, b: unknown, c: failed({ diagnosis: undefined }) } } }))).toEqual([]);
  });

  it("is not pointed out once a later run ended otherwise", () => {
    // `lastRunsOf` keeps the latest run per change, so a completed run
    // after the failure is the run the reading holds.
    expect(superviseRuns(inputs({ lastRuns: { byChange: { demo: failed({ outcome: "completed", diagnosis: undefined }) } } }))).toEqual([]);
  });

  it("is not pointed out while a run is working on the change", () => {
    expect(superviseRuns(inputs({ statuses: [report()], lastRuns: { byChange: { demo: failed() } } }))).toEqual([]);
  });
});

describe("superviseRuns — turned off", () => {
  it("computes nothing under off, for the workspace or for one change", () => {
    const silent = report({ activitySinceMs: 60 * MINUTE });
    expect(superviseRuns(inputs({ statuses: [silent], lastRuns: { byChange: { other: failed() } }, supervisor: { mode: "off" } }))).toEqual([]);

    const offForDemo = (changeName: string | null) => ({ ...DEFAULT_SUPERVISOR, mode: changeName === "demo" ? "off" as const : "advise" as const });
    const hints = superviseRuns(inputs({
      statuses: [silent, report({ instanceId: "i2", changeName: "other", workingDirectory: "/work/other", activitySinceMs: 60 * MINUTE })],
      supervisorFor: offForDemo,
    }));
    expect(hints.map((hint) => hint.id)).toEqual(["run-says-nothing-new:i2"]);
  });
});

describe("superviseRuns — stable for the same facts", () => {
  it("gives the same ids in the same order on two readings", () => {
    const facts = inputs({
      statuses: [report({ activitySinceMs: 20 * MINUTE }), report({ instanceId: "i2", changeName: null, activitySinceMs: 20 * MINUTE })],
      lastRuns: { byChange: { zeta: failed({ runId: "z" }), alpha: failed({ runId: "a" }) } },
    });
    const first = superviseRuns(facts).map((hint) => hint.id);
    expect(first).toEqual([
      "run-says-nothing-new:i1",
      "run-says-nothing-new:i2",
      "last-run-cannot-be-repeated:alpha:a",
      "last-run-cannot-be-repeated:zeta:z",
    ]);
    expect(superviseRuns(facts).map((hint) => hint.id)).toEqual(first);
  });
});

describe("describeSpan", () => {
  it("says seconds, minutes or hours, rounded down", () => {
    expect(describeSpan(1_000)).toBe("1 second");
    expect(describeSpan(90_000)).toBe("90 seconds");
    expect(describeSpan(11.9 * MINUTE)).toBe("11 minutes");
    expect(describeSpan(150 * MINUTE)).toBe("2 hours");
  });
});

// the-supervisor-changes-agents 1.3
describe("superviseFailure", () => {
  const notSignedIn = { cause: "not-signed-in", repeatHelps: "no" } as const;

  function facts(partial: Partial<FailureFactsForDecision> & { policy?: Partial<ResolvedSupervisor> } = {}): FailureFactsForDecision {
    return {
      stage: "apply",
      current: "copilot-cli-acp",
      tried: partial.tried ?? [partial.current ?? "copilot-cli-acp"],
      diagnosis: notSignedIn,
      supervisor: {
        fallback: { apply: ["claude-cli-acp", "local-llm-acp"] },
        allowCostIncrease: true,
        allowProviderChange: true,
        ...partial.policy,
      },
      ...partial,
    };
  }

  it("repeats on the same agent where repeating is likely to help", () => {
    expect(superviseFailure(facts({ diagnosis: { cause: "rate-limited", repeatHelps: "likely" } })))
      .toEqual({ action: "repeat", agent: "copilot-cli-acp", because: expect.stringContaining("rate") });
  });

  it("moves to the first fallback the policy allows that was not tried", () => {
    expect(superviseFailure(facts())).toMatchObject({ action: "move", agent: "claude-cli-acp" });
    expect(superviseFailure(facts({ tried: ["copilot-cli-acp", "claude-cli-acp"] })))
      .toMatchObject({ action: "move", agent: "local-llm-acp" });
  });

  it("refuses a provider change, and names the rule", () => {
    const decision = superviseFailure(facts({ policy: { fallback: { apply: ["claude-cli-acp"] }, allowProviderChange: false } }));
    expect(decision).toEqual({ action: "none", why: expect.stringContaining("claude-cli-acp is another provider (anthropic), and allowProviderChange is false") });
  });

  it("refuses a cost increase, and names the rule", () => {
    const decision = superviseFailure(facts({ policy: { fallback: { apply: ["copilot-cli"] }, allowCostIncrease: false } }));
    expect(decision).toEqual({ action: "none", why: expect.stringContaining("copilot-cli may cost money, and allowCostIncrease is false") });
  });

  it("allows the local model without allowCostIncrease, and names the fallback it passed over", () => {
    expect(superviseFailure(facts({ policy: { allowCostIncrease: false } }))).toEqual({
      action: "move",
      agent: "local-llm-acp",
      because: expect.stringContaining("passed over: claude-cli-acp may cost money, and allowCostIncrease is false"),
    });
  });

  it("tries nothing twice", () => {
    expect(superviseFailure(facts({ tried: ["copilot-cli-acp", "claude-cli-acp", "local-llm-acp"] })))
      .toEqual({ action: "none", why: expect.stringContaining("every fallback for apply has been tried") });
  });

  it("does nothing where the cause is unknown, or the stage has no fallback", () => {
    expect(superviseFailure(facts({ diagnosis: { cause: "unknown", repeatHelps: "unknown" } }))).toMatchObject({ action: "none" });
    expect(superviseFailure(facts({ diagnosis: undefined }))).toMatchObject({ action: "none" });
    expect(superviseFailure(facts({ policy: { fallback: {} } })))
      .toEqual({ action: "none", why: expect.stringContaining("apply names no fallback agent") });
  });
});

// the-supervisor-changes-agents 1.5
describe("superviseRuns — the fallback under advise", () => {
  it("names the fallback act would move the stage to, and changes nothing", () => {
    const hints = superviseRuns(inputs({
      lastRuns: { byChange: { demo: failed({ agent: "copilot-cli-acp" }) } },
      supervisor: { fallback: { apply: ["claude-cli-acp"] }, allowCostIncrease: true, allowProviderChange: true },
    }));
    expect(hints).toHaveLength(1);
    expect(hints[0]?.because).toContain("Its fallback for apply, claude-cli-acp, is allowed by this change's policy");
    expect(hints[0]?.because).toContain('under supervisor.mode "act" a chain would move the stage to it');
    expect(hints[0]?.commands).toEqual(["copilot"]);
  });

  it("says nothing of a fallback the policy refuses", () => {
    const hints = superviseRuns(inputs({
      lastRuns: { byChange: { demo: failed({ agent: "copilot-cli-acp" }) } },
      supervisor: { fallback: { apply: ["claude-cli-acp"] } },
    }));
    expect(hints[0]?.because).not.toContain("fallback");
  });
});
