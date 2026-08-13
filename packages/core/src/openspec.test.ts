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

const {
  OpenSpecCliCompatibilityError,
  archiveChange,
  createChange,
  initOpenSpec,
  listChanges,
  listSpecs,
  showChange,
  statusChange,
  validateChange,
} = await import("./openspec.js");

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

  it("statusChange parses real `openspec status --change --json` output", async () => {
    mockSuccessfulSpawn(await loadFixture("status.json"));

    const result = await statusChange("command-output-hub", { cwd: "C:\\Prog\\OpenSpec-UI" });

    expect(spawnMock).toHaveBeenCalledWith(
      "openspec",
      ["status", "--change", "command-output-hub", "--json"],
      { cwd: "C:\\Prog\\OpenSpec-UI", windowsHide: true },
    );
    expect(result.changeName).toBe("command-output-hub");
    expect(result.progress.total).toBeGreaterThan(0);
    expect(result.artifacts.length).toBeGreaterThan(0);
  });

  it("normalizes current status output without progress from artifact completion", async () => {
    mockSuccessfulSpawn(JSON.stringify({
      changeName: "current-contract",
      schemaName: "spec-driven",
      artifacts: [
        { id: "proposal", outputPath: "proposal.md", status: "done", requires: [] },
        { id: "tasks", outputPath: "tasks.md", status: "blocked", requires: ["proposal"] },
      ],
      root: { path: "/repo", source: "nearest" },
      additiveField: true,
    }));

    const result = await statusChange("current-contract", { cwd: "/repo" });

    expect(result.progress).toEqual({ total: 2, complete: 1, remaining: 1 });
    expect(result.additiveField).toBe(true);
  });

  it("createChange calls `openspec new change --json` with optional metadata", async () => {
    mockSuccessfulSpawn('{"ok":true}');

    await createChange(
      "new-editor-change",
      { cwd: "C:\\Prog\\OpenSpec-UI" },
      { description: "Create editor MVP", goal: "Improve authoring" },
    );

    expect(spawnMock).toHaveBeenCalledWith(
      "openspec",
      [
        "new",
        "change",
        "new-editor-change",
        "--json",
        "--description",
        "Create editor MVP",
        "--goal",
        "Improve authoring",
      ],
      { cwd: "C:\\Prog\\OpenSpec-UI", windowsHide: true },
    );
  });

  it("archiveChange calls deterministic non-interactive archive", async () => {
    mockSuccessfulSpawn('{"ok":true}');

    await archiveChange("completed-change", { cwd: "C:\\Prog\\OpenSpec-UI" }, { skipSpecs: true });

    expect(spawnMock).toHaveBeenCalledWith(
      "openspec",
      ["archive", "completed-change", "--yes", "--json", "--skip-specs"],
      { cwd: "C:\\Prog\\OpenSpec-UI", windowsHide: true },
    );
  });

  it("initOpenSpec calls `openspec init --tools` with selected tools", async () => {
    mockSuccessfulSpawn("initialized");

    await initOpenSpec(
      { cwd: "C:\\Prog\\OpenSpec-UI" },
      { tools: ["github-copilot", "codex", "cline"] },
    );

    expect(spawnMock).toHaveBeenCalledWith(
      "openspec",
      ["init", "--tools", "github-copilot,codex,cline"],
      { cwd: "C:\\Prog\\OpenSpec-UI", windowsHide: true },
    );
  });

  it("initOpenSpec rejects when no tools are provided", async () => {
    await expect(initOpenSpec({ cwd: "/repo" }, { tools: [] })).rejects.toThrow(
      "initOpenSpec requires at least one tool",
    );
  });

  it("uses a custom binary path when provided", async () => {
    mockSuccessfulSpawn('{"changes":[],"root":{"path":"x","source":"nearest"}}');
    await listChanges({ cwd: "/repo", binary: "/usr/local/bin/openspec" });
    expect(spawnMock).toHaveBeenCalledWith("/usr/local/bin/openspec", ["list", "--json"], {
      cwd: "/repo",
      windowsHide: true,
    });
  });

  it("rejects valid JSON with an incompatible command shape", async () => {
    mockSuccessfulSpawn('{"changes":"not-an-array","root":{"path":"x","source":"nearest"}}');

    const error = await listChanges({ cwd: "/repo" }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(OpenSpecCliCompatibilityError);
    expect(error).toMatchObject({
      code: "incompatible-output",
      command: "list --json",
      expectedContract: "changes[] and root",
    });
  });

  it("rejects malformed JSON with a bounded output preview", async () => {
    mockSuccessfulSpawn(`not-json-${"x".repeat(800)}`);

    const error = await listChanges({ cwd: "/repo" }).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: "invalid-json", command: "list --json" });
    if (!(error instanceof OpenSpecCliCompatibilityError)) throw new Error("Expected compatibility error");
    expect(error.outputPreview.length).toBeLessThanOrEqual(512);
  });

  it("accepts compatible output with additive unknown fields", async () => {
    mockSuccessfulSpawn(JSON.stringify({
      changes: [],
      root: { path: "x", source: "nearest", futureRootField: true },
      futureTopLevelField: { enabled: true },
    }));

    const result = await listChanges({ cwd: "/repo" });

    expect(result).toMatchObject({ futureTopLevelField: { enabled: true } });
  });

  it("rejects incompatible output across every JSON wrapper family", async () => {
    const cases: Array<{ output: string; invoke: () => Promise<unknown>; command: string }> = [
      { output: '{"specs":{}}', invoke: () => listSpecs({ cwd: "/repo" }), command: "list --specs --json" },
      { output: '{"id":"x","title":"x","deltaCount":0,"deltas":{}}', invoke: () => showChange("x", { cwd: "/repo" }), command: "show x --json --type change" },
      { output: '{"items":[],"summary":{}}', invoke: () => validateChange("x", { cwd: "/repo" }), command: "validate x --json --strict --type change" },
      { output: '{"changeName":"x","schemaName":"x","progress":{},"artifacts":[]}', invoke: () => statusChange("x", { cwd: "/repo" }), command: "status --change x --json" },
      { output: '[]', invoke: () => createChange("x", { cwd: "/repo" }), command: "new change x --json" },
      { output: '[]', invoke: () => archiveChange("x", { cwd: "/repo" }), command: "archive x --yes --json" },
    ];

    for (const contractCase of cases) {
      mockSuccessfulSpawn(contractCase.output);
      const error = await contractCase.invoke().catch((caught: unknown) => caught);
      expect(error).toMatchObject({
        code: "incompatible-output",
        command: contractCase.command,
      });
    }
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
