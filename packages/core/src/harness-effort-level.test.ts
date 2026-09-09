import { describe, expect, it } from "vitest";
import { HARNESS_EFFORT_LEVELS, effortLevelCollisions, resolveEffortLevel } from "./harness-effort-level.js";
import { HARNESS_AGENT_CAPABILITIES } from "./harness-step-agent.js";

// presets-by-effort:
// pure over the capability table — no files, no processes.

describe("resolveEffortLevel", () => {
  it("gives each agent its own top and bottom value", () => {
    // The point of a level: `max` is a value `claude` accepts and
    // `codex` does not, so a stored literal would be wrong for one of
    // them the moment it was applied.
    expect(resolveEffortLevel("claude-cli", "highest").effort).toBe("max");
    expect(resolveEffortLevel("codex-cli", "highest").effort).toBe("high");
    expect(resolveEffortLevel("claude-cli", "lowest").effort).toBe("low");
    expect(resolveEffortLevel("copilot-cli", "lowest").effort).toBe("none");
  });

  it("answers with a value the agent accepts, for every agent and level", () => {
    for (const [agent, capabilities] of Object.entries(HARNESS_AGENT_CAPABILITIES)) {
      const accepted = capabilities.effort ?? [];
      for (const level of HARNESS_EFFORT_LEVELS) {
        const resolved = resolveEffortLevel(agent, level);
        expect(resolved.accepted).toEqual(accepted);
        if (accepted.length === 0) expect(resolved.effort).toBeUndefined();
        else expect(accepted).toContain(resolved.effort);
      }
    }
  });

  it("says nothing rather than guessing for an agent with no effort", () => {
    // Five of the ten registered agents accept none. That is a fact
    // about the agent, and inventing a value for them would be a
    // configuration the validator then refuses.
    const resolved = resolveEffortLevel("gemini-cli", "highest");
    expect(resolved.effort).toBeUndefined();
    expect(resolved.accepted).toEqual([]);
  });

  it("says nothing for an agent it does not know", () => {
    expect(resolveEffortLevel("not-an-agent", "highest").effort).toBeUndefined();
  });
});

describe("effortLevelCollisions", () => {
  it("reports none for any agent that accepts effort at all", () => {
    // The levels are spaced evenly for this reason: over `codex-cli`'s
    // four values the tidier 1 / 0.75 / 0.5 / 0 put two levels on one
    // value, so two configurations would have differed in nothing.
    for (const [agent, capabilities] of Object.entries(HARNESS_AGENT_CAPABILITIES)) {
      if ((capabilities.effort ?? []).length === 0) continue;
      expect(effortLevelCollisions(agent)).toEqual([]);
    }
  });

  it("reports every level collapsing for an agent with no effort", () => {
    // The extreme case, reported rather than hidden: for these agents
    // the configurations differ only in their ceilings, and a surface
    // that showed four effort choices would be showing one.
    expect(effortLevelCollisions("vscode-chat")).toEqual([[...HARNESS_EFFORT_LEVELS]]);
  });
});
