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
  GlobalChainStepsError,
  GlobalGitAllowlistError,
  GlobalTaskAgentsError,
  HARNESS_AGENT_CAPABILITIES,
  InvalidHarnessConfigError,
  mergeHarnessConfig,
  STEP_AGENT_KEYS,
  normalizeStepAgent,
  readChangeHarnessConfig,
  readGlobalHarnessConfig,
  resolveHarnessConfig,
  resolveRunWithHarnessTarget,
  TOP_LEVEL_CONFIG_KEYS,
  VSCODE_CHAT_STEP_AGENT_ID,
  writeChangeHarnessConfig,
  writeGlobalHarnessConfig,
  type HarnessConfig,
} from "./harness-config.js";
// The other half of the disagreement this file pins: `templateConfigToWrite`
// merged a stage entry by spread and kept `customAgent`, `mergeStepAgent`
// named three fields and dropped it, so the same entry came out of the two
// differently. See a-stage-override-keeps-its-custom-agent.
import { HARNESS_TEMPLATES, templateConfigToWrite } from "./harness-templates.js";

// suite-survives-a-loaded-machine:
// measured 2026-09-05 for this file alone at 734ms test time (3.91s wall)
// and 1.38s test time (12.28s wall) under deliberate 8-worker CPU co-load.
//
// every-varying-check-has-a-budget, later the same day: measured again as
// part of the whole package under the same co-load rather than alone, and
// the slowest single test reached 8.9s — 1.7x under the ceiling above,
// which is not headroom. Raised.
vi.setConfig({ testTimeout: 30_000 });

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

  it("drops a global stepAgents.git entry, warns naming the file, and honours the rest", async () => {
    const root = await temporaryRoot();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await mkdir(path.join(root, "openspec"), { recursive: true });
    const configPath = path.join(root, "openspec", "agent-harness.json");
    await writeFile(
      configPath,
      JSON.stringify({ stepAgents: { git: "claude-cli", apply: "claude-cli" } }),
      "utf8",
    );

    const config = await readGlobalHarnessConfig(root);

    expect(config.stepAgents).toEqual({ apply: "claude-cli" });
    expect("git" in config.stepAgents).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain(configPath);
    expect(warn.mock.calls[0]?.[0]).toContain("stepAgents.git was dropped");
    warn.mockRestore();
  });

  it("drops both stepAgents.archive and stepAgents.git from one config, warning about each", async () => {
    const root = await temporaryRoot();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await mkdir(path.join(root, "openspec"), { recursive: true });
    const configPath = path.join(root, "openspec", "agent-harness.json");
    await writeFile(
      configPath,
      JSON.stringify({
        stepAgents: { archive: "claude-cli", git: { agent: "claude-cli" }, apply: "claude-cli" },
      }),
      "utf8",
    );

    const config = await readGlobalHarnessConfig(root);

    expect(config.stepAgents).toEqual({ apply: "claude-cli" });
    expect("archive" in config.stepAgents).toBe(false);
    expect("git" in config.stepAgents).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("stepAgents.archive was dropped");
    expect(warn.mock.calls[0]?.[0]).toContain("stepAgents.git was dropped");
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

  it("rejects a freshly-written config that sets stepAgents.git", async () => {
    const root = await temporaryRoot();
    await expect(writeGlobalHarnessConfig(root, { stepAgents: { git: "claude-cli" } as never })).rejects.toThrow(
      /stepAgents\.git is not accepted/,
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

describe("taskAgents (a-delegated-item-runs-its-agent)", () => {
  it("accepts an entry keyed by a task number, in either entry form", async () => {
    const root = await temporaryRoot();
    await writeChangeHarnessConfig(root, "demo", {
      taskAgents: { "5.4": { agent: "copilot-cli", customAgent: "reviewer" }, "6": "claude-cli" },
    });

    const override = await readChangeHarnessConfig(root, "demo");

    expect(override?.taskAgents).toEqual({
      "5.4": { agent: "copilot-cli", customAgent: "reviewer" },
      "6": "claude-cli",
    });
  });

  it("refuses it in the global file, the way autonomyLevel autonomous is refused", async () => {
    // A task number belongs to the change whose tasks.md wrote it, so the
    // same statement made workspace-wide is about a different piece of
    // work in every change.
    const root = await temporaryRoot();

    await expect(writeGlobalHarnessConfig(root, { taskAgents: { "1.1": "copilot-cli" } }))
      .rejects.toThrow(GlobalTaskAgentsError);
  });

  it("refuses a key that is not a task number", async () => {
    const root = await temporaryRoot();

    await expect(writeChangeHarnessConfig(root, "demo", { taskAgents: { "the live check": "copilot-cli" } }))
      .rejects.toThrow(/taskAgents key "the live check" is not a task number/);
  });

  it("applies the same entry rules a stage entry obeys, naming the task", async () => {
    // One validator over both, so the customAgent shape rule cannot come
    // to hold for a stage and not for a task.
    const root = await temporaryRoot();

    await expect(writeChangeHarnessConfig(root, "demo", {
      taskAgents: { "5.4": { agent: "copilot-cli", customAgent: "--dangerous" } },
    })).rejects.toThrow(/taskAgents\."5\.4"\.customAgent "--dangerous" must not begin with "-"/);

    await expect(writeChangeHarnessConfig(root, "demo", { taskAgents: { "5.4": "copilto-cli" } }))
      .rejects.toThrow(/taskAgents\."5\.4" references unknown agent id "copilto-cli"/);

    await expect(writeChangeHarnessConfig(root, "demo", {
      taskAgents: { "5.4": { agent: "gemini-cli", effort: "high" } },
    })).rejects.toThrow(/taskAgents\."5\.4" sets effort/);
  });

  it("refuses vscode-chat, which cannot run one task", async () => {
    // A delegated item's run spawns a CLI through `createAgentRunner`;
    // handing a numbered task to the editor's chat is not something
    // anything here can do, so accepting it would write a setting
    // nothing reads.
    const root = await temporaryRoot();

    await expect(writeChangeHarnessConfig(root, "demo", { taskAgents: { "5.4": VSCODE_CHAT_STEP_AGENT_ID } }))
      .rejects.toThrow(/taskAgents\."5\.4" selects agent "vscode-chat", which cannot run one task/);
  });

  it("survives the merge with a global file that has none", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { stepAgents: { apply: "claude-cli" } });
    await writeChangeHarnessConfig(root, "demo", { taskAgents: { "2.1": "copilot-cli" } });

    const config = await resolveHarnessConfig(root, "demo");

    expect(config.taskAgents).toEqual({ "2.1": "copilot-cli" });
    expect(config.stepAgents).toEqual({ apply: "claude-cli" });
  });
});

describe("every accepted key survives a round trip (config-keys-survive-a-round-trip)", () => {
  /** A representative value per accepted top-level key.
   *
   * Its own keys are asserted against `TOP_LEVEL_CONFIG_KEYS` below,
   * before anything is written. Without that this table rots in one
   * specific way: someone adds a key to the product, does not add a
   * sample, and the loop quietly tests one key fewer — the newest key,
   * which is the one at risk. */
  const SAMPLES: Record<(typeof TOP_LEVEL_CONFIG_KEYS)[number], unknown> = {
    stepAgents: { apply: "claude-cli-acp" },
    autonomyLevel: "semi-autonomous",
    reviewGate: { mode: "human-required" },
    checkpoints: { requireConfirmationBetweenSteps: true },
    budget: { maxCostUsd: 12 },
    timeout: { maxRunSeconds: 900, maxStageSeconds: 300 },
    maxStageAttempts: 3,
    gitStageAllowlist: { remotes: ["origin"], branches: ["main"] },
    taskAgents: { "5.4": { agent: "copilot-cli", customAgent: "reviewer" } },
    steps: [{ step: "await-change", before: "verify", param: "the-other-change", maxWaitSeconds: 600 }],
    hints: { enabled: false },
  };

  it("has a sample for every accepted key, and no others", () => {
    // Asserted first, so a key added without a sample fails here and
    // names itself rather than being silently skipped below.
    expect(Object.keys(SAMPLES).sort()).toEqual([...TOP_LEVEL_CONFIG_KEYS].sort());
  });

  for (const key of TOP_LEVEL_CONFIG_KEYS) {
    // `gitStageAllowlist`, `checkpoints`, `taskAgents` and `steps` are
    // per-change only; a global file setting any of them is refused, so
    // those are exercised through the per-change path alone.
    const PER_CHANGE_ONLY = ["gitStageAllowlist", "checkpoints", "taskAgents", "steps"];
    const globalAccepts = !PER_CHANGE_ONLY.includes(key);

    if (globalAccepts) {
      it(`carries "${key}" back out of the global file`, async () => {
        const root = await temporaryRoot();
        await writeGlobalHarnessConfig(root, { [key]: SAMPLES[key] } as Partial<HarnessConfig>);

        const config = await readGlobalHarnessConfig(root);

        expect(config[key]).toEqual(SAMPLES[key]);
      });
    }

    it(`carries "${key}" through a per-change merge`, async () => {
      // The merged config is what a chain actually reads, and
      // `mergeHarnessConfig` names its fields one by one too — a guard
      // over the global reader alone proves nothing about this one.
      const root = await temporaryRoot();
      await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
      await writeChangeHarnessConfig(root, "demo", { [key]: SAMPLES[key] } as Partial<HarnessConfig>);

      const config = await resolveHarnessConfig(root, "demo");

      expect(config[key]).toEqual(SAMPLES[key]);
    });
  }
});

describe("time limits and attempts (run-has-a-time-limit)", () => {
  it("round-trips timeout and maxStageAttempts through the global file", async () => {
    // The regression this test exists for: both fields passed validation
    // and were then dropped by the global reader, which builds its result
    // field by field. The file said one thing and the resolved config
    // another, so the ceiling appeared to do nothing at all.
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      timeout: { maxRunSeconds: 600, maxStageSeconds: 120 },
      maxStageAttempts: 3,
    });

    const config = await readGlobalHarnessConfig(root);

    expect(config.timeout).toEqual({ maxRunSeconds: 600, maxStageSeconds: 120 });
    expect(config.maxStageAttempts).toBe(3);
  });

  it("lets a per-change file set a ceiling the global file does not", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    await writeChangeHarnessConfig(root, "demo", { timeout: { maxStageSeconds: 30 } });

    const config = await resolveHarnessConfig(root, "demo");

    expect(config.timeout).toEqual({ maxStageSeconds: 30 });
  });

  it("refuses a stage ceiling that exceeds the run ceiling, because it could never fire", async () => {
    const root = await temporaryRoot();

    await expect(writeGlobalHarnessConfig(root, {
      timeout: { maxRunSeconds: 60, maxStageSeconds: 120 },
    })).rejects.toThrow(/maxStageSeconds \(120\) must not exceed timeout.maxRunSeconds \(60\)/);
  });

  it("refuses a non-positive or fractional number of seconds where the config resolves", async () => {
    const root = await temporaryRoot();

    await expect(writeGlobalHarnessConfig(root, { timeout: { maxRunSeconds: 0 } }))
      .rejects.toThrow(/maxRunSeconds must be a positive integer/);
    await expect(writeGlobalHarnessConfig(root, { timeout: { maxStageSeconds: 1.5 } }))
      .rejects.toThrow(/maxStageSeconds must be a positive integer/);
    await expect(writeGlobalHarnessConfig(root, { maxStageAttempts: 0 }))
      .rejects.toThrow(/maxStageAttempts must be a positive integer/);
  });

  it("leaves a config that sets neither field unbounded, as every config written before them means", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });

    const config = await readGlobalHarnessConfig(root);

    expect(config.timeout).toBeUndefined();
    expect(config.maxStageAttempts).toBeUndefined();
  });
});

describe("top-level key validation (harness-config-top-level-keys)", () => {
  it("rejects a global file with an unrecognized top-level key, naming the key and the accepted set", async () => {
    const root = await temporaryRoot();
    await mkdir(path.join(root, "openspec"), { recursive: true });
    await writeFile(path.join(root, "openspec", "agent-harness.json"), JSON.stringify({ notARealKey: true }), "utf8");

    await expect(readGlobalHarnessConfig(root)).rejects.toThrow(/unrecognized top-level key "notARealKey"/);
    await expect(readGlobalHarnessConfig(root)).rejects.toThrow(
      /accepted keys: stepAgents, autonomyLevel, reviewGate, checkpoints, budget, timeout, maxStageAttempts, gitStageAllowlist/,
    );
  });

  it("rejects a per-change file with an unrecognized top-level key, naming the key and the accepted set", async () => {
    const root = await temporaryRoot();
    const changeDir = path.join(root, "openspec", "changes", "demo");
    await mkdir(changeDir, { recursive: true });
    await writeFile(path.join(changeDir, "harness.json"), JSON.stringify({ notARealKey: true }), "utf8");

    await expect(readChangeHarnessConfig(root, "demo")).rejects.toThrow(/unrecognized top-level key "notARealKey"/);
    await expect(readChangeHarnessConfig(root, "demo")).rejects.toThrow(
      /accepted keys: stepAgents, autonomyLevel, reviewGate, checkpoints, budget, timeout, maxStageAttempts, gitStageAllowlist/,
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
      // A change name is one path segment, and an archived change is
      // named by its location rather than by an `archive/` smuggled
      // into the name — which is what this loop used to do, and what
      // a-name-is-checked-before-it-is-used closed off.
      const relative = path.relative(changesRoot, entry.parentPath).split(path.sep);
      const archived = relative[0] === "archive";
      const changeName = relative[relative.length - 1]!;
      await expect(
        readChangeHarnessConfig(workspaceRoot, changeName, archived ? "archive" : "active"),
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

    // `\r?\n`, not `\n`: HARNESS.md is checked out with CRLF endings on
    // Windows (500 pairs, no bare LF), so an LF-only fence pattern matches
    // nothing there while matching both blocks on CI's Linux runner. That
    // combination is the worst one — green in CI, red on the machine of
    // whoever is editing the document — and it is what this assertion was
    // doing before the `\r?` was added.
    const jsonBlocks = [...section.matchAll(/```json\r?\n([\s\S]*?)```/g)].map((match) => match[1]);
    expect(jsonBlocks, "expected exactly the global and per-change worked examples").toHaveLength(2);

    const globalExample = JSON.parse(jsonBlocks[0]!);
    const changeExample = JSON.parse(jsonBlocks[1]!);

    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, globalExample);
    await writeChangeHarnessConfig(root, "harness-md-worked-example", changeExample);

    await expect(resolveHarnessConfig(root, "harness-md-worked-example")).resolves.toBeDefined();
  });
});

describe("mergeHarnessConfig — a stage override keeps what it does not name", () => {
  // stage-override-keeps-the-rest. The base file is the default and a
  // change states its differences. Until this, a stage entry was replaced
  // outright, so "run this stage at higher effort" also meant "and forget
  // which model I chose" — which is what discarded the model this
  // repository sets for every one of its stages.

  const base = (): HarnessConfig => ({
    stepAgents: {
      propose: { agent: "claude-cli-acp", model: "claude-opus-5", effort: "high" },
      apply: { agent: "claude-cli-acp", model: "claude-sonnet-5", effort: "medium" },
      verify: "claude-cli-acp",
    },
    autonomyLevel: "assisted",
    reviewGate: { mode: "human-required" },
  });

  it("keeps the base's model when the change names only an effort", () => {
    const merged = mergeHarnessConfig(base(), {
      stepAgents: { apply: { agent: "claude-cli-acp", effort: "max" } },
    });

    expect(merged.stepAgents.apply).toEqual({
      agent: "claude-cli-acp",
      model: "claude-sonnet-5",
      effort: "max",
    });
  });

  it("keeps the base's model and effort behind a bare-string override", () => {
    // The common case, and the one that lost a model: a named
    // configuration writing just the agent for a stage.
    const merged = mergeHarnessConfig(base(), { stepAgents: { propose: "claude-cli-acp" } });

    expect(merged.stepAgents.propose).toEqual({
      agent: "claude-cli-acp",
      model: "claude-opus-5",
      effort: "high",
    });
  });

  it("inherits nothing when the change names a different agent", () => {
    // A stage's model, effort and budget belong to its agent: effort
    // vocabularies differ between agents, and a budget is denominated in
    // whichever unit its agent reports. Carrying them across builds a
    // configuration its author never wrote.
    const merged = mergeHarnessConfig(base(), {
      stepAgents: { apply: { agent: "copilot-cli-acp", effort: "minimal" } },
    });

    expect(merged.stepAgents.apply).toEqual({ agent: "copilot-cli-acp", effort: "minimal" });
  });

  it("leaves a stage the change does not mention alone", () => {
    const merged = mergeHarnessConfig(base(), { stepAgents: { apply: "claude-cli-acp" } });

    expect(merged.stepAgents.propose).toEqual({
      agent: "claude-cli-acp",
      model: "claude-opus-5",
      effort: "high",
    });
  });

  it("adds a stage the base does not set", () => {
    const merged = mergeHarnessConfig(base(), {
      stepAgents: { review: { agent: "claude-cli-acp", effort: "low" } },
    });

    expect(merged.stepAgents.review).toEqual({ agent: "claude-cli-acp", effort: "low" });
  });

  it("writes back a bare string when nothing but the agent survives", () => {
    // A resolved config should not be gratuitously different in shape
    // from the files it was built from.
    const merged = mergeHarnessConfig(base(), { stepAgents: { verify: "claude-cli-acp" } });

    expect(merged.stepAgents.verify).toBe("claude-cli-acp");
  });

  it("keeps a base budget behind an override that names only an effort", () => {
    const withBudget: HarnessConfig = {
      ...base(),
      stepAgents: { apply: { agent: "claude-cli-acp", budget: { maxCostUsd: 4 } } },
    };

    const merged = mergeHarnessConfig(withBudget, {
      stepAgents: { apply: { agent: "claude-cli-acp", effort: "max" } },
    });

    expect(merged.stepAgents.apply).toEqual({
      agent: "claude-cli-acp",
      effort: "max",
      budget: { maxCostUsd: 4 },
    });
  });
});

describe("mergeHarnessConfig — the merge carries every field the entry may carry", () => {
  // a-stage-override-keeps-its-custom-agent. The merge named model,
  // effort and budget. `customAgent` was added to the entry, to the
  // validator's accepted-key list and to every adapter, and not here —
  // so a change naming the same agent plus a custom agent resolved
  // without it and the chain ran with no `--agent` flag, silently. The
  // merge now iterates `STEP_AGENT_KEYS`, so the fifth field arrives
  // already merged.

  const base = (): HarnessConfig => ({
    stepAgents: { apply: { agent: "claude-cli", model: "claude-opus-5", effort: "high" } },
    autonomyLevel: "assisted",
    reviewGate: { mode: "human-required" },
  });

  it("takes a custom agent the change names over a base that names none", () => {
    const merged = mergeHarnessConfig(base(), {
      stepAgents: { apply: { agent: "claude-cli", customAgent: "reviewer" } },
    });

    expect(merged.stepAgents.apply).toEqual({
      agent: "claude-cli",
      model: "claude-opus-5",
      effort: "high",
      customAgent: "reviewer",
    });
  });

  it("keeps a base custom agent behind an override that names only an effort", () => {
    const withCustomAgent: HarnessConfig = {
      ...base(),
      stepAgents: { apply: { agent: "claude-cli", customAgent: "reviewer" } },
    };

    const merged = mergeHarnessConfig(withCustomAgent, {
      stepAgents: { apply: { agent: "claude-cli", effort: "max" } },
    });

    expect(merged.stepAgents.apply).toEqual({
      agent: "claude-cli",
      effort: "max",
      customAgent: "reviewer",
    });
  });

  it("lets the change's custom agent win over the base's for the same agent", () => {
    const withCustomAgent: HarnessConfig = {
      ...base(),
      stepAgents: { apply: { agent: "claude-cli", customAgent: "reviewer" } },
    };

    const merged = mergeHarnessConfig(withCustomAgent, {
      stepAgents: { apply: { agent: "claude-cli", customAgent: "shipper" } },
    });

    expect(normalizeStepAgent(merged.stepAgents.apply!).customAgent).toBe("shipper");
  });

  it("inherits no custom agent when the change names a different agent", () => {
    // A custom agent is a definition one CLI reads: `claude` looks in
    // `.claude/agents`, `copilot` in `.github/agents`. Carrying a name
    // across a change of agent points at a file the new CLI has never
    // heard of.
    const withCustomAgent: HarnessConfig = {
      ...base(),
      stepAgents: { apply: { agent: "claude-cli", customAgent: "reviewer" } },
    };

    const merged = mergeHarnessConfig(withCustomAgent, {
      stepAgents: { apply: { agent: "copilot-cli", effort: "high" } },
    });

    expect(merged.stepAgents.apply).toEqual({ agent: "copilot-cli", effort: "high" });
  });

  it("carries every field of the entry, asserted over STEP_AGENT_KEYS", () => {
    // Naming the fields is what let `customAgent` be forgotten. The
    // list is the thing to assert on, so the sixth field added to an
    // entry fails here rather than being dropped in silence.
    const everyField = {
      agent: "claude-cli",
      model: "claude-opus-5",
      effort: "max",
      budget: { maxCostUsd: 4 },
      customAgent: "reviewer",
    } as const;
    const full: HarnessConfig = { ...base(), stepAgents: { apply: { ...everyField } } };

    // An override naming the agent alone inherits all of it.
    const merged = mergeHarnessConfig(full, { stepAgents: { apply: "claude-cli" } });

    for (const key of STEP_AGENT_KEYS) {
      expect(merged.stepAgents.apply).toHaveProperty(key, everyField[key]);
    }
  });

  it("agrees with templateConfigToWrite, which merges the same entry by spread", () => {
    // The two disagreed: the spread kept `customAgent` and the merge
    // dropped it, so what a named configuration wrote and what the
    // configuration then resolved to were not the same entry.
    const entry = { agent: "claude-cli", model: "claude-opus-5", customAgent: "reviewer" } as const;
    const merged = mergeHarnessConfig(
      { ...base(), stepAgents: { apply: { ...entry } } },
      { stepAgents: { apply: { agent: "claude-cli", effort: "low" } } },
    );
    const written = templateConfigToWrite(
      HARNESS_TEMPLATES.find((template) => template.effortLevel === "lowest")!,
      { apply: { ...entry } },
      { stepAgents: { apply: { ...entry } } },
    );

    expect(written.stepAgents?.apply).toEqual({ ...entry, effort: "low" });
    expect(merged.stepAgents.apply).toEqual(written.stepAgents?.apply);
  });
});

describe("a stage's custom agent", () => {
  // custom-agents-are-visible. Refused rather than dropped: a setting an
  // adapter cannot pass is one nothing reads, which is the defect this
  // repository has spent several changes removing.

  it("is accepted for an agent whose CLI takes one", async () => {
    const cwd = await temporaryRoot();
    await writeGlobalHarnessConfig(cwd, {
      stepAgents: { apply: { agent: "claude-cli-acp", customAgent: "reviewer" } },
    });

    const resolved = await resolveHarnessConfig(cwd);
    expect(resolved.stepAgents.apply).toEqual({ agent: "claude-cli-acp", customAgent: "reviewer" });
  });

  it("is refused for an agent whose CLI takes none", async () => {
    const cwd = await temporaryRoot();

    await expect(writeGlobalHarnessConfig(cwd, {
      stepAgents: { apply: { agent: "gemini-cli", customAgent: "reviewer" } as never },
    })).rejects.toThrow(/does not accept one/u);
  });

  it("is refused when it would reach nothing at all", async () => {
    const cwd = await temporaryRoot();

    await expect(writeGlobalHarnessConfig(cwd, {
      stepAgents: { apply: { agent: "vscode-chat", customAgent: "reviewer" } as never },
    })).rejects.toThrow(/cannot reach anything/u);
  });

  it("is refused when empty", async () => {
    const cwd = await temporaryRoot();

    await expect(writeGlobalHarnessConfig(cwd, {
      stepAgents: { apply: { agent: "claude-cli-acp", customAgent: "  " } as never },
    })).rejects.toThrow(/non-empty string/u);
  });

  it("is one of the entry's accepted keys, asserted over the list", () => {
    // Spelling the keys out here is how the next one added to the entry
    // gets forgotten. The list is the thing to assert on.
    expect(STEP_AGENT_KEYS).toContain("customAgent");
  });

  it("is refused when it begins with a dash, so it cannot be read as a second flag", async () => {
    // a-name-is-checked-before-it-is-used, tasks 3.1/4.4. A change's
    // `harness.json` is repository content and the value is pushed to
    // argv as `--agent <value>`; whether the CLI reads
    // `--dangerously-skip-permissions` as a value or as a flag is not a
    // question this repository's security model leaves to the CLI.
    const cwd = await temporaryRoot();

    await expect(writeGlobalHarnessConfig(cwd, {
      stepAgents: { apply: { agent: "claude-cli-acp", customAgent: "--dangerously-skip-permissions" } as never },
    })).rejects.toThrow(/must not begin with "-"/u);
  });

  it("accepts every character a model id may carry, since it is the same rule", async () => {
    const cwd = await temporaryRoot();

    await writeGlobalHarnessConfig(cwd, {
      stepAgents: { apply: { agent: "claude-cli-acp", customAgent: "review-2.0_beta:1" } as never },
    });

    expect(normalizeStepAgent((await readGlobalHarnessConfig(cwd)).stepAgents.apply!).customAgent)
      .toBe("review-2.0_beta:1");
  });
});

describe("a change name that would leave the workspace", () => {
  // a-name-is-checked-before-it-is-used, tasks 1.1/4.1. The name
  // arrives from a REST body or a webview message and used to reach
  // `path.join` unread, so `../../..` wrote a `harness.json` wherever it
  // pointed. The contents were always constrained; the location was not.
  const TRAVERSAL = path.join("..", "..", "..", "escaped");

  it("is refused by writeChangeHarnessConfig, and writes nothing anywhere", async () => {
    const root = await temporaryRoot();
    const workspace = path.join(root, "workspace");
    await mkdir(workspace, { recursive: true });

    await expect(writeChangeHarnessConfig(workspace, TRAVERSAL, { autonomyLevel: "assisted" }))
      .rejects.toThrow(/Invalid OpenSpec change name/u);

    // Not "the workspace is unchanged" but "nothing was written at all":
    // the whole point of the traversal is that it lands outside.
    await expect(readdir(root)).resolves.toEqual(["workspace"]);
    await expect(readdir(workspace)).resolves.toEqual([]);
  });

  it("is refused by readChangeHarnessConfig rather than read from outside", async () => {
    const root = await temporaryRoot();
    const workspace = path.join(root, "workspace");
    await mkdir(workspace, { recursive: true });

    await expect(readChangeHarnessConfig(workspace, TRAVERSAL)).rejects.toThrow(/Invalid OpenSpec change name/u);
  });

  it("names the rule it broke, not just the name", async () => {
    const root = await temporaryRoot();

    await expect(readChangeHarnessConfig(root, "../../etc"))
      .rejects.toThrow(/may then contain only lowercase letters, digits/u);
  });

  it("is refused for an archived change too, where the location is named separately", async () => {
    const root = await temporaryRoot();

    await expect(readChangeHarnessConfig(root, TRAVERSAL, "archive"))
      .rejects.toThrow(/Invalid OpenSpec change name/u);
  });
});

describe("declared steps (a-change-can-declare-a-step)", () => {
  const valid = { step: "await-change", before: "verify", param: "the-other-change" };

  it("accepts a declaration and carries it back out", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    await writeChangeHarnessConfig(root, "demo", { steps: [valid] } as never);

    const config = await resolveHarnessConfig(root, "demo");

    expect(config.steps).toEqual([valid]);
  });

  it("refuses steps in the global file, distinctly", async () => {
    const root = await temporaryRoot();

    // A global "wait for change X before verifying" is a statement about
    // every change that will ever exist, X included — which would then
    // wait for itself forever.
    await expect(writeGlobalHarnessConfig(root, { steps: [valid] } as never))
      .rejects.toThrow(GlobalChainStepsError);
  });

  it("refuses a step the registry does not have, listing the ones it does", async () => {
    const root = await temporaryRoot();

    await expect(writeChangeHarnessConfig(root, "demo", {
      steps: [{ step: "await-pull-request", before: "verify", param: "x" }],
    } as never)).rejects.toThrow(/is not a declared step.*await-change/s);
  });

  it("refuses a declaration that states both positions", async () => {
    const root = await temporaryRoot();

    // Guessing which one the author meant produces a chain nobody
    // described.
    await expect(writeChangeHarnessConfig(root, "demo", {
      steps: [{ step: "await-change", before: "verify", after: "apply", param: "x" }],
    } as never)).rejects.toThrow(/exactly one of "before" or "after", not both/);
  });

  it("refuses a declaration that states neither position", async () => {
    const root = await temporaryRoot();

    await expect(writeChangeHarnessConfig(root, "demo", {
      steps: [{ step: "await-change", param: "x" }],
    } as never)).rejects.toThrow(/exactly one of "before" or "after".*states neither/);
  });

  it("refuses a position that is not a fixed stage", async () => {
    const root = await temporaryRoot();

    // A step is placed against the shared sequence, never against
    // another declared step — otherwise two declarations could depend on
    // each other's order.
    await expect(writeChangeHarnessConfig(root, "demo", {
      steps: [{ step: "await-change", before: "await-change", param: "x" }],
    } as never)).rejects.toThrow(/must name a stage/);
  });

  it("refuses a step that is missing the parameter it needs", async () => {
    const root = await temporaryRoot();

    await expect(writeChangeHarnessConfig(root, "demo", {
      steps: [{ step: "await-change", before: "verify" }],
    } as never)).rejects.toThrow(/param is required for step "await-change"/);
  });

  it("refuses an unrecognized key inside a declaration", async () => {
    const root = await temporaryRoot();

    await expect(writeChangeHarnessConfig(root, "demo", {
      steps: [{ ...valid, untilMerged: true }],
    } as never)).rejects.toThrow(/unrecognized key "untilMerged" in steps\[0\]/);
  });

  it("refuses a wait whose ceiling is not a positive number of seconds", async () => {
    const root = await temporaryRoot();

    await expect(writeChangeHarnessConfig(root, "demo", {
      steps: [{ ...valid, maxWaitSeconds: 0 }],
    } as never)).rejects.toThrow(/maxWaitSeconds must be a positive number/);
  });

  it("names the entry's index, so a file with several is actionable", async () => {
    const root = await temporaryRoot();

    await expect(writeChangeHarnessConfig(root, "demo", {
      steps: [valid, { step: "await-change", before: "apply" }],
    } as never)).rejects.toThrow(/steps\[1\]/);
  });
});
