import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_HARNESS_CONFIG,
  GlobalAgentSufficientReviewGateError,
  GlobalAutonomousAutonomyLevelError,
  GlobalCheckpointsDisabledError,
  InvalidHarnessConfigError,
  mergeHarnessConfig,
  normalizeStepAgent,
  readChangeHarnessConfig,
  readGlobalHarnessConfig,
  resolveHarnessConfig,
  resolveRunWithHarnessTarget,
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
    expect(normalizeStepAgent(config.stepAgents.apply!)).toEqual({ agent: "claude-cli", model: "claude-haiku-4-5" });
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
    expect(normalizeStepAgent(resolved.stepAgents.apply!)).toEqual({ agent: "claude-cli", model: "cheap-model" });
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
