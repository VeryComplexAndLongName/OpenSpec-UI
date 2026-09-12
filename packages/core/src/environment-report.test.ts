import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AGENT_REGISTRY } from "./agents/registry.js";
import { readEnvironmentReport, satisfiesMajorRange, stopsARun } from "./environment-report.js";

// The report must not become a second opinion about anything: agent
// presence, the lease holder and the git identity are all asked of the
// readers that already decide them, and the tests below drive it through
// those seams. What is genuinely this module's is the classification —
// what stops a run and what is only worth knowing — and every test here
// is about that. See a-doctor-says-what-would-stop-a-run.

// every-varying-check-has-a-budget: each test writes one small manifest
// into a temporary directory and reads it back, and every probe is a
// test seam, so nothing here spawns a process. Measured 2026-09-12 at
// 38ms for the whole file; the ceiling is for a loaded machine, not for
// this work.
vi.setConfig({ testTimeout: 15_000 });

let workspaceRoot: string;

const ALL_AGENTS_PRESENT = Object.fromEntries(AGENT_REGISTRY.map((agent) => [agent.id, { detected: true }]));

async function healthyWorkspace(engines: Record<string, string> = { node: ">=22 <23" }): Promise<string> {
  workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "environment-report-"));
  await writeFile(path.join(workspaceRoot, "package.json"), JSON.stringify({ name: "fixture", engines }), "utf8");
  return workspaceRoot;
}

function deps(overrides: Parameters<typeof readEnvironmentReport>[0] extends infer T ? Partial<T> : never = {}) {
  return {
    workspaceRoot,
    detectAgents: async () => ALL_AGENTS_PRESENT,
    detectTool: async () => ({ detected: true, version: "10.9.0" }),
    readLeaseHolder: async () => undefined,
    readAuthor: async () => "somebody@example.com",
    nodeVersion: "v22.11.0",
    ...overrides,
  };
}

afterEach(async () => {
  if (workspaceRoot) await rm(workspaceRoot, { recursive: true, force: true });
});

describe("satisfiesMajorRange", () => {
  it("reads the clause forms this repository pins", () => {
    expect(satisfiesMajorRange("v22.11.0", ">=22 <23")).toBe(true);
    expect(satisfiesMajorRange("v23.0.0", ">=22 <23")).toBe(false);
    expect(satisfiesMajorRange("10.9.0", ">=10 <11")).toBe(true);
  });

  it("answers undefined for a range it cannot read, rather than treating it as satisfied", () => {
    // A partial implementation that guessed "satisfied" here is how a
    // check stops checking without anybody noticing.
    expect(satisfiesMajorRange("v22.11.0", "22.x || 23.x")).toBeUndefined();
    expect(satisfiesMajorRange("not-a-version", ">=22")).toBeUndefined();
  });
});

describe("readEnvironmentReport", () => {
  it("finds nothing on a workspace where everything is present", async () => {
    await healthyWorkspace();
    const report = await readEnvironmentReport(deps());
    expect(report.findings).toEqual([]);
    expect(stopsARun(report)).toBe(false);
  });

  it("reports a runtime outside the pinned range as stopping a run, quoting the range", async () => {
    await healthyWorkspace({ node: ">=22 <23" });
    const report = await readEnvironmentReport(deps({ nodeVersion: "v20.9.0" }));
    const finding = report.findings.find((entry) => entry.id === "runtime-node");
    expect(finding?.severity).toBe("stops-a-run");
    expect(finding?.statement).toContain(">=22 <23");
    expect(finding?.statement).toContain("v20.9.0");
    expect(stopsARun(report)).toBe(true);
  });

  it("reports a missing openspec CLI as stopping a run, with the command that installs it", async () => {
    await healthyWorkspace();
    const report = await readEnvironmentReport(deps({
      detectTool: async (executable: string) => ({ detected: executable !== "openspec" }),
    }));
    const finding = report.findings.find((entry) => entry.id === "openspec-cli");
    expect(finding?.severity).toBe("stops-a-run");
    expect(finding?.remedy).toContain("npm install -g");
  });

  it("covers every agent in the registry, so an agent added later is not silently unreported", async () => {
    await healthyWorkspace();
    const [first, ...rest] = AGENT_REGISTRY;
    const report = await readEnvironmentReport(deps({
      detectAgents: async () => ({
        ...Object.fromEntries(rest.map((agent) => [agent.id, { detected: true }])),
        [first!.id]: { detected: false },
      }),
    }));
    const finding = report.findings.find((entry) => entry.id === "some-agents-missing");
    expect(finding?.severity).toBe("worth-knowing");
    expect(finding?.statement).toContain(first!.id);
  });

  it("reports no agent at all as stopping a run", async () => {
    await healthyWorkspace();
    const report = await readEnvironmentReport(deps({
      detectAgents: async () => Object.fromEntries(AGENT_REGISTRY.map((agent) => [agent.id, { detected: false }])),
    }));
    expect(report.findings.find((entry) => entry.id === "no-agent")?.severity).toBe("stops-a-run");
    expect(stopsARun(report)).toBe(true);
  });

  it("reports a held workspace as worth knowing, never as stopping a run", async () => {
    await healthyWorkspace();
    const report = await readEnvironmentReport(deps({
      readLeaseHolder: async () => ({
        hostKind: "cli" as const,
        hostname: "somewhere",
        pid: 4242,
        heartbeatAgeMs: 3000,
        author: "somebody@example.com",
      }),
    }));
    const finding = report.findings.find((entry) => entry.id === "workspace-held");
    // A busy workspace is not a broken one, and `lease` exits 0 on one.
    expect(finding?.severity).toBe("worth-knowing");
    expect(finding?.statement).toContain("pid 4242");
    expect(finding?.statement).toContain("somebody@example.com");
    expect(stopsARun(report)).toBe(false);
  });

  it("reports an unreadable harness configuration as stopping a run", async () => {
    await healthyWorkspace();
    await writeFile(path.join(workspaceRoot, "openspec", "agent-harness.json"), "{ not json", "utf8")
      .catch(async () => {
        const { mkdir } = await import("node:fs/promises");
        await mkdir(path.join(workspaceRoot, "openspec"), { recursive: true });
        await writeFile(path.join(workspaceRoot, "openspec", "agent-harness.json"), "{ not json", "utf8");
      });
    const report = await readEnvironmentReport(deps());
    expect(report.findings.find((entry) => entry.id === "harness-config")?.severity).toBe("stops-a-run");
  });

  it("reports a missing git identity as worth knowing, with the command that sets one", async () => {
    await healthyWorkspace();
    const report = await readEnvironmentReport(deps({ readAuthor: async () => undefined }));
    const finding = report.findings.find((entry) => entry.id === "git-identity");
    expect(finding?.severity).toBe("worth-knowing");
    expect(finding?.remedy).toContain("git config user.email");
    expect(stopsARun(report)).toBe(false);
  });
});
