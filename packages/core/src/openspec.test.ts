import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";

// `child_process.execFile` имеет собственную [util.promisify.custom]-реализацию,
// возвращающую {stdout, stderr}. Мок должен предоставлять тот же символ, иначе
// generic-promisify резолвится не так, как в реальном Node (см. openspec.ts,
// который делает `promisify(execFile)`).
const execFileAsyncMock = vi.fn();
function fakeExecFile(): void {
  throw new Error("fakeExecFile вызван напрямую, минуя promisify — не ожидается в этих тестах");
}
(fakeExecFile as unknown as Record<symbol, unknown>)[promisify.custom] = execFileAsyncMock;

vi.mock("node:child_process", () => ({ execFile: fakeExecFile }));

const { listChanges, showChange, validateChange } = await import("./openspec.js");

const FIXTURES_DIR = path.join(import.meta.dirname, "openspec-fixtures");

async function loadFixture(name: string): Promise<string> {
  return readFile(path.join(FIXTURES_DIR, name), "utf8");
}

describe("openspec CLI wrapper (real CLI fixtures — task 5.3)", () => {
  it("listChanges parses real `openspec list --json` output", async () => {
    const raw = await loadFixture("list.json");
    execFileAsyncMock.mockResolvedValueOnce({ stdout: raw, stderr: "" });

    const result = await listChanges({ cwd: "C:\\Prog\\OpenSpec-UI" });

    expect(execFileAsyncMock).toHaveBeenCalledWith("openspec", ["list", "--json"], {
      cwd: "C:\\Prog\\OpenSpec-UI",
      windowsHide: true,
    });
    expect(Array.isArray(result.changes)).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);
    const change = result.changes.find((c) => c.name === "execution-core");
    expect(change).toBeDefined();
    expect(typeof change?.totalTasks).toBe("number");
    expect(typeof change?.completedTasks).toBe("number");
    expect(result.root.path).toBe("C:\\Prog\\OpenSpec-UI");
  });

  it("showChange parses real `openspec show --json --type change` output", async () => {
    const raw = await loadFixture("show.json");
    execFileAsyncMock.mockResolvedValueOnce({ stdout: raw, stderr: "" });

    const result = await showChange("execution-core", { cwd: "C:\\Prog\\OpenSpec-UI" });

    expect(execFileAsyncMock).toHaveBeenCalledWith(
      "openspec",
      ["show", "execution-core", "--json", "--type", "change"],
      { cwd: "C:\\Prog\\OpenSpec-UI", windowsHide: true },
    );
    expect(result.id).toBe("execution-core");
    expect(result.deltaCount).toBeGreaterThan(0);
    expect(result.deltas.length).toBe(result.deltaCount);
    expect(result.deltas[0]?.operation).toBe("ADDED");
    expect(result.deltas[0]?.requirement?.scenarios.length).toBeGreaterThan(0);
  });

  it("validateChange parses real `openspec validate --json --strict` output", async () => {
    const raw = await loadFixture("validate.json");
    execFileAsyncMock.mockResolvedValueOnce({ stdout: raw, stderr: "" });

    const result = await validateChange("execution-core", { cwd: "C:\\Prog\\OpenSpec-UI" });

    expect(execFileAsyncMock).toHaveBeenCalledWith(
      "openspec",
      ["validate", "execution-core", "--json", "--strict", "--type", "change"],
      { cwd: "C:\\Prog\\OpenSpec-UI", windowsHide: true },
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.valid).toBe(true);
    expect(result.summary.totals.passed).toBe(1);
  });

  it("uses a custom binary path when provided", async () => {
    execFileAsyncMock.mockResolvedValueOnce({ stdout: '{"changes":[],"root":{"path":"x","source":"nearest"}}', stderr: "" });
    await listChanges({ cwd: "/repo", binary: "/usr/local/bin/openspec" });
    expect(execFileAsyncMock).toHaveBeenCalledWith("/usr/local/bin/openspec", ["list", "--json"], {
      cwd: "/repo",
      windowsHide: true,
    });
  });
});
