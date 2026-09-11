import { describe, expect, it, vi } from "vitest";
import { runMain } from "./main.js";
import type { ValidateAllResult } from "./openspec-validate.js";

function collectingIo() {
  const outLines: string[] = [];
  const errLines: string[] = [];
  return {
    stdout: (line: string) => outLines.push(line),
    stderr: (line: string) => errLines.push(line),
    outLines,
    errLines,
  };
}

const okResult: ValidateAllResult = { ok: true, results: [{ id: "a", valid: true, failedItems: 0, totalItems: 2 }] };
const failResult: ValidateAllResult = {
  ok: false,
  results: [{ id: "a", valid: false, failedItems: 1, totalItems: 2 }],
};

describe("runMain", () => {
  it("exits 0 and prints JSON when every change is valid", async () => {
    const io = collectingIo();
    const validateAll = vi.fn().mockResolvedValue(okResult);

    const code = await runMain(["validate"], { validateAll, ...io });

    expect(code).toBe(0);
    expect(JSON.parse(io.outLines[0] as string)).toEqual(okResult);
  });

  it("exits 1 when at least one change is invalid", async () => {
    const io = collectingIo();
    const validateAll = vi.fn().mockResolvedValue(failResult);

    const code = await runMain(["validate"], { validateAll, ...io });

    expect(code).toBe(1);
    expect(JSON.parse(io.outLines[0] as string)).toEqual(failResult);
  });

  it("exits 2 and writes to stderr when the check itself cannot run", async () => {
    const io = collectingIo();
    const validateAll = vi.fn().mockRejectedValue(new Error("openspec CLI not found"));

    const code = await runMain(["validate"], { validateAll, ...io });

    expect(code).toBe(2);
    expect(io.outLines).toHaveLength(0);
    expect(io.errLines[0]).toContain("openspec CLI not found");
  });

  it("exits 2 for an unknown command", async () => {
    const io = collectingIo();

    const code = await runMain(["bogus"], { validateAll: vi.fn(), ...io });

    expect(code).toBe(2);
    expect(io.errLines[0]).toContain("unknown command");
  });

  it("exits 2 when --cwd is missing its value", async () => {
    const io = collectingIo();

    const code = await runMain(["validate", "--cwd"], { validateAll: vi.fn(), ...io });

    expect(code).toBe(2);
    expect(io.errLines[0]).toContain("--cwd requires a value");
  });

  it("passes --cwd through to validateAll", async () => {
    const io = collectingIo();
    const validateAll = vi.fn().mockResolvedValue(okResult);

    await runMain(["validate", "--cwd", "/workspace/repo"], { validateAll, ...io });

    expect(validateAll).toHaveBeenCalledWith("/workspace/repo");
  });

  it("prints a human-readable table with --format text", async () => {
    const io = collectingIo();
    const validateAll = vi.fn().mockResolvedValue(failResult);

    const code = await runMain(["validate", "--format", "text"], { validateAll, ...io });

    expect(code).toBe(1);
    expect(io.outLines[0]).toContain("FAIL  a");
    expect(io.outLines[0]).toContain("failed validation");
  });

  it("rejects an invalid --format value", async () => {
    const io = collectingIo();

    const code = await runMain(["validate", "--format", "xml"], { validateAll: vi.fn(), ...io });

    expect(code).toBe(2);
    expect(io.errLines[0]).toContain("--format must be");
  });

  it("prints usage and exits 0 for --help", async () => {
    const io = collectingIo();

    const code = await runMain(["--help"], { validateAll: vi.fn(), ...io });

    expect(code).toBe(0);
    expect(io.outLines[0]).toContain("Usage:");
    expect(io.outLines[0]).toContain("--cwd");
    expect(io.outLines[0]).toContain("--format");
  });

  it("prints usage and exits 0 for -h", async () => {
    const io = collectingIo();

    const code = await runMain(["-h"], { validateAll: vi.fn(), ...io });

    expect(code).toBe(0);
    expect(io.outLines[0]).toContain("Usage:");
  });

  it("prints usage alongside an unknown-command error", async () => {
    const io = collectingIo();

    const code = await runMain(["bogus"], { validateAll: vi.fn(), ...io });

    expect(code).toBe(2);
    expect(io.errLines[0]).toContain("unknown command");
    expect(io.errLines[1]).toContain("Usage:");
  });
});

describe("runMain — run and check", () => {
  it("passes the change name and the repository root to run", async () => {
    const io = collectingIo();
    const runChange = vi.fn().mockResolvedValue(0);

    const code = await runMain(["run", "a-change", "--cwd", "/repo"], { runChange, ...io });

    expect(code).toBe(0);
    expect(runChange).toHaveBeenCalledWith(
      { workspaceRoot: "/repo", changeName: "a-change", format: "text" },
      expect.anything(),
    );
  });

  it("defaults run to text, unlike validate", async () => {
    // `validate` produces one document at the end, so JSON is the useful
    // default there. A run is watched.
    const io = collectingIo();
    const runChange = vi.fn().mockResolvedValue(0);

    await runMain(["run", "a-change"], { runChange, ...io });

    expect(runChange.mock.calls[0]?.[0]).toMatchObject({ format: "text" });
  });

  it("passes --format json through to run", async () => {
    const io = collectingIo();
    const runChange = vi.fn().mockResolvedValue(0);

    await runMain(["run", "a-change", "--format", "json"], { runChange, ...io });

    expect(runChange.mock.calls[0]?.[0]).toMatchObject({ format: "json" });
  });

  it("returns run's own exit code unchanged", async () => {
    const io = collectingIo();

    expect(await runMain(["run", "a"], { runChange: vi.fn().mockResolvedValue(2), ...io })).toBe(2);
    expect(await runMain(["run", "a"], { runChange: vi.fn().mockResolvedValue(1), ...io })).toBe(1);
  });

  it("exits 2 when run is given no change", async () => {
    const io = collectingIo();
    const runChange = vi.fn();

    const code = await runMain(["run"], { runChange, ...io });

    expect(code).toBe(2);
    expect(runChange).not.toHaveBeenCalled();
    expect(io.errLines[0]).toContain("run requires a change name");
  });

  it("exits 2 when check is given no change", async () => {
    const io = collectingIo();
    const checkChange = vi.fn();

    const code = await runMain(["check"], { checkChange, ...io });

    expect(code).toBe(2);
    expect(checkChange).not.toHaveBeenCalled();
  });

  it("passes the change name to check", async () => {
    const io = collectingIo();
    const checkChange = vi.fn().mockResolvedValue(1);

    const code = await runMain(["check", "a-change", "--cwd", "/repo"], { checkChange, ...io });

    expect(code).toBe(1);
    expect(checkChange).toHaveBeenCalledWith(
      { workspaceRoot: "/repo", changeName: "a-change", format: "text" },
      expect.anything(),
    );
  });

  it("offers no way to answer a checkpoint from the command line", async () => {
    // ADR 0020 decision 3. A flag that answered a configured confirmation
    // would make the CLI the way around the configuration, and the
    // configuration is where consent is kept. This asserts the usage text
    // never grows one.
    const io = collectingIo();

    await runMain(["--help"], { ...io });

    const usage = io.outLines[0] as string;
    for (const flag of ["--yes", "-y", "--autonomous", "--force", "--no-confirm"]) {
      expect(usage).not.toContain(flag);
    }
  });

  it("names run and check among the supported commands", async () => {
    const io = collectingIo();

    await runMain(["bogus"], { ...io });

    expect(io.errLines[0]).toContain("run");
    expect(io.errLines[0]).toContain("check");
  });
});
