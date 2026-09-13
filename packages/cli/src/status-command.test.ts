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
    // Nothing to remove, and no filesystem touched, unless a test says so.
    sweep: async () => ({ removedRecords: [], removedTemporaryFiles: [] }),
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
  activityAt: "2026-09-13T12:00:00.000Z",
  heartbeatAt: "2026-09-13T12:00:04.000Z",
  gone: false,
  runId: null,
  task: null,
  waiting: null,
  signature: "unverified",
  machine: null,
  gitAuthor: null,
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

  it("sweeps before it reads, says on stderr what it removed, and leaves stdout as the reading says", async () => {
    const io = collectingIo();
    const calls: string[] = [];

    const code = await statusCommand(
      { workspaceRoot: "/repo", format: "text" },
      {
        ...io,
        resolveDirectory: async () => "/status",
        sweep: async (directory) => {
          calls.push(`sweep ${directory}`);
          return { removedRecords: ["crashed.json"], removedTemporaryFiles: ["crashed.json.0b1f.tmp"] };
        },
        read: async (directory) => {
          calls.push(`read ${directory}`);
          return { reports: [], malformed: [] };
        },
      },
    );

    expect(code).toBe(0);
    expect(calls).toEqual(["sweep /status", "read /status"]);
    expect(io.out).toEqual(["No runs are reporting themselves."]);
    expect(io.err.join(" ")).toContain("removed crashed.json:");
    expect(io.err.join(" ")).toContain("removed crashed.json.0b1f.tmp:");
  });

  it("still answers when the sweep fails", async () => {
    const io = collectingIo();

    const code = await statusCommand(
      { workspaceRoot: "/repo", format: "text" },
      {
        ...io,
        resolveDirectory: async () => "/status",
        sweep: async () => {
          throw new Error("EPERM: operation not permitted");
        },
        read: async () => ({ reports: [REPORT], malformed: [] }),
      },
    );

    expect(code).toBe(0);
    expect(io.out.join(" ")).toContain("an-instance");
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

describe("statusCommand — the task in hand and the wait (a-run-says-which-task-it-is-on)", () => {
  // 5.6
  const ITEMS = [
    { lineNumber: 0, text: "1.1 Write the reader", done: true },
    { lineNumber: 1, text: "1.2 Pair it with the list", done: false },
  ];
  const since = "2026-09-13T12:00:00.000Z";

  async function print(report: typeof REPORT, readTasks = async () => ITEMS) {
    const io = collectingIo();
    const code = await statusCommand(
      { workspaceRoot: "/repo", format: "text" },
      { ...io, resolveDirectory: async () => "/status", read: async () => ({ reports: [report], malformed: [] }), readTasks },
    );
    expect(code).toBe(0);
    return io.out.join("\n");
  }

  it("prints the task a run says it is on, from the change's own list", async () => {
    const text = await print({ ...REPORT, task: { number: "1.2", source: "agent", since } });
    expect(text).toContain("on task 1.2: Pair it with the list, by its own account");
  });

  it("prints the task a run was given as that", async () => {
    const text = await print({ ...REPORT, task: { number: "1.1", source: "command", since } });
    expect(text).toContain("on task 1.1: Write the reader, the task it was given");
  });

  it("prints no task line for a number the list does not have", async () => {
    const text = await print({ ...REPORT, task: { number: "9.9", source: "agent", since } });
    expect(text).not.toContain("on task");
  });

  it("prints no task line where the list cannot be read, and still reports the run", async () => {
    const text = await print({ ...REPORT, task: { number: "1.2", source: "agent", since } }, async () => {
      throw new Error("ENOENT");
    });
    expect(text).not.toContain("on task");
    expect(text).toContain("an-instance");
  });

  it("prints what a run waiting at a checkpoint waits for", async () => {
    const text = await print({ ...REPORT, waiting: { kind: "checkpoint", stage: "apply", nextStage: "verify" } });
    expect(text).toContain("waiting to continue to verify");
  });

  it("prints what a run waiting on a permission waits for", async () => {
    const text = await print({ ...REPORT, waiting: { kind: "permission", description: "Write to src/a.ts" } });
    expect(text).toContain("waiting for a permission: Write to src/a.ts");
  });

  it("carries the run id, the task and the wait in its json exactly as the record holds them", async () => {
    const io = collectingIo();
    const report = {
      ...REPORT,
      runId: "run-42",
      task: { number: "1.2", source: "agent" as const, since },
      waiting: { kind: "permission" as const, description: "Write to src/a.ts" },
    };
    await statusCommand(
      { workspaceRoot: "/repo", format: "json" },
      { ...io, resolveDirectory: async () => "/status", read: async () => ({ reports: [report], malformed: [] }) },
    );
    expect(JSON.parse(io.out.join("\n")).reports[0]).toMatchObject({ runId: "run-42", task: report.task, waiting: report.waiting });
  });
});

describe("statusCommand — whose a run is (a-run-is-signed-by-its-person 5.6)", () => {
  async function print(report: AgentStatusReport, format: "text" | "json" = "text") {
    const io = collectingIo();
    const code = await statusCommand(
      { workspaceRoot: "/repo", format },
      { ...io, resolveDirectory: async () => "/status", read: async () => ({ reports: [report], malformed: [] }) },
    );
    expect(code).toBe(0);
    return io.out.join("\n");
  }

  it("says a run whose record is not verified is not verified", async () => {
    expect(await print(REPORT)).toContain("    not verified");
  });

  it("names the enrolled person of a verified run", async () => {
    const text = await print({ ...REPORT, signature: "verified", person: { keyId: "a".repeat(32), label: "Ada" } });
    expect(text).toContain("    signed by Ada, verified");
  });

  it("prints nothing a record that does not check out says, only its name and that it does not", async () => {
    const text = await print({
      ...REPORT,
      activity: "",
      changeName: null,
      stage: null,
      workingDirectory: "",
      signature: "does-not-check-out",
      signatureProblem: "its signature does not verify over its payload",
    });
    expect(text).toBe("an-instance\n    its signature does not check out");
  });

  it("carries the signature and the person in its json", async () => {
    const person = { keyId: "a".repeat(32), label: "Ada" };
    const json = JSON.parse(await print({ ...REPORT, signature: "verified", person }, "json"));
    expect(json.reports[0]).toMatchObject({ signature: "verified", person });
  });
});
