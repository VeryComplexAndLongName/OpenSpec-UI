import { describe, expect, it } from "vitest";
import { DEFAULT_HARNESS_CONFIG, type HarnessConfig } from "./harness-config.js";
import { agentForChosenPath, buildRunPlan, describeRunStart, runStartFactsFrom, runStartStage } from "./run-plan.js";

// one-way-in-to-run:
// pure over in-memory data — no files, no processes.

function config(overrides: Partial<HarnessConfig> = {}): HarnessConfig {
  return { ...DEFAULT_HARNESS_CONFIG, stepAgents: {}, ...overrides };
}

describe("buildRunPlan", () => {
  it("says one stage will run for an assisted change, and names the setting", () => {
    // The sentence is the product. Today the same decision is made and
    // nothing is shown, which is why "it only changed tabs" is a
    // reasonable thing for a person to think.
    const plan = buildRunPlan(config({ autonomyLevel: "assisted" }), { hasVsCodeAgent: false });

    expect(plan.resolved).toBe("single-stage");
    expect(plan.because).toContain('autonomyLevel is "assisted"');
  });

  it("says a chain will run for a semi-autonomous change, naming each stage's agent", () => {
    const plan = buildRunPlan(
      config({
        autonomyLevel: "semi-autonomous",
        stepAgents: { propose: "claude-cli", apply: { agent: "claude-cli-acp", effort: "high" } },
      }),
      { hasVsCodeAgent: true },
    );

    expect(plan.resolved).toBe("chain");
    expect(plan.stageAgents).toEqual([
      { stage: "propose", agent: "claude-cli" },
      { stage: "review", agent: undefined },
      { stage: "apply", agent: "claude-cli-acp" },
      { stage: "verify", agent: undefined },
    ]);
  });

  it("says which stages have no agent rather than leaving them out", () => {
    // A stage missing from the list reads as a stage that does not run.
    const plan = buildRunPlan(config({ stepAgents: {} }), { hasVsCodeAgent: false });

    expect(plan.stageAgents.map((entry) => entry.stage)).toEqual(["propose", "review", "apply", "verify"]);
    expect(plan.stageAgents.every((entry) => entry.agent === undefined)).toBe(true);
  });

  it("offers the VS Code agent only where there is one", () => {
    // Offering a path that cannot run is the same defect as a ceiling
    // that cannot act.
    const withChat = buildRunPlan(config(), { hasVsCodeAgent: true });
    const withoutChat = buildRunPlan(config(), { hasVsCodeAgent: false });

    expect(withChat.offered.map((path) => path.id)).toContain("vscode-agent");
    expect(withoutChat.offered.map((path) => path.id)).not.toContain("vscode-agent");
  });

  it("describes every path it offers", () => {
    // A list of paths carrying only names gives no help choosing between
    // them — the same reason a template carries "not for".
    for (const path of buildRunPlan(config(), { hasVsCodeAgent: true }).offered) {
      expect(path.describes.length).toBeGreaterThan(0);
      expect(path.title.length).toBeGreaterThan(0);
    }
  });
});

describe("agentForChosenPath", () => {
  it("uses the VS Code agent when that path is chosen, whatever the file says", () => {
    const chosen = agentForChosenPath(config({ stepAgents: { apply: "claude-cli" } }), "vscode-agent");

    expect(chosen).toBe("vscode-chat");
  });

  it("uses the configured agent for the other paths", () => {
    const configured = config({ stepAgents: { apply: "claude-cli" } });

    expect(agentForChosenPath(configured, "chain")).toBe("claude-cli");
    expect(agentForChosenPath(configured, "single-stage")).toBe("claude-cli");
  });
});

describe("buildRunPlan — what it advises", () => {
  // The recommendation existed before this dialog did, as its own
  // command, because there was nowhere to show it at the moment it
  // matters. This is that moment: the question "which configuration
  // suits this change" is being answered by starting the run.

  it("carries the recommendation and its grounds when there is something to reason from", () => {
    const plan = buildRunPlan(config(), {
      hasVsCodeAgent: false,
      recommendationInput: { openTaskCount: 31 },
    });

    expect(plan.advice?.template?.id).toBe("careful");
    // The grounds travel with the answer. A recommendation whose reasons
    // are hidden can only be accepted or ignored, never disagreed with.
    expect(plan.advice?.grounds.join(" ")).toContain("31 tasks still open");
  });

  it("gives no recommendation rather than one drawn from nothing", () => {
    // "No recommendation" and "a recommendation with no grounds" are
    // different, and only the first is honest.
    const plan = buildRunPlan(config(), { hasVsCodeAgent: false });

    expect(plan.advice).toBeUndefined();
  });

  it("reports a ceiling that cannot act before the run, not after", () => {
    // `claude-cli` reports no spend at all, so a cost ceiling over it can
    // never fire. Worth knowing while the money has not been spent.
    const plan = buildRunPlan(
      config({ stepAgents: { apply: "claude-cli" }, budget: { maxCostUsd: 5 } }),
      { hasVsCodeAgent: false },
    );

    expect(plan.findings.length).toBeGreaterThan(0);
  });

  it("reports no findings for a configuration whose ceilings can act", () => {
    const plan = buildRunPlan(config({ stepAgents: { apply: "claude-cli-acp" } }), { hasVsCodeAgent: false });

    expect(plan.findings).toEqual([]);
  });
});

// the-run-dialog-says-where-it-starts. A user with a change 65 of 66 done
// could not tell from the dialog what a press would do.
describe("where a run begins", () => {
  it("begins at propose without a proposal and a task list, at apply while a task is open, at verify once none is", () => {
    expect(runStartStage({ proposeDone: false })).toBe("propose");
    expect(runStartStage({ proposeDone: true, openTasks: 1 })).toBe("apply");
    expect(runStartStage({ proposeDone: true, openTasks: 0 })).toBe("verify");
    // Unknown progress picks the reversible stage.
    expect(runStartStage({ proposeDone: true })).toBe("apply");
  });

  it("says where it begins and why, in one sentence", () => {
    expect(describeRunStart({ proposeDone: false })).toBe("Starts at propose: there is no proposal and task list yet.");
    expect(describeRunStart({ proposeDone: true, openTasks: 1 })).toBe("Continues at apply: 1 task still open.");
    expect(describeRunStart({ proposeDone: true, openTasks: 3 })).toBe("Continues at apply: 3 tasks still open.");
    expect(describeRunStart({ proposeDone: true, openTasks: 0 })).toBe("Continues at verify: every task is done.");
    expect(describeRunStart({ proposeDone: true })).toBe("Continues at apply: the task list could not be read.");
  });

  it("reads the facts from a proposal and a task list, an empty list being no plan yet", () => {
    const done = { done: true };
    const open = { done: false };

    expect(runStartFactsFrom({ hasProposal: true, tasks: [done, open] })).toEqual({ proposeDone: true, openTasks: 1 });
    expect(runStartFactsFrom({ hasProposal: true, tasks: [] })).toEqual({ proposeDone: false, openTasks: 0 });
    expect(runStartFactsFrom({ hasProposal: false, tasks: [open] })).toEqual({ proposeDone: false, openTasks: 1 });
    expect(runStartFactsFrom({ hasProposal: true })).toEqual({ proposeDone: true });
  });

  it("carries where it begins in the plan, where the host read the change", () => {
    const plan = buildRunPlan(config(), { hasVsCodeAgent: false, runStart: { proposeDone: true, openTasks: 1 } });
    const unread = buildRunPlan(config(), { hasVsCodeAgent: false });

    expect(plan.startsAt).toEqual({ stage: "apply", says: "Continues at apply: 1 task still open." });
    expect(unread.startsAt).toBeUndefined();
  });

  it("does not offer a chain the configuration would refuse, and says why", () => {
    const assisted = buildRunPlan(config({ autonomyLevel: "assisted" }), { hasVsCodeAgent: true });
    const chained = buildRunPlan(config({ autonomyLevel: "semi-autonomous" }), { hasVsCodeAgent: true });

    expect(assisted.offered.map((path) => path.id)).toEqual(["single-stage", "vscode-agent"]);
    expect(assisted.withheld?.path).toBe("chain");
    expect(assisted.withheld?.says).toContain('autonomyLevel "assisted" runs one stage at a time');
    expect(chained.offered.map((path) => path.id)).toEqual(["chain", "single-stage", "vscode-agent"]);
    expect(chained.withheld).toBeUndefined();
  });
});
