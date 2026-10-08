import { describe, expect, it, vi } from "vitest";
import { taskCommand } from "./task-command.js";
import { runMain } from "./main.js";

// a-card-works-its-own-tasks 3.4: a card's controls from a terminal, under
// core's rules, with the 0/1/2 contract.
function collect() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, deps: { stdout: (line: string) => out.push(line), stderr: (line: string) => err.push(line) } };
}

const item = { lineNumber: 7, text: "6.4 **Human-only**: look", done: false, humanOnly: true as const };

describe("taskCommand", () => {
  it("closes a task with its note, and says it is not committed", async () => {
    const { out, deps } = collect();
    const set = vi.fn(async () => ({ ok: true as const, tasksPath: "/t", line: "- [x] 6.4 **Human-only**: look", noteLine: "  Closed by ada on 2026-10-05: seen" }));
    const code = await taskCommand(
      { repositoryRoot: "/repo", action: "done", changeName: "demo", number: "6.4", note: "seen", format: "text" },
      { ...deps, find: async () => ({ ok: true as const, item }), set },
    );
    expect(code).toBe(0);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ changeName: "demo", lineNumber: 7, expectedText: item.text, done: true, note: "seen" }));
    expect(out.join("\n")).toContain("Not committed");
  });

  it("exits 1 with core's reason on a refusal", async () => {
    const { err, deps } = collect();
    const code = await taskCommand(
      { repositoryRoot: "/repo", action: "done", changeName: "demo", number: "6.4", format: "text" },
      {
        ...deps,
        find: async () => ({ ok: true as const, item }),
        set: async () => ({ ok: false as const, kind: "note-required" as const, reason: "6.4 is Human-only: say what was checked." }),
      },
    );
    expect(code).toBe(1);
    expect(err.join("\n")).toContain("say what was checked");
  });

  it("commits and pushes, and exits 2 for what it cannot attempt", async () => {
    const { out, deps } = collect();
    const commit = vi.fn(async () => ({ ok: true as const, commit: "abcdef1234", branch: "demo", pushedTo: "origin/demo", message: "tasks(demo): ticked 6.4" }));
    expect(await taskCommand({ repositoryRoot: "/repo", action: "commit", changeName: "demo", number: undefined, format: "text" }, { ...deps, commit })).toBe(0);
    expect(out.join("\n")).toContain("pushed to origin/demo");

    expect(await taskCommand({ repositoryRoot: "/repo", action: "tick", changeName: "demo", number: "1", format: "text" }, collect().deps)).toBe(2);
    expect(await taskCommand({ repositoryRoot: "/repo", action: "done", changeName: undefined, number: "1", format: "text" }, collect().deps)).toBe(2);
    expect(await taskCommand({ repositoryRoot: "/repo", action: "done", changeName: "demo", number: undefined, format: "text" }, collect().deps)).toBe(2);
  });

  it("is reached from the command line with its action, change, number and note", async () => {
    const taskCommandSeam = vi.fn(async () => 0);
    const code = await runMain(["complete", "task", "demo", "6.4", "--note", "seen", "--cwd", "/repo"], {
      stdout: () => undefined,
      stderr: () => undefined,
      taskCommand: taskCommandSeam,
    });
    expect(code).toBe(0);
    expect(taskCommandSeam).toHaveBeenCalledWith(
      expect.objectContaining({ repositoryRoot: "/repo", action: "done", changeName: "demo", number: "6.4", note: "seen" }),
      expect.anything(),
    );
  });
});
