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
