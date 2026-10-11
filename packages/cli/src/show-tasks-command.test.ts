import { describe, expect, it, vi } from "vitest";
import { showTasksCommand } from "./task-command.js";

describe("showTasksCommand", () => {
  it("preserves source, evidence and the declared delegate in JSON", async () => {
    const result = {
      ok: true as const, changeName: "demo", source: "own-worktree" as const,
      path: "/work/demo", tasksPath: "/work/demo/tasks.md",
      rows: [{ number: "1.2", text: "Verify", lineNumber: 4, done: false,
        closedBy: "named-agent" as const, agent: "copilot-cli", body: "Evidence here" }],
    };
    const stdout = vi.fn();
    expect(await showTasksCommand({ repositoryRoot: "/repo", changeName: "demo", format: "json" },
      { stdout, stderr: vi.fn(), read: vi.fn().mockResolvedValue(result) })).toBe(0);
    expect(JSON.parse(stdout.mock.calls[0]![0])).toEqual(result);
  });

  it("reports a refused task source without inventing an empty list", async () => {
    const stdout = vi.fn();
    const stderr = vi.fn();
    expect(await showTasksCommand({ repositoryRoot: "/repo", changeName: "demo", format: "text" },
      { stdout, stderr, read: vi.fn().mockResolvedValue({ ok: false, reason: "unverified" }) })).toBe(1);
    expect(stdout).not.toHaveBeenCalled();
    expect(stderr.mock.calls[0]![0]).toContain("show tasks refused: unverified");
  });
});