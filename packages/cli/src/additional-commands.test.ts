import { describe, expect, it, vi } from "vitest";
import { runMain } from "./main.js";

const commands = [
  ["show", "changes"], ["show", "agents"], ["show", "tasks", "demo"],
  ["show", "diff", "demo"], ["explain", "change-harness", "demo"],
  ["explain", "message", "OSW-CLI-001"], ["show", "cost", "demo"],
  ["show", "run", "run-1"], ["explain", "change", "demo"],
  ["send", "message", "instance-1", "Hello"], ["run", "task", "demo", "1.2"],
  ["rollback", "change", "demo"],
];

describe("additional command routing", () => {
  it.each(commands.map((argv) => [argv.join(" "), argv]))("routes %s with cwd and format", async (_name, argv) => {
    const handler = vi.fn().mockResolvedValue(0);
    expect(await runMain([...(argv as string[]), "--cwd", "/repo", "--format", "json"], {
      additionalCommand: handler, stdout: vi.fn(), stderr: vi.fn(),
    })).toBe(0);
    expect(handler).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ workspaceRoot: "/repo", format: "json" }),
      (argv as string[]).slice(2), expect.anything());
  });

  it.each(["--yes", "--force", "--autonomous", "--agent"])("does not accept %s as an action override", async (flag) => {
    const handler = vi.fn();
    expect(await runMain(["rollback", "change", "demo", flag, "value"], { additionalCommand: handler, stderr: vi.fn() })).toBe(2);
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects missing subjects without running a command", async () => {
    const handler = vi.fn();
    expect(await runMain(["show", "run"], { additionalCommand: handler, stderr: vi.fn() })).toBe(2);
    expect(handler).not.toHaveBeenCalled();
  });

  it("runs real known-message output with parseable stdout", async () => {
    const stdout = vi.fn();
    expect(await runMain(["explain", "message", "OSW-CLI-001", "--format", "json"], { stdout, stderr: vi.fn() })).toBe(0);
    expect(JSON.parse(stdout.mock.calls[0]![0]).code).toBe("OSW-CLI-001");
  });
});