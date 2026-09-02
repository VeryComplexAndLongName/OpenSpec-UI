import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AGENT_REGISTRY } from "./agents/registry.js";
import {
  DEFAULT_HARNESS_CONFIG,
  GlobalAgentSufficientReviewGateError,
  GlobalAutonomousAutonomyLevelError,
  GlobalCheckpointsDisabledError,
  GlobalGitAllowlistError,
  HARNESS_AGENT_CAPABILITIES,
  InvalidHarnessConfigError,
  mergeHarnessConfig,
  normalizeStepAgent,
  readChangeHarnessConfig,
  readGlobalHarnessConfig,
  resolveHarnessConfig,
  resolveRunWithHarnessTarget,
  VSCODE_CHAT_STEP_AGENT_ID,
  writeChangeHarnessConfig,
  writeGlobalHarnessConfig,
} from "./harness-config.js";

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-harness-config-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("readGlobalHarnessConfig", () => {
  it("returns the documented default when the file does not exist", async () => {
    const root = await temporaryRoot();
    expect(await readGlobalHarnessConfig(root)).toEqual(DEFAULT_HARNESS_CONFIG);
  });

  it("reads a real global config from disk", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { stepAgents: { propose: "claude-cli" }, autonomyLevel: "assisted" });

    const config = await readGlobalHarnessConfig(root);
    expect(config.stepAgents).toEqual({ propose: "claude-cli" });
    expect(config.reviewGate).toEqual({ mode: "human-required" });
  });

  it("rejects a global file that sets reviewGate.mode to agent-sufficient", async () => {
    const root = await temporaryRoot();
    await mkdir(path.join(root, "openspec"), { recursive: true });
    await expect(writeGlobalHarnessConfig(root, { reviewGate: { mode: "agent-sufficient" } })).rejects.toThrow(
      GlobalAgentSufficientReviewGateError,
    );
  });

  it("rejects reading a hand-edited global file that sets agent-sufficient", async () => {
    const root = await temporaryRoot();
    await mkdir(path.join(root, "openspec"), { recursive: true });
    await writeFile(
      path.join(root, "openspec", "agent-harness.json"),
      JSON.stringify({ reviewGate: { mode: "agent-sufficient" } }),
      "utf8",
    );

    await expect(readGlobalHarnessConfig(root)).rejects.toThrow(GlobalAgentSufficientReviewGateError);
  });

  it("rejects a stepAgents entry referencing an unknown agent id", async () => {
    const root = await temporaryRoot();
    await expect(
      writeGlobalHarnessConfig(root, { stepAgents: { propose: "not-a-real-agent" } }),
    ).rejects.toThrow(InvalidHarnessConfigError);
  });

  it("rejects a global file that sets autonomyLevel to autonomous", async () => {
    const root = await temporaryRoot();
    await mkdir(path.join(root, "openspec"), { recursive: true });
    await expect(writeGlobalHarnessConfig(root, { autonomyLevel: "autonomous" })).rejects.toThrow(
      GlobalAutonomousAutonomyLevelError,
    );
  });

  it("rejects reading a hand-edited global file that sets autonomyLevel to autonomous", async () => {
    const root = await temporaryRoot();
    await mkdir(path.join(root, "openspec"), { recursive: true });
    await writeFile(
      path.join(root, "openspec", "agent-harness.json"),
      JSON.stringify({ autonomyLevel: "autonomous" }),
      "utf8",
    );

    await expect(readGlobalHarnessConfig(root)).rejects.toThrow(GlobalAutonomousAutonomyLevelError);
  });

  it("rejects a global file that disables checkpoints.requireConfirmationBetweenSteps", async () => {
    const root = await temporaryRoot();
    await mkdir(path.join(root, "openspec"), { recursive: true });
    await expect(
      writeGlobalHarnessConfig(root, { checkpoints: { requireConfirmationBetweenSteps: false } }),
    ).rejects.toThrow(GlobalCheckpointsDisabledError);
  });

  it("rejects reading a hand-edited global file that disables checkpoints.requireConfirmationBetweenSteps", async () => {
    const root = await temporaryRoot();
    await mkdir(path.join(root, "openspec"), { recursive: true });
    await writeFile(
      path.join(root, "openspec", "agent-harness.json"),
      JSON.stringify({ checkpoints: { requireConfirmationBetweenSteps: false } }),
      "utf8",
    );

    await expect(readGlobalHarnessConfig(root)).rejects.toThrow(GlobalCheckpointsDisabledError);
  });

  it("rejects a global file that sets gitStageAllowlist", async () => {
    const root = await temporaryRoot();
    await mkdir(path.join(root, "openspec"), { recursive: true });
    await expect(
      writeGlobalHarnessConfig(root, { gitStageAllowlist: { remotes: ["origin"], branches: ["feature/*"] } }),
    ).rejects.toThrow(GlobalGitAllowlistError);
  });

  it("rejects reading a hand-edited global file that sets gitStageAllowlist", async () => {
    const root = await temporaryRoot();
    await mkdir(path.join(root, "openspec"), { recursive: true });
    await writeFile(
      path.join(root, "openspec", "agent-harness.json"),
      JSON.stringify({ gitStageAllowlist: { remotes: ["origin"], branches: ["feature/*"] } }),
      "utf8",
    );

    await expect(readGlobalHarnessConfig(root)).rejects.toThrow(GlobalGitAllowlistError);
  });
});

describe("readChangeHarnessConfig", () => {
  it("returns undefined when no per-change file exists", async () => {
    const root = await temporaryRoot();
    expect(await readChangeHarnessConfig(root, "some-change")).toBeUndefined();
  });

  it("accepts reviewGate.mode: agent-sufficient at the per-change level", async () => {
    const root = await temporaryRoot();
    await writeChangeHarnessConfig(root, "some-change", { reviewGate: { mode: "agent-sufficient" } });

    const override = await readChangeHarnessConfig(root, "some-change");
    expect(override?.reviewGate).toEqual({ mode: "agent-sufficient" });
  });

  it("accepts autonomyLevel: autonomous at the per-change level", async () => {
    const root = await temporaryRoot();
    await writeChangeHarnessConfig(root, "some-change", { autonomyLevel: "autonomous" });

    const override = await readChangeHarnessConfig(root, "some-change");
    expect(override?.autonomyLevel).toBe("autonomous");
  });

  it("accepts checkpoints.requireConfirmationBetweenSteps: false at the per-change level", async () => {
    const root = await temporaryRoot();
    await writeChangeHarnessConfig(root, "some-change", {
      checkpoints: { requireConfirmationBetweenSteps: false },
    });

    const override = await readChangeHarnessConfig(root, "some-change");
    expect(override?.checkpoints).toEqual({ requireConfirmationBetweenSteps: false });
  });

  it("accepts gitStageAllowlist at the per-change level", async () => {
    const root = await temporaryRoot();
    await writeChangeHarnessConfig(root, "some-change", {
      gitStageAllowlist: { remotes: ["origin"], branches: ["feature/*", "hotfix/*"] },
    });

    const override = await readChangeHarnessConfig(root, "some-change");
    expect(override?.gitStageAllowlist).toEqual({ remotes: ["origin"], branches: ["feature/*", "hotfix/*"] });
  });
});

describe("mergeHarnessConfig", () => {
  it("returns the global config unchanged when there is no override", () => {
    const global = { ...DEFAULT_HARNESS_CONFIG, stepAgents: { propose: "claude-cli" } };
    expect(mergeHarnessConfig(global, undefined)).toBe(global);
  });

  it("inherits every stepAgents entry not explicitly overridden", () => {
    const global = {
      stepAgents: { propose: "claude-cli", review: "claude-cli", apply: "gemini-cli" },
      autonomyLevel: "assisted" as const,
      reviewGate: { mode: "human-required" as const },
    };
    const merged = mergeHarnessConfig(global, { stepAgents: { apply: "codex-cli" } });

    expect(merged.stepAgents).toEqual({ propose: "claude-cli", review: "claude-cli", apply: "codex-cli" });
    expect(merged.reviewGate).toEqual({ mode: "human-required" });
  });

  it("overrides reviewGate.mode alone without touching stepAgents", () => {
    const global = {
      stepAgents: { propose: "claude-cli" },
      autonomyLevel: "assisted" as const,
      reviewGate: { mode: "human-required" as const },
    };
    const merged = mergeHarnessConfig(global, { reviewGate: { mode: "agent-sufficient" } });

    expect(merged.stepAgents).toEqual({ propose: "claude-cli" });
    expect(merged.reviewGate).toEqual({ mode: "agent-sufficient" });
  });

  it("inherits an absent checkpoints field from the global config", () => {
    const global = {
      stepAgents: {},
      autonomyLevel: "assisted" as const,
      reviewGate: { mode: "human-required" as const },
    };
    expect(mergeHarnessConfig(global, { autonomyLevel: "semi-autonomous" }).checkpoints).toBeUndefined();
  });

  it("overrides checkpoints alone without touching autonomyLevel", () => {
    const global = {
      stepAgents: {},
      autonomyLevel: "semi-autonomous" as const,
      reviewGate: { mode: "human-required" as const },
    };
    const merged = mergeHarnessConfig(global, { checkpoints: { requireConfirmationBetweenSteps: false } });

    expect(merged.autonomyLevel).toBe("semi-autonomous");
    expect(merged.checkpoints).toEqual({ requireConfirmationBetweenSteps: false });
  });
});

describe("resolveHarnessConfig", () => {
  it("resolves to the global config when no changeName is given", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { stepAgents: { propose: "claude-cli" } });

    expect((await resolveHarnessConfig(root)).stepAgents).toEqual({ propose: "claude-cli" });
  });

  it("resolves the merged config for a change with an override", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { stepAgents: { propose: "claude-cli", apply: "gemini-cli" } });
    await writeChangeHarnessConfig(root, "demo", { reviewGate: { mode: "agent-sufficient" } });

    const resolved = await resolveHarnessConfig(root, "demo");
    expect(resolved.stepAgents).toEqual({ propose: "claude-cli", apply: "gemini-cli" });
    expect(resolved.reviewGate).toEqual({ mode: "agent-sufficient" });
  });

  it("falls back to the global config when the named change has no override", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { stepAgents: { propose: "claude-cli" } });

    const resolved = await resolveHarnessConfig(root, "no-override-here");
    expect(resolved.stepAgents).toEqual({ propose: "claude-cli" });
    expect(resolved.reviewGate).toEqual({ mode: "human-required" });
  });
});

describe("stepAgents.verify (task 5.5)", () => {
  it("resolves through the same global/per-change merge as every other stage", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { stepAgents: { propose: "claude-cli", verify: "gemini-cli" } });
    await writeChangeHarnessConfig(root, "demo", { stepAgents: { verify: "codex-cli" } });

    const resolved = await resolveHarnessConfig(root, "demo");
    expect(resolved.stepAgents).toEqual({ propose: "claude-cli", verify: "codex-cli" });
    expect(normalizeStepAgent(resolved.stepAgents.verify!)).toEqual({ agent: "codex-cli" });
  });

  it("an unset stepAgents.verify behaves exactly as an unset review does today", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { stepAgents: { propose: "claude-cli" } });

    const resolved = await resolveHarnessConfig(root, "demo");
    expect(resolved.stepAgents.verify).toBeUndefined();
    expect(resolved.stepAgents.review).toBeUndefined();
  });

  it("rejects a stepAgents.verify entry referencing an unknown agent id, like every other stage", async () => {
    const root = await temporaryRoot();
    await expect(
      writeGlobalHarnessConfig(root, { stepAgents: { verify: "not-a-real-agent" } }),
    ).rejects.toThrow(InvalidHarnessConfigError);
  });
});

describe("stepAgents model support", () => {
  it("still resolves the bare-string form exactly as before (regression guard)", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { stepAgents: { propose: "claude-cli" } });

    const config = await readGlobalHarnessConfig(root);
    expect(config.stepAgents).toEqual({ propose: "claude-cli" });
    expect(normalizeStepAgent(config.stepAgents.propose!)).toEqual({ agent: "claude-cli" });
  });

  it("resolves the object form to the same agent, with the model carried", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      stepAgents: { apply: { agent: "claude-cli", model: "claude-haiku-4-5" } },
    });

    const config = await readGlobalHarnessConfig(root);
    expect(normalizeStepAgent(config.stepAgents.apply!)).toEqual({
      agent: "claude-cli",
      model: "claude-haiku-4-5",
    });
  });

  it.each([
    ["a space", "bad model"],
    ["a quote", 'bad"model'],
    ["a leading dash", "-bad-model"],
  ])("rejects a model containing %s", async (_label, model) => {
    const root = await temporaryRoot();
    await expect(
      writeGlobalHarnessConfig(root, { stepAgents: { apply: { agent: "claude-cli", model } } }),
    ).rejects.toThrow(InvalidHarnessConfigError);
  });

  it("rejects a model set for an agent that accepts none, naming the stage and agent", async () => {
    const root = await temporaryRoot();
    await expect(
      writeGlobalHarnessConfig(root, { stepAgents: { apply: { agent: "local-llm", model: "some-model" } } }),
    ).rejects.toThrow(/stepAgents\.apply.*"local-llm"/);
  });

  it("lets a per-change harness.json model override the global one for that stage", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      stepAgents: { apply: { agent: "claude-cli", model: "expensive-model" } },
    });
    await writeChangeHarnessConfig(root, "demo", {
      stepAgents: { apply: { agent: "claude-cli", model: "cheap-model" } },
    });

    const resolved = await resolveHarnessConfig(root, "demo");
    expect(normalizeStepAgent(resolved.stepAgents.apply!)).toEqual({
      agent: "claude-cli",
      model: "cheap-model",
    });
  });
});

describe("stepAgents chat-runner strictness and legacy dispatch migration", () => {
  it("rejects model on vscode-chat because it cannot reach anything in chat-dispatch mode", async () => {
    const root = await temporaryRoot();
    await expect(
      writeChangeHarnessConfig(root, "demo", {
        stepAgents: { apply: { agent: VSCODE_CHAT_STEP_AGENT_ID, model: "claude-opus-5" } },
      }),
    ).rejects.toThrow(/cannot reach anything/);
  });

  it("rejects effort on vscode-chat because it cannot reach anything in chat-dispatch mode", async () => {
    const root = await temporaryRoot();
    await expect(
      writeChangeHarnessConfig(root, "demo", {
        stepAgents: { apply: { agent: VSCODE_CHAT_STEP_AGENT_ID, effort: "high" } },
      }),
    ).rejects.toThrow(/cannot reach anything/);
  });

  it("rejects budget on vscode-chat because it cannot reach anything in chat-dispatch mode", async () => {
    const root = await temporaryRoot();
    await expect(
      writeChangeHarnessConfig(root, "demo", {
        stepAgents: { apply: { agent: VSCODE_CHAT_STEP_AGENT_ID, budget: { maxCostUsd: 10 } } },
      }),
    ).rejects.toThrow(/cannot reach anything/);
  });

  it("rejects an unknown top-level stepAgents key, naming the key and accepted set", async () => {
    const root = await temporaryRoot();
    await mkdir(path.join(root, "openspec"), { recursive: true });
    await writeFile(
      path.join(root, "openspec", "agent-harness.json"),
      JSON.stringify({ stepAgents: { propose: { agent: "claude-cli", modle: "claude-opus-5" } } }),
      "utf8",
    );

    await expect(readGlobalHarnessConfig(root)).rejects.toThrow(/unknown key "modle"/);
    await expect(readGlobalHarnessConfig(root)).rejects.toThrow(/accepted keys: agent, model, effort, budget/);
  });

  it("rejects an unknown budget key, naming the key and accepted set", async () => {
    const root = await temporaryRoot();
    await mkdir(path.join(root, "openspec"), { recursive: true });
    await writeFile(
      path.join(root, "openspec", "agent-harness.json"),
      JSON.stringify({ stepAgents: { propose: { agent: "claude-cli", budget: { maxCostUsd: 5, maxCostUSd: 10 } } } }),
      "utf8",
    );

    await expect(readGlobalHarnessConfig(root)).rejects.toThrow(/unknown key "maxCostUSd"/);
    await expect(readGlobalHarnessConfig(root)).rejects.toThrow(/accepted keys: maxCostUsd, maxAiCredits/);
  });

  it("migrates legacy dispatch:vscode-chat to agent:vscode-chat and reports once", async () => {
    const root = await temporaryRoot();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await mkdir(path.join(root, "openspec", "changes", "demo"), { recursive: true });
    await writeFile(
      path.join(root, "openspec", "changes", "demo", "harness.json"),
      JSON.stringify({ stepAgents: { apply: { agent: "claude-cli", dispatch: "vscode-chat" } } }),
      "utf8",
    );

    const override = await readChangeHarnessConfig(root, "demo");
    expect(override?.stepAgents?.apply).toEqual({ agent: VSCODE_CHAT_STEP_AGENT_ID });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('stepAgents.apply.agent "vscode-chat"');
    warn.mockRestore();
  });

  it("migrates legacy dispatch:cli silently", async () => {
    const root = await temporaryRoot();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await mkdir(path.join(root, "openspec"), { recursive: true });
    await writeFile(
      path.join(root, "openspec", "agent-harness.json"),
      JSON.stringify({ stepAgents: { apply: { agent: "claude-cli", dispatch: "cli", model: "claude-opus-5" } } }),
      "utf8",
    );

    const config = await readGlobalHarnessConfig(root);
    expect(config.stepAgents.apply).toEqual({ agent: "claude-cli", model: "claude-opus-5" });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("legacy dispatch:vscode-chat with model now fails because model cannot reach anything", async () => {
    const root = await temporaryRoot();
    await mkdir(path.join(root, "openspec"), { recursive: true });
    await writeFile(
      path.join(root, "openspec", "agent-harness.json"),
      JSON.stringify({ stepAgents: { apply: { agent: "claude-cli", dispatch: "vscode-chat", model: "claude-opus-5" } } }),
      "utf8",
    );

    await expect(readGlobalHarnessConfig(root)).rejects.toThrow(/cannot reach anything/);
  });

  it("drops a global stepAgents.archive entry, warns naming the file, and honours the rest", async () => {
    const root = await temporaryRoot();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await mkdir(path.join(root, "openspec"), { recursive: true });
    const configPath = path.join(root, "openspec", "agent-harness.json");
    await writeFile(
      configPath,
      JSON.stringify({ stepAgents: { archive: "claude-cli", apply: "claude-cli" } }),
      "utf8",
    );

    const config = await readGlobalHarnessConfig(root);

    expect(config.stepAgents).toEqual({ apply: "claude-cli" });
    expect("archive" in config.stepAgents).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain(configPath);
    expect(warn.mock.calls[0]?.[0]).toContain("stepAgents.archive was dropped");
    warn.mockRestore();
  });

  it("drops a per-change stepAgents.archive entry, warns naming the file, and honours the rest", async () => {
    const root = await temporaryRoot();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await mkdir(path.join(root, "openspec", "changes", "demo"), { recursive: true });
    const configPath = path.join(root, "openspec", "changes", "demo", "harness.json");
    await writeFile(
      configPath,
      JSON.stringify({ stepAgents: { archive: { agent: "claude-cli" }, verify: "claude-cli" } }),
      "utf8",
    );

    const override = await readChangeHarnessConfig(root, "demo");

    expect(override?.stepAgents).toEqual({ verify: "claude-cli" });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain(configPath);
    warn.mockRestore();
  });

  it("a config without stepAgents.archive is unaffected (no warning, stepAgents unchanged)", async () => {
    const root = await temporaryRoot();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await mkdir(path.join(root, "openspec"), { recursive: true });
    await writeFile(
      path.join(root, "openspec", "agent-harness.json"),
      JSON.stringify({ stepAgents: { apply: "claude-cli" } }),
      "utf8",
    );

    const config = await readGlobalHarnessConfig(root);

    expect(config.stepAgents).toEqual({ apply: "claude-cli" });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("rejects a freshly-written config that sets stepAgents.archive", async () => {
    const root = await temporaryRoot();
    await expect(writeGlobalHarnessConfig(root, { stepAgents: { archive: "claude-cli" } as never })).rejects.toThrow(
      /stepAgents\.archive is not accepted/,
    );
  });

  it("keeps accepting this repository's real openspec/agent-harness.json", async () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    // Three segments from `packages/core/src`, not four. Four reached
    // above the repository, where no config file exists, so
    // `readGlobalHarnessConfig` fell back to `DEFAULT_HARNESS_CONFIG` —
    // whose `autonomyLevel` and `reviewGate.mode` are exactly the two
    // values asserted below. The test passed without ever reading the
    // file it names, which is the failure tasks.md 6.4 exists to catch.
    const workspaceRoot = path.resolve(here, "..", "..", "..");
    const configPath = path.join(workspaceRoot, "openspec", "agent-harness.json");
    // Assert the file first, so a moved or renamed config fails here
    // rather than passing on the defaults again.
    await expect(stat(configPath)).resolves.toBeDefined();

    const config = await readGlobalHarnessConfig(workspaceRoot);
    // Non-empty `stepAgents` is what the defaults cannot produce, and is
    // the part a schema change would break.
    expect(Object.keys(config.stepAgents).length).toBeGreaterThan(0);
    for (const entry of Object.values(config.stepAgents)) {
      expect(normalizeStepAgent(entry!).agent.length).toBeGreaterThan(0);
    }
    expect(config.autonomyLevel).toBe("assisted");
    expect(config.reviewGate.mode).toBe("human-required");
  });

  it("rejects the chat runner under semi-autonomous", async () => {
    const root = await temporaryRoot();
    await expect(
      writeChangeHarnessConfig(root, "demo", {
        autonomyLevel: "semi-autonomous",
        stepAgents: { apply: VSCODE_CHAT_STEP_AGENT_ID },
      }),
    ).rejects.toThrow(/only valid under autonomyLevel "assisted"/);
  });

  it("rejects the chat runner under autonomous", async () => {
    const root = await temporaryRoot();
    await expect(
      writeChangeHarnessConfig(root, "demo", {
        autonomyLevel: "autonomous",
        stepAgents: { apply: VSCODE_CHAT_STEP_AGENT_ID },
      }),
    ).rejects.toThrow(/only valid under autonomyLevel "assisted"/);
  });
});

describe("resolveRunWithHarnessTarget", () => {
  it("returns 'picker' for assisted", () => {
    expect(resolveRunWithHarnessTarget({ ...DEFAULT_HARNESS_CONFIG, autonomyLevel: "assisted" })).toBe("picker");
  });

  it("returns 'chain' for semi-autonomous", () => {
    expect(resolveRunWithHarnessTarget({ ...DEFAULT_HARNESS_CONFIG, autonomyLevel: "semi-autonomous" })).toBe("chain");
  });

  it("returns 'chain' for autonomous", () => {
    expect(resolveRunWithHarnessTarget({ ...DEFAULT_HARNESS_CONFIG, autonomyLevel: "autonomous" })).toBe("chain");
  });
});

describe("budget (task 8.6)", () => {
  it("accepts a per-change budget higher than the global ceiling", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { budget: { maxCostUsd: 10 } });
    await writeChangeHarnessConfig(root, "demo", { budget: { maxCostUsd: 100 } });

    const config = await resolveHarnessConfig(root, "demo");
    expect(config.budget).toEqual({ maxCostUsd: 100 });
  });

  it("an absent budget behaves exactly as today — resolves to undefined, no error", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "assisted" });

    const config = await resolveHarnessConfig(root);
    expect(config.budget).toBeUndefined();
  });

  it("a per-change file with no budget of its own inherits the global one", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { budget: { maxCostUsd: 10 } });
    await writeChangeHarnessConfig(root, "demo", { autonomyLevel: "assisted" });

    const config = await resolveHarnessConfig(root, "demo");
    expect(config.budget).toEqual({ maxCostUsd: 10 });
  });

  it("rejects a non-positive maxCostUsd", async () => {
    const root = await temporaryRoot();
    await expect(writeGlobalHarnessConfig(root, { budget: { maxCostUsd: 0 } })).rejects.toThrow(InvalidHarnessConfigError);
  });

  it("rejects a non-integer maxTokens", async () => {
    const root = await temporaryRoot();
    await expect(writeGlobalHarnessConfig(root, { budget: { maxTokens: 1.5 } })).rejects.toThrow(InvalidHarnessConfigError);
  });

  // Task 8.2/8.6 also describe "the global file may not set a value that
  // raises a per-change one", rejected with a named error mirroring
  // GlobalAutonomousAutonomyLevelError/GlobalCheckpointsDisabledError.
  // Deliberately NOT implemented as a validation check: unlike those two
  // (each gating one categorical value a single file's own content
  // reveals), whether a number "raises" another is a relationship between
  // TWO files, which per this file's own documented constraint
  // ("core can only know what this one file declares, not the merged
  // result") cannot be checked at single-file validation time. The test
  // below instead demonstrates the actual guarantee: `mergeHarnessConfig`
  // makes a per-change budget win unconditionally, so the global file's
  // own value can never reach or affect a per-change one that was set —
  // there is no code path left for a "global raises per-change" error to
  // guard against. See harness-config.ts's `assertValidBudget` comment.
  it("the global file's own budget never affects a per-change file's own value (no reachable 'raise' path)", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { budget: { maxCostUsd: 1000 } });
    await writeChangeHarnessConfig(root, "demo", { budget: { maxCostUsd: 5 } });

    const config = await resolveHarnessConfig(root, "demo");
    expect(config.budget).toEqual({ maxCostUsd: 5 });
  });
});

describe("stepAgents effort and budget (harness-step-effort-and-budget)", () => {
  it("resolves a global-only effort", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { stepAgents: { apply: { agent: "claude-cli", effort: "high" } } });

    const config = await resolveHarnessConfig(root);
    expect(normalizeStepAgent(config.stepAgents.apply!)).toEqual({
      agent: "claude-cli",
      effort: "high",
    });
  });

  it("resolves a per-change-only budget, inheriting the global agent for that stage", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { stepAgents: { apply: "claude-cli" } });
    await writeChangeHarnessConfig(root, "demo", {
      stepAgents: { apply: { agent: "claude-cli", budget: { maxCostUsd: 5 } } },
    });

    const config = await resolveHarnessConfig(root, "demo");
    expect(normalizeStepAgent(config.stepAgents.apply!)).toEqual({
      agent: "claude-cli",
      budget: { maxCostUsd: 5 },
    });
  });

  it("a per-change effort overrides a global effort for the same stage", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { stepAgents: { apply: { agent: "claude-cli", effort: "low" } } });
    await writeChangeHarnessConfig(root, "demo", {
      stepAgents: { apply: { agent: "claude-cli", effort: "max" } },
    });

    const config = await resolveHarnessConfig(root, "demo");
    expect(normalizeStepAgent(config.stepAgents.apply!).effort).toBe("max");
  });

  it("rejects an effort value outside the closed set", async () => {
    const root = await temporaryRoot();
    await expect(
      writeGlobalHarnessConfig(root, { stepAgents: { apply: { agent: "claude-cli", effort: "hihg" as never } } }),
    ).rejects.toThrow(InvalidHarnessConfigError);
  });

  it("rejects an effort accepted by another agent but not this stage's agent", async () => {
    const root = await temporaryRoot();
    await expect(
      writeGlobalHarnessConfig(root, { stepAgents: { apply: { agent: "claude-cli", effort: "none" } } }),
    ).rejects.toThrow(/stepAgents\.apply\.effort "none" is not accepted by agent "claude-cli"/);
  });

  it("rejects effort set for gemini-cli, which has no command-line effort mechanism", async () => {
    const root = await temporaryRoot();
    await expect(
      writeGlobalHarnessConfig(root, { stepAgents: { apply: { agent: "gemini-cli", effort: "low" } } }),
    ).rejects.toThrow(/stepAgents\.apply.*"gemini-cli".*reasoning-effort/);
  });

  it("rejects maxCostUsd set for copilot-cli, which only accepts maxAiCredits", async () => {
    const root = await temporaryRoot();
    await expect(
      writeGlobalHarnessConfig(root, {
        stepAgents: { apply: { agent: "copilot-cli", budget: { maxCostUsd: 5 } } },
      }),
    ).rejects.toThrow(/stepAgents\.apply.*maxCostUsd.*"copilot-cli"/);
  });

  it("rejects maxAiCredits set for claude-cli, which only accepts maxCostUsd", async () => {
    const root = await temporaryRoot();
    await expect(
      writeGlobalHarnessConfig(root, {
        stepAgents: { apply: { agent: "claude-cli", budget: { maxAiCredits: 100 } } },
      }),
    ).rejects.toThrow(/stepAgents\.apply.*maxAiCredits.*"claude-cli"/);
  });

  it("rejects a copilot-cli maxAiCredits below the CLI's own 30-credit minimum", async () => {
    const root = await temporaryRoot();
    await expect(
      writeGlobalHarnessConfig(root, {
        stepAgents: { apply: { agent: "copilot-cli", budget: { maxAiCredits: 29 } } },
      }),
    ).rejects.toThrow(/at least 30/);
  });

  it("accepts a copilot-cli maxAiCredits at exactly the 30-credit minimum", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      stepAgents: { apply: { agent: "copilot-cli", budget: { maxAiCredits: 30 } } },
    });
    const config = await readGlobalHarnessConfig(root);
    expect(normalizeStepAgent(config.stepAgents.apply!).budget).toEqual({ maxAiCredits: 30 });
  });

  it("rejects a budget object with neither field set", async () => {
    const root = await temporaryRoot();
    await expect(
      writeGlobalHarnessConfig(root, { stepAgents: { apply: { agent: "claude-cli", budget: {} } } }),
    ).rejects.toThrow(InvalidHarnessConfigError);
  });
});

describe("ACP adapter capabilities match their plain counterparts (acp-agent-capabilities)", () => {
  it("resolves an effort on copilot-cli-acp, the same value copilot-cli accepts", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      stepAgents: { apply: { agent: "copilot-cli-acp", effort: "high" } },
    });
    const config = await readGlobalHarnessConfig(root);
    expect(normalizeStepAgent(config.stepAgents.apply!)).toEqual({
      agent: "copilot-cli-acp",
      effort: "high",
    });
  });

  it("resolves a maxAiCredits budget on copilot-cli-acp, the same field copilot-cli accepts", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      stepAgents: { apply: { agent: "copilot-cli-acp", budget: { maxAiCredits: 100 } } },
    });
    const config = await readGlobalHarnessConfig(root);
    expect(normalizeStepAgent(config.stepAgents.apply!).budget).toEqual({ maxAiCredits: 100 });
  });

  it("every id in AGENT_REGISTRY has a row in HARNESS_AGENT_CAPABILITIES", () => {
    for (const { id } of AGENT_REGISTRY) {
      expect(HARNESS_AGENT_CAPABILITIES).toHaveProperty(id);
    }
  });

  it("rejects maxCostUsd set for copilot-cli-acp, which only accepts maxAiCredits, same as copilot-cli", async () => {
    const root = await temporaryRoot();
    await expect(
      writeGlobalHarnessConfig(root, {
        stepAgents: { apply: { agent: "copilot-cli-acp", budget: { maxCostUsd: 5 } } },
      }),
    ).rejects.toThrow(/stepAgents\.apply.*maxCostUsd.*"copilot-cli-acp"/);
  });

  it("rejects maxAiCredits set for claude-cli-acp, which only accepts maxCostUsd, same as claude-cli", async () => {
    const root = await temporaryRoot();
    await expect(
      writeGlobalHarnessConfig(root, {
        stepAgents: { apply: { agent: "claude-cli-acp", budget: { maxAiCredits: 100 } } },
      }),
    ).rejects.toThrow(/stepAgents\.apply.*maxAiCredits.*"claude-cli-acp"/);
  });

  it("rejects a copilot-cli-acp maxAiCredits below the CLI's own 30-credit minimum, same as copilot-cli", async () => {
    const root = await temporaryRoot();
    await expect(
      writeGlobalHarnessConfig(root, {
        stepAgents: { apply: { agent: "copilot-cli-acp", budget: { maxAiCredits: 29 } } },
      }),
    ).rejects.toThrow(/at least 30/);
  });

  it("rejects effort set for codex-cli-acp, which has no command-line effort mechanism", async () => {
    const root = await temporaryRoot();
    await expect(
      writeGlobalHarnessConfig(root, { stepAgents: { apply: { agent: "codex-cli-acp", effort: "low" } } }),
    ).rejects.toThrow(/stepAgents\.apply.*"codex-cli-acp".*reasoning-effort/);
  });

  it("rejects a budget set for codex-cli-acp, which has no spending-cap mechanism", async () => {
    const root = await temporaryRoot();
    await expect(
      writeGlobalHarnessConfig(root, {
        stepAgents: { apply: { agent: "codex-cli-acp", budget: { maxCostUsd: 5 } } },
      }),
    ).rejects.toThrow(/stepAgents\.apply.*"codex-cli-acp"/);
  });

  it("rejects effort set for gemini-cli-acp, which has no command-line effort mechanism", async () => {
    const root = await temporaryRoot();
    await expect(
      writeGlobalHarnessConfig(root, { stepAgents: { apply: { agent: "gemini-cli-acp", effort: "low" } } }),
    ).rejects.toThrow(/stepAgents\.apply.*"gemini-cli-acp".*reasoning-effort/);
  });

  it("rejects a budget set for gemini-cli-acp, which has no spending-cap mechanism", async () => {
    const root = await temporaryRoot();
    await expect(
      writeGlobalHarnessConfig(root, {
        stepAgents: { apply: { agent: "gemini-cli-acp", budget: { maxAiCredits: 100 } } },
      }),
    ).rejects.toThrow(/stepAgents\.apply.*"gemini-cli-acp"/);
  });
});

describe("top-level key validation (harness-config-top-level-keys)", () => {
  it("rejects a global file with an unrecognized top-level key, naming the key and the accepted set", async () => {
    const root = await temporaryRoot();
    await mkdir(path.join(root, "openspec"), { recursive: true });
    await writeFile(path.join(root, "openspec", "agent-harness.json"), JSON.stringify({ notARealKey: true }), "utf8");

    await expect(readGlobalHarnessConfig(root)).rejects.toThrow(/unrecognized top-level key "notARealKey"/);
    await expect(readGlobalHarnessConfig(root)).rejects.toThrow(
      /accepted keys: stepAgents, autonomyLevel, reviewGate, checkpoints, budget, gitStageAllowlist/,
    );
  });

  it("rejects a per-change file with an unrecognized top-level key, naming the key and the accepted set", async () => {
    const root = await temporaryRoot();
    const changeDir = path.join(root, "openspec", "changes", "demo");
    await mkdir(changeDir, { recursive: true });
    await writeFile(path.join(changeDir, "harness.json"), JSON.stringify({ notARealKey: true }), "utf8");

    await expect(readChangeHarnessConfig(root, "demo")).rejects.toThrow(/unrecognized top-level key "notARealKey"/);
    await expect(readChangeHarnessConfig(root, "demo")).rejects.toThrow(
      /accepted keys: stepAgents, autonomyLevel, reviewGate, checkpoints, budget, gitStageAllowlist/,
    );
  });

  it("refuses the exact shape found in this repository's harness-stage-dispatch harness.json — a stage at the top level, no stepAgents wrapper", async () => {
    const root = await temporaryRoot();
    const changeDir = path.join(root, "openspec", "changes", "harness-stage-dispatch");
    await mkdir(changeDir, { recursive: true });
    await writeFile(
      path.join(changeDir, "harness.json"),
      JSON.stringify({ apply: { agent: "claude-cli", dispatch: "vscode-chat" } }),
      "utf8",
    );

    await expect(readChangeHarnessConfig(root, "harness-stage-dispatch")).rejects.toThrow(
      /unrecognized top-level key "apply"/,
    );
    await expect(readChangeHarnessConfig(root, "harness-stage-dispatch")).rejects.toThrow(/"stepAgents\.apply"/);
  });

  it("reports the unknown top-level key, not a downstream complaint, when the rest of the file is otherwise invalid too", async () => {
    const root = await temporaryRoot();
    await mkdir(path.join(root, "openspec"), { recursive: true });
    await writeFile(
      path.join(root, "openspec", "agent-harness.json"),
      JSON.stringify({ stepAgents: { propose: "not-a-real-agent" }, bogusKey: true }),
      "utf8",
    );

    await expect(readGlobalHarnessConfig(root)).rejects.toThrow(/unrecognized top-level key "bogusKey"/);
  });

  it("still migrates and warns a legacy dispatch when it sits inside a correctly-wrapped stepAgents", async () => {
    const root = await temporaryRoot();
    await mkdir(path.join(root, "openspec"), { recursive: true });
    await writeFile(
      path.join(root, "openspec", "agent-harness.json"),
      JSON.stringify({ stepAgents: { apply: { agent: "claude-cli", dispatch: "vscode-chat" } } }),
      "utf8",
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const config = await readGlobalHarnessConfig(root);

    expect(normalizeStepAgent(config.stepAgents.apply!).agent).toBe(VSCODE_CHAT_STEP_AGENT_ID);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("migrated to stepAgents.apply.agent"));
    warnSpy.mockRestore();
  });

  it("still loads every harness.json under openspec/changes/ and the real openspec/agent-harness.json in this repository", async () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const workspaceRoot = path.resolve(here, "..", "..", "..");

    await expect(stat(path.join(workspaceRoot, "openspec", "agent-harness.json"))).resolves.toBeDefined();
    await expect(readGlobalHarnessConfig(workspaceRoot)).resolves.toBeDefined();

    const changesRoot = path.join(workspaceRoot, "openspec", "changes");
    const entries = await readdir(changesRoot, { recursive: true, withFileTypes: true });
    const harnessFiles = entries.filter((entry) => entry.isFile() && entry.name === "harness.json");
    // Confirms the scan itself found real files, not that an empty list
    // vacuously "all loaded" — the same trap tasks.md 2.3 names.
    expect(harnessFiles.length).toBeGreaterThan(0);

    for (const entry of harnessFiles) {
      const changeName = path.relative(changesRoot, entry.parentPath);
      await expect(
        readChangeHarnessConfig(workspaceRoot, changeName),
        `${path.join(entry.parentPath, entry.name)} failed to load`,
      ).resolves.toBeDefined();
    }
  });
});

// openspec/changes/agentic-harness-documentation tasks 6.2/6.3 — the
// reference document is asserted against the real registry and the real
// resolver, not just read by a human, so a new adapter or a broken worked
// example is caught here rather than trusted.
describe("HARNESS.md", () => {
  async function readHarnessMd(): Promise<string> {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const workspaceRoot = path.resolve(here, "..", "..", "..");
    return readFile(path.join(workspaceRoot, "HARNESS.md"), "utf8");
  }

  it("lists every AGENT_REGISTRY id, plus vscode-chat, in its agent reference table", async () => {
    const doc = await readHarnessMd();
    const sectionStart = doc.indexOf("## Agents, models, effort, and spending caps");
    expect(sectionStart, "HARNESS.md's agent reference section header not found").toBeGreaterThanOrEqual(0);
    const nextSection = doc.indexOf("\n## ", sectionStart + 1);
    const section = doc.slice(sectionStart, nextSection === -1 ? undefined : nextSection);

    const documentedIds = new Set(
      [...section.matchAll(/^\| `([a-z0-9-]+)` \|/gm)].map((match) => match[1]),
    );
    // Confirms the table itself was actually found and parsed, not that
    // an empty match set vacuously "contains everything".
    expect(documentedIds.size).toBeGreaterThan(0);

    const expectedIds = [...AGENT_REGISTRY.map((agent) => agent.id), VSCODE_CHAT_STEP_AGENT_ID];
    for (const id of expectedIds) {
      expect(documentedIds.has(id), `HARNESS.md's agent table is missing "${id}"`).toBe(true);
    }
  });

  it("loads both worked harness.json examples through resolveHarnessConfig without error", async () => {
    const doc = await readHarnessMd();
    const sectionStart = doc.indexOf("## Worked examples");
    expect(sectionStart, "HARNESS.md's Worked examples section header not found").toBeGreaterThanOrEqual(0);
    const section = doc.slice(sectionStart);

    const jsonBlocks = [...section.matchAll(/```json\n([\s\S]*?)```/g)].map((match) => match[1]);
    expect(jsonBlocks, "expected exactly the global and per-change worked examples").toHaveLength(2);

    const globalExample = JSON.parse(jsonBlocks[0]!);
    const changeExample = JSON.parse(jsonBlocks[1]!);

    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, globalExample);
    await writeChangeHarnessConfig(root, "harness-md-worked-example", changeExample);

    await expect(resolveHarnessConfig(root, "harness-md-worked-example")).resolves.toBeDefined();
  });
});
