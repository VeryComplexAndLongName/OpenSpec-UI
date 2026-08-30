import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_HARNESS_CONFIG,
  GlobalAgentSufficientReviewGateError,
  InvalidHarnessConfigError,
  mergeHarnessConfig,
  readChangeHarnessConfig,
  readGlobalHarnessConfig,
  resolveHarnessConfig,
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
