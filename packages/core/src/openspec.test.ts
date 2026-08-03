import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

// `openspec` резолвится в `.cmd`-шим на Windows — openspec.ts спавнит его
// через `cross-spawn` (см. комментарий там), не голый `execFile`. Мок
// эмулирует дочерний процесс тем же паттерном, что и agents/shared.test.ts.
class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
}

const spawnMock = vi.fn();
vi.mock("cross-spawn", () => ({
  default: (...args: unknown[]) => spawnMock(...args),
}));

const { listChanges, listSpecs, showChange, validateChange } = await import("./openspec.js");

/** Настраивает `spawnMock` на возврат фейкового процесса, который сразу же
 * (в следующем тике) отдаёт заданный stdout и завершается кодом 0. */
function mockSuccessfulSpawn(stdout: string): void {
  const child = new FakeChildProcess();
  spawnMock.mockReturnValueOnce(child);
  queueMicrotask(() => {
    child.stdout.emit("data", Buffer.from(stdout, "utf8"));
    child.emit("close", 0);
  });
}

const FIXTURES_DIR = path.join(import.meta.dirname, "openspec-fixtures");

async function loadFixture(name: string): Promise<string> {
  return readFile(path.join(FIXTURES_DIR, name), "utf8");
}

describe("openspec CLI wrapper (real CLI fixtures — task 5.3)", () => {
  it("listChanges parses real `openspec list --json` output", async () => {
    mockSuccessfulSpawn(await loadFixture("list.json"));

    const result = await listChanges({ cwd: "C:\\Prog\\OpenSpec-UI" });

    expect(spawnMock).toHaveBeenCalledWith("openspec", ["list", "--json"], {
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
    mockSuccessfulSpawn(await loadFixture("show.json"));

    const result = await showChange("execution-core", { cwd: "C:\\Prog\\OpenSpec-UI" });

    expect(spawnMock).toHaveBeenCalledWith(
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

  it("listSpecs parses real `openspec list --specs --json` output", async () => {
    mockSuccessfulSpawn(await loadFixture("list-specs.json"));

    const result = await listSpecs({ cwd: "C:\\Prog\\DocsAI" });

    expect(spawnMock).toHaveBeenCalledWith("openspec", ["list", "--specs", "--json"], {
      cwd: "C:\\Prog\\DocsAI",
      windowsHide: true,
    });
    expect(result.specs.length).toBeGreaterThan(0);
    const spec = result.specs.find((s) => s.id === "response-verification");
    expect(spec).toBeDefined();
    expect(typeof spec?.requirementCount).toBe("number");
  });

  it("validateChange parses real `openspec validate --json --strict` output", async () => {
    mockSuccessfulSpawn(await loadFixture("validate.json"));

    const result = await validateChange("execution-core", { cwd: "C:\\Prog\\OpenSpec-UI" });

    expect(spawnMock).toHaveBeenCalledWith(
      "openspec",
      ["validate", "execution-core", "--json", "--strict", "--type", "change"],
      { cwd: "C:\\Prog\\OpenSpec-UI", windowsHide: true },
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.valid).toBe(true);
    expect(result.summary.totals.passed).toBe(1);
  });

  it("uses a custom binary path when provided", async () => {
    mockSuccessfulSpawn('{"changes":[],"root":{"path":"x","source":"nearest"}}');
    await listChanges({ cwd: "/repo", binary: "/usr/local/bin/openspec" });
    expect(spawnMock).toHaveBeenCalledWith("/usr/local/bin/openspec", ["list", "--json"], {
      cwd: "/repo",
      windowsHide: true,
    });
  });

  it("rejects when the process exits with a non-zero code", async () => {
    const child = new FakeChildProcess();
    spawnMock.mockReturnValueOnce(child);
    queueMicrotask(() => {
      child.stderr.emit("data", Buffer.from("not an openspec root", "utf8"));
      child.emit("close", 1);
    });

    await expect(listChanges({ cwd: "/repo" })).rejects.toThrow(/exited with code 1/);
  });

  it("rejects when the process itself errors (e.g. binary not found)", async () => {
    const child = new FakeChildProcess();
    spawnMock.mockReturnValueOnce(child);
    queueMicrotask(() => {
      child.emit("error", new Error("ENOENT"));
    });

    await expect(listChanges({ cwd: "/repo" })).rejects.toThrow("ENOENT");
  });
});
