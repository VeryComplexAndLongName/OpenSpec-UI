import { describe, expect, it, vi } from "vitest";
import type { AgentStatusReport, GitWrapper, MachineKey } from "@openspec-ui/core";
import { stopCommand, type StopDeps } from "./stop-command.js";

// a-run-elsewhere-can-be-asked-to-stop 3.1.

const LIVE: AgentStatusReport = {
  instanceId: "run-b",
  activity: "applying",
  stage: "apply",
  changeName: "alpha",
  workingDirectory: "/wt/repo/b",
  activitySinceMs: 1_000,
  heartbeatAgeMs: 1_000,
  activityAt: "2026-09-14T10:00:00.000Z",
  heartbeatAt: "2026-09-14T10:00:00.000Z",
  gone: false,
  runId: "chain-1",
  task: null,
  waiting: null,
  stopRequested: null,
  signature: "verified",
  machine: "machine-b",
  gitAuthor: null,
};

function collectingDeps(reports: AgentStatusReport[]) {
  const out: string[] = [];
  const err: string[] = [];
  const ask = vi.fn(async () => "message-1");
  const deps: StopDeps = {
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
    createGit: () => ({}) as GitWrapper,
    resolveDirectory: async () => "/wt/repo/.agent-status",
    read: async () => ({ reports, malformed: [] }),
    loadKey: async () => ({ keyId: "k" }) as MachineKey,
    readAuthor: async () => "ada@example.com",
    machine: "machine-a",
    ask,
  };
  return { out, err, ask, deps };
}

describe("stopCommand", () => {
  it("writes a signed request for a live run beside the status directory, and prints its message id", async () => {
    const { out, ask, deps } = collectingDeps([LIVE]);

    const code = await stopCommand({ workspaceRoot: "/repo", instanceId: "run-b", reason: "live check", format: "text" }, deps);

    expect(code).toBe(0);
    expect(out).toEqual(["message-1"]);
    expect(ask).toHaveBeenCalledWith(expect.objectContaining({
      directory: expect.stringMatching(/[\\/]wt[\\/]repo[\\/]\.agent-messages$/u),
      to: "run-b",
      reason: "live check",
      machine: "machine-a",
      gitAuthor: "ada@example.com",
    }));
  });

  it("refuses an instance with no live record, saying so, and writes nothing", async () => {
    const gone = { ...LIVE, instanceId: "run-gone", gone: true };
    const { out, err, ask, deps } = collectingDeps([LIVE, gone]);

    for (const instanceId of ["run-unknown", "run-gone"]) {
      expect(await stopCommand({ workspaceRoot: "/repo", instanceId, reason: "live check", format: "text" }, deps)).toBe(1);
    }

    expect(ask).not.toHaveBeenCalled();
    expect(out).toEqual([]);
    expect(err.join("\n")).toContain("no live run reports itself as run-unknown");
    expect(err.join("\n")).toContain("no live run reports itself as run-gone");
  });

  it("refuses to ask without an instance id or a reason", async () => {
    const { ask, deps } = collectingDeps([LIVE]);

    expect(await stopCommand({ workspaceRoot: "/repo", instanceId: "run-b", reason: "   ", format: "text" }, deps)).toBe(2);
    expect(await stopCommand({ workspaceRoot: "/repo", instanceId: undefined, reason: "live check", format: "text" }, deps)).toBe(2);
    expect(ask).not.toHaveBeenCalled();
  });

  it("prints the message id and the run it asked as json", async () => {
    const { out, deps } = collectingDeps([LIVE]);

    await stopCommand({ workspaceRoot: "/repo", instanceId: "run-b", reason: "live check", format: "json" }, deps);

    expect(JSON.parse(out.join("\n"))).toEqual({ messageId: "message-1", to: "run-b" });
  });
});
