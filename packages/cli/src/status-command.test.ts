import { describe, expect, it } from "vitest";
import type { AgentStatusReadResult, AgentStatusReport, GitWrapper } from "@openspec-ui/core";
import { statusCommand } from "./status-command.js";

function collectingIo() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    stdout: (line: string) => out.push(line),
    stderr: (line: string) => err.push(line),
    // Never a real repository: statusCommand builds a git wrapper before
    // resolving the status directory, and a unit test must not require
    // an actual git checkout at "/repo" just to reach `read`.
    createGit: (() => ({}) as GitWrapper) as (cwd: string) => GitWrapper,
  };
}

const REPORT: AgentStatusReport = {
  instanceId: "an-instance",
  activity: "running apply",
  stage: "apply",
  changeName: "a-change",
  workingDirectory: "/repo/a-change",
  activitySinceMs: 5_000,
  heartbeatAgeMs: 1_000,
  gone: false,
};

describe("statusCommand", () => {
  it("prints every run and exits 0", async () => {
    const io = collectingIo();
    const result: AgentStatusReadResult = { reports: [REPORT], malformed: [] };

    const code = await statusCommand(
      { workspaceRoot: "/repo", format: "text" },
      { ...io, resolveDirectory: async () => "/repo/../.worktrees/repo/.agent-status", read: async () => result },
    );

    expect(code).toBe(0);
    const text = io.out.join("\n");
    expect(text).toContain("an-instance");
    expect(text).toContain("a-change");
    expect(text).toContain("running apply");
  });

  it("exits 0 with nothing running", async () => {
    const io = collectingIo();
    const result: AgentStatusReadResult = { reports: [], malformed: [] };

    const code = await statusCommand(
      { workspaceRoot: "/repo", format: "text" },
      { ...io, resolveDirectory: async () => "/repo/../.worktrees/repo/.agent-status", read: async () => result },
    );

    expect(code).toBe(0);
    expect(io.out.join("\n")).toContain("No runs are reporting themselves.");
  });

  it("reports a gone run and never states a health verdict", async () => {
    const io = collectingIo();
    const result: AgentStatusReadResult = { reports: [{ ...REPORT, gone: true }], malformed: [] };

    const code = await statusCommand(
      { workspaceRoot: "/repo", format: "text" },
      { ...io, resolveDirectory: async () => "/repo/../.worktrees/repo/.agent-status", read: async () => result },
    );

    expect(code).toBe(0);
    const text = io.out.join("\n").toLowerCase();
    expect(text).toContain("gone");
    expect(text).not.toContain("stuck");
    expect(text).not.toContain("hung");
    expect(text).not.toContain("unhealthy");
  });

  it("reports a malformed record to stderr and still succeeds", async () => {
    const io = collectingIo();
    const result: AgentStatusReadResult = {
      reports: [],
      malformed: [{ fileName: "broken.json", reason: "not valid JSON" }],
    };

    const code = await statusCommand(
      { workspaceRoot: "/repo", format: "text" },
      { ...io, resolveDirectory: async () => "/repo/../.worktrees/repo/.agent-status", read: async () => result },
    );

    expect(code).toBe(0);
    expect(io.err.join("\n")).toContain("broken.json");
  });

  it("prints json in the reader's own shape", async () => {
    const io = collectingIo();
    const result: AgentStatusReadResult = { reports: [REPORT], malformed: [] };

    const code = await statusCommand(
      { workspaceRoot: "/repo", format: "json" },
      { ...io, resolveDirectory: async () => "/repo/../.worktrees/repo/.agent-status", read: async () => result },
    );

    expect(code).toBe(0);
    expect(JSON.parse(io.out.join("\n"))).toEqual(result);
  });

  it("exits 2 when the status directory or file cannot be read", async () => {
    const io = collectingIo();

    const code = await statusCommand(
      { workspaceRoot: "/repo", format: "text" },
      {
        ...io,
        resolveDirectory: async () => {
          throw new Error("boom");
        },
      },
    );

    expect(code).toBe(2);
    expect(io.err.join("\n")).toContain("boom");
  });
});
