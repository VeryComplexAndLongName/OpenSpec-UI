// 1.4 Contract test: сервер корректно сериализует/десериализует каждый
// вариант `Event` из протокола `execution-core`, через реальные HTTP/WS
// соединения (не мок node:http) — реестр `AgentRunner` подменяется фиктивным,
// чтобы не требовать реальных CLI-агентов для этого теста (см. tasks.md 3.1
// за отдельным живым smoke-тестом с реальным агентом).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import WebSocket from "ws";
import {
  OpenSpecCliCompatibilityError,
  WorkbenchRunJournal,
  type AgentRunner,
  type Command,
  type Event,
} from "@openspec-ui/core";
import { createServer, type OpenSpecUiServer } from "./server.js";

const statusChangeMock = vi.fn();
const listChangesMock = vi.fn();
const listSpecsMock = vi.fn();
const initOpenSpecMock = vi.fn();
const detectAvailableAgentsMock = vi.fn();
vi.mock("@openspec-ui/core", async () => {
  const actual = await vi.importActual<typeof import("@openspec-ui/core")>("@openspec-ui/core");
  return {
    ...actual,
    statusChange: (...args: unknown[]) => statusChangeMock(...args),
    listChanges: (...args: unknown[]) => listChangesMock(...args),
    listSpecs: (...args: unknown[]) => listSpecsMock(...args),
    initOpenSpec: (...args: unknown[]) => initOpenSpecMock(...args),
    detectAvailableAgents: (...args: unknown[]) => detectAvailableAgentsMock(...args),
  };
});

function fakeRunner(events: Event[]): AgentRunner {
  return {
    async *run(): AsyncIterable<Event> {
      for (const event of events) yield event;
    },
  };
}

const ALL_EVENT_VARIANTS: Event[] = [
  { kind: "started", runId: "run-1", timestamp: "t1", command: "implement", cwd: "/repo" },
  { kind: "stdout", runId: "run-1", timestamp: "t2", chunk: "building...\n" },
  { kind: "stderr", runId: "run-1", timestamp: "t3", chunk: "warning\n" },
  { kind: "progress", runId: "run-1", timestamp: "t4", message: "3/7" },
  { kind: "completed", runId: "run-1", timestamp: "t5", summary: "diff --git a/x b/x" },
  { kind: "failed", runId: "run-1", timestamp: "t6", reason: "boom" },
  { kind: "cancelled", runId: "run-1", timestamp: "t7" },
];

const implementCommand: Command = {
  kind: "implement",
  cwd: "/workspace/repo",
  runId: "run-1",
  agentId: "fake-agent",
  context: { changeDir: "/workspace/repo/openspec/changes/x" },
};

const statusCommand: Command = {
  kind: "status",
  cwd: "/workspace/repo",
  runId: "run-status",
  agentId: "fake-agent",
  context: { changeDir: "/workspace/repo/openspec/changes/x" },
};

let server: OpenSpecUiServer;
let baseUrl: string;
let wsUrl: string;
const tempDirs: string[] = [];
const ACCESS_TOKEN = "server-test-token";
const JSON_HEADERS = {
  "content-type": "application/json",
  "x-openspec-ui-token": ACCESS_TOKEN,
};

async function createTempWorkspace(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "openspec-ui-server-test-"));
  tempDirs.push(dir);
  return dir;
}

async function startServer(runners: Map<string, AgentRunner>) {
  server = createServer({
    workspaceRoot: "/workspace/repo",
    host: "127.0.0.1",
    port: 0,
    runners,
    accessToken: ACCESS_TOKEN,
    allowExternalCwd: true,
  });
  const address = await server.listen();
  baseUrl = `http://127.0.0.1:${address.port}`;
  wsUrl = `ws://127.0.0.1:${address.port}/api/ws`;
}

afterEach(async () => {
  statusChangeMock.mockReset();
  listChangesMock.mockReset();
  listSpecsMock.mockReset();
  initOpenSpecMock.mockReset();
  detectAvailableAgentsMock.mockReset();
  await server?.close();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("server — REST /api/status", () => {
  beforeEach(async () => {
    await startServer(new Map([["fake-agent", fakeRunner(ALL_EVENT_VARIANTS)]]));
  });

  it("returns every event variant produced by the resolved AgentRunner", async () => {
    const res = await fetch(`${baseUrl}/api/status`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(statusCommand),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { events: Event[] };
    expect(body.events).toEqual(ALL_EVENT_VARIANTS);
  });

  it("returns 400 for a malformed body", async () => {
    const res = await fetch(`${baseUrl}/api/status`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ not: "a command" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for an unknown agentId", async () => {
    const res = await fetch(`${baseUrl}/api/status`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ ...statusCommand, agentId: "does-not-exist" }),
    });
    expect(res.status).toBe(400);
  });

  it("binds to 127.0.0.1 by default, not 0.0.0.0", () => {
    const address = server.httpServer.address();
    expect(address && typeof address === "object" ? address.address : address).toBe("127.0.0.1");
  });

  it("returns 400 for malformed /api/overview request body", async () => {
    const res = await fetch(`${baseUrl}/api/overview`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ cwd: "" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns startup workspaceRoot for authenticated clients", async () => {
    const authorized = await fetch(`${baseUrl}/api/workspace-root`, {
      method: "GET",
      headers: { "x-openspec-ui-token": ACCESS_TOKEN },
    });
    expect(authorized.status).toBe(200);
    expect(await authorized.json()).toEqual({ workspaceRoot: path.resolve("/workspace/repo") });

    const unauthorized = await fetch(`${baseUrl}/api/workspace-root`, {
      method: "GET",
    });
    expect(unauthorized.status).toBe(401);
  });

  it("returns synthesized protocol events for /api/status-json", async () => {
    statusChangeMock.mockResolvedValueOnce({
      changeName: "x",
      schemaName: "spec-driven",
      progress: { total: 3, complete: 2, remaining: 1 },
      artifacts: [],
      root: { path: "/workspace/repo", source: "nearest" },
    });

    const res = await fetch(`${baseUrl}/api/status-json`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(statusCommand),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { events: Event[] };
    expect(body.events[0]).toMatchObject({ kind: "started", runId: statusCommand.runId });
    expect(body.events[1]).toMatchObject({ kind: "stdout", runId: statusCommand.runId });
    expect(body.events[2]).toMatchObject({ kind: "completed", runId: statusCommand.runId });
  });

  it("returns synthesized protocol events for /api/command-json list", async () => {
    listChangesMock.mockResolvedValueOnce({
      changes: [
        {
          name: "direct-openspec-mode",
          completedTasks: 1,
          totalTasks: 1,
          lastModified: "2026-08-05T00:00:00.000Z",
          status: "complete",
        },
      ],
      root: { path: "/workspace/repo", source: "nearest" },
    });

    const res = await fetch(`${baseUrl}/api/command-json`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ ...statusCommand, kind: "list" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { events: Event[] };
    expect(body.events[0]).toMatchObject({ kind: "started", runId: statusCommand.runId, command: "list" });
    expect(body.events[1]).toMatchObject({ kind: "stdout", runId: statusCommand.runId });
    expect(body.events[2]).toMatchObject({ kind: "completed", runId: statusCommand.runId });
  });

  it("lists archived change names in the overview, independent of listChanges", async () => {
    const cwd = await createTempWorkspace();
    await mkdir(path.join(cwd, "openspec", "changes", "archive", "old-change"), { recursive: true });
    await writeFile(path.join(cwd, "openspec", "config.yaml"), "schema: spec-driven\n");
    listChangesMock.mockResolvedValueOnce({ changes: [], root: { path: cwd, source: "nearest" } });
    listSpecsMock.mockResolvedValueOnce({ specs: [], root: { path: cwd, source: "nearest" } });

    const res = await fetch(`${baseUrl}/api/overview`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ cwd }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { archivedChanges: string[] };
    expect(body.archivedChanges).toEqual(["old-change"]);
  });

  it("returns overview with canInitialize=true for workspace without OpenSpec artifacts", async () => {
    const cwd = await createTempWorkspace();

    const res = await fetch(`${baseUrl}/api/overview`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ cwd }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      changes: unknown[];
      specs: unknown[];
      initialization: { hasOpenSpecDir: boolean; hasInitializationArtifacts: boolean; canInitialize: boolean };
    };
    expect(body.changes).toEqual([]);
    expect(body.specs).toEqual([]);
    expect(body.initialization).toEqual({
      hasOpenSpecDir: false,
      hasInitializationArtifacts: false,
      canInitialize: true,
    });
  });

  it("returns actionable guidance for incompatible OpenSpec CLI JSON", async () => {
    const cwd = await createTempWorkspace();
    await mkdir(path.join(cwd, "openspec"), { recursive: true });
    await writeFile(path.join(cwd, "openspec", "config.yaml"), "schema: spec-driven\n", "utf8");
    listChangesMock.mockRejectedValueOnce(new OpenSpecCliCompatibilityError(
      "incompatible-output",
      "list --json",
      "changes[] and root",
      '{"changes":{}}',
    ));
    listSpecsMock.mockResolvedValueOnce({ specs: [], root: { path: cwd, source: "nearest" } });

    const response = await fetch(`${baseUrl}/api/overview`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ cwd }),
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: expect.stringContaining("Update OpenSpec CLI or OpenSpec UI to compatible versions"),
    });
  });

  it("initializes OpenSpec when tools are provided", async () => {
    const cwd = await createTempWorkspace();
    initOpenSpecMock.mockImplementationOnce(async () => {
      await mkdir(path.join(cwd, "openspec", "changes"), { recursive: true });
      await mkdir(path.join(cwd, "openspec", "specs"), { recursive: true });
      await writeFile(path.join(cwd, "openspec", "config.yaml"), "# test\n", "utf8");
      return { stdout: "ok", stderr: "" };
    });

    const res = await fetch(`${baseUrl}/api/openspec/init`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ cwd, tools: ["github-copilot", "codex"] }),
    });

    expect(res.status).toBe(200);
    expect(initOpenSpecMock).toHaveBeenCalledWith({ cwd }, { tools: ["github-copilot", "codex"] });
    const body = (await res.json()) as {
      initialization: { hasOpenSpecDir: boolean; hasInitializationArtifacts: boolean; canInitialize: boolean };
    };
    expect(body.initialization.hasInitializationArtifacts).toBe(true);
    expect(body.initialization.canInitialize).toBe(false);
  });

  it("rejects init request with unsupported tools", async () => {
    const cwd = await createTempWorkspace();

    const res = await fetch(`${baseUrl}/api/openspec/init`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ cwd, tools: ["unknown-tool"] }),
    });

    expect(res.status).toBe(400);
    expect(initOpenSpecMock).not.toHaveBeenCalled();
  });

  it("rejects missing authentication and a hostile browser Origin", async () => {
    const missingToken = await fetch(`${baseUrl}/api/overview`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cwd: "/workspace/repo" }),
    });
    expect(missingToken.status).toBe(401);

    const hostileOrigin = await fetch(`${baseUrl}/api/overview`, {
      method: "POST",
      headers: { ...JSON_HEADERS, origin: "https://attacker.example" },
      body: JSON.stringify({ cwd: "/workspace/repo" }),
    });
    expect(hostileOrigin.status).toBe(403);
  });

  it("rejects an external cwd by default and oversized request bodies", async () => {
    await server.close();
    server = createServer({
      workspaceRoot: "/workspace/repo",
      host: "127.0.0.1",
      port: 0,
      accessToken: ACCESS_TOKEN,
      maxPayloadBytes: 64,
    });
    const address = await server.listen();
    baseUrl = `http://127.0.0.1:${address.port}`;

    const external = await fetch(`${baseUrl}/api/overview`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ cwd: "/outside/repo" }),
    });
    expect(external.status).toBe(403);

    const oversized = await fetch(`${baseUrl}/api/overview`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ cwd: "/workspace/repo", padding: "x".repeat(128) }),
    });
    expect(oversized.status).toBe(413);
  });

  it("saves Change Editor documents by revision and rejects stale edits", async () => {
    const cwd = await createTempWorkspace();
    const readResponse = await fetch(`${baseUrl}/api/change-editor/read`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ cwd, changeName: "safe-save" }),
    });
    const loaded = (await readResponse.json()) as { revision: string; files: Record<string, string> };
    expect(readResponse.status).toBe(200);
    expect(loaded.revision).toMatch(/^[a-f0-9]{64}$/);

    const files = { proposal: "proposal", design: "design", tasks: "tasks", spec: "spec" };
    const saveResponse = await fetch(`${baseUrl}/api/change-editor/save`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ cwd, changeName: "safe-save", files, revision: loaded.revision }),
    });
    const saved = (await saveResponse.json()) as { revision: string };
    expect(saveResponse.status).toBe(200);
    expect(saved.revision).not.toBe(loaded.revision);

    const conflictResponse = await fetch(`${baseUrl}/api/change-editor/save`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ cwd, changeName: "safe-save", files, revision: loaded.revision }),
    });
    expect(conflictResponse.status).toBe(409);
  });

  it("returns an archived change's tasks as a checkbox-reset template", async () => {
    const cwd = await createTempWorkspace();
    const archived = path.join(cwd, "openspec", "changes", "archive", "old-change");
    await mkdir(archived, { recursive: true });
    await writeFile(path.join(archived, "tasks.md"), "## 1. Setup\n\n- [x] done\n- [ ] todo\n");

    const response = await fetch(`${baseUrl}/api/change-editor/archive-tasks-template`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ cwd, changeName: "old-change" }),
    });
    const body = (await response.json()) as { template: string };

    expect(response.status).toBe(200);
    expect(body.template).toBe("## 1. Setup\n\n- [ ] done\n- [ ] todo\n");
  });

  it("rejects a tasks-template request for a name that is not an archived change", async () => {
    const cwd = await createTempWorkspace();

    const response = await fetch(`${baseUrl}/api/change-editor/archive-tasks-template`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ cwd, changeName: "does-not-exist" }),
    });

    expect(response.status).toBe(404);
  });

  it("lists the seed built-in template plus a real project-level fixture", async () => {
    const cwd = await createTempWorkspace();
    const projectDir = path.join(cwd, "openspec", "templates", "my-template");
    await mkdir(projectDir, { recursive: true });
    await writeFile(
      path.join(projectDir, "template.json"),
      JSON.stringify({ id: "my-template", title: "Mine", category: "c", version: "1.0.0", summary: "s", variables: [] }),
    );
    await writeFile(path.join(projectDir, "proposal.md"), "## Why\n");
    await writeFile(path.join(projectDir, "design.md"), "## Context\n");
    await writeFile(path.join(projectDir, "tasks.md"), "## 1. X\n");

    const response = await fetch(`${baseUrl}/api/templates/list`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ cwd }),
    });
    const body = (await response.json()) as { builtIn: Array<{ manifest: { id: string } }>; project: Array<{ manifest: { id: string } }> };

    expect(response.status).toBe(200);
    expect(body.builtIn.some((t) => t.manifest.id === "python-sqlalchemy-alembic")).toBe(true);
    expect(body.project).toHaveLength(1);
    expect(body.project[0]?.manifest.id).toBe("my-template");
  });

  it("reports agent detection results for an authorized cwd", async () => {
    const cwd = await createTempWorkspace();
    detectAvailableAgentsMock.mockResolvedValue({
      "claude-cli": true,
      "copilot-cli": false,
      "codex-cli": false,
      "gemini-cli": false,
      "local-llm": false,
    });

    const response = await fetch(`${baseUrl}/api/agents/detect`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ cwd }),
    });
    const body = (await response.json()) as { agents: Record<string, boolean> };

    expect(response.status).toBe(200);
    expect(body.agents["claude-cli"]).toBe(true);
    expect(body.agents["copilot-cli"]).toBe(false);
    expect(detectAvailableAgentsMock).toHaveBeenCalledWith({ localLlmBaseUrl: undefined });
  });

  it("rejects an agent-detection request for a cwd outside the workspace", async () => {
    await server.close();
    server = createServer({
      workspaceRoot: "/workspace/repo",
      host: "127.0.0.1",
      port: 0,
      accessToken: ACCESS_TOKEN,
    });
    const address = await server.listen();
    baseUrl = `http://127.0.0.1:${address.port}`;

    const response = await fetch(`${baseUrl}/api/agents/detect`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ cwd: "/outside/repo" }),
    });

    expect(response.status).toBe(403);
    expect(detectAvailableAgentsMock).not.toHaveBeenCalled();
  });

  it("deletes an existing project-level template", async () => {
    const cwd = await createTempWorkspace();
    const projectDir = path.join(cwd, "openspec", "templates", "my-template");
    await mkdir(projectDir, { recursive: true });
    await writeFile(
      path.join(projectDir, "template.json"),
      JSON.stringify({ id: "my-template", title: "Mine", category: "c", version: "1.0.0", summary: "s", variables: [] }),
    );
    await writeFile(path.join(projectDir, "proposal.md"), "## Why\n");
    await writeFile(path.join(projectDir, "design.md"), "## Context\n");
    await writeFile(path.join(projectDir, "tasks.md"), "## 1. X\n");

    const response = await fetch(`${baseUrl}/api/templates/delete`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ cwd, id: "my-template" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });

    const listResponse = await fetch(`${baseUrl}/api/templates/list`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ cwd }),
    });
    const listBody = (await listResponse.json()) as { project: unknown[] };
    expect(listBody.project).toHaveLength(0);
  });

  it("rejects deleting an unknown project-level template id", async () => {
    const cwd = await createTempWorkspace();

    const response = await fetch(`${baseUrl}/api/templates/delete`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ cwd, id: "does-not-exist" }),
    });

    expect(response.status).toBe(404);
  });

  it("customizes a built-in template then rejects a second customize of the same id", async () => {
    const cwd = await createTempWorkspace();

    const first = await fetch(`${baseUrl}/api/templates/customize`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ cwd, id: "python-sqlalchemy-alembic" }),
    });
    const firstBody = (await first.json()) as { manifest: { forkedFrom?: { id: string; version: string } } };
    expect(first.status).toBe(200);
    expect(firstBody.manifest.forkedFrom).toEqual({ id: "python-sqlalchemy-alembic", version: "1.0.0" });

    const second = await fetch(`${baseUrl}/api/templates/customize`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ cwd, id: "python-sqlalchemy-alembic" }),
    });
    expect(second.status).toBe(409);
  });

  it("renders a built-in template with a supplied variable substituted", async () => {
    const cwd = await createTempWorkspace();

    const response = await fetch(`${baseUrl}/api/templates/render`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        cwd,
        origin: "built-in",
        id: "python-sqlalchemy-alembic",
        variables: { packageName: "myapp" },
      }),
    });
    const body = (await response.json()) as { proposal: string };

    expect(response.status).toBe(200);
    expect(body.proposal).toContain("myapp/db.py");
    expect(body.proposal).not.toContain("{{packageName}}");
  });

  it("loads persisted process history and cleanup through the recovery adapter", async () => {
    const cwd = await createTempWorkspace();
    await new WorkbenchRunJournal(cwd).save({
      processes: [{
        id: "persisted-run",
        operation: "review",
        mutating: false,
        state: "completed",
        createdAt: "2026-01-01T00:00:00.000Z",
      }],
      checkpointSessions: [],
    });

    const listed = await fetch(`${baseUrl}/api/processes/list`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ cwd }),
    });
    expect(listed.status).toBe(200);
    expect(await listed.json()).toEqual([expect.objectContaining({ id: "persisted-run", state: "completed" })]);

    const cleaned = await fetch(`${baseUrl}/api/processes/cleanup`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ cwd, cutoff: "2026-07-01T00:00:00.000Z" }),
    });
    expect(cleaned.status).toBe(200);
    expect(await cleaned.json()).toEqual({ removed: 1, retained: 0 });
    expect((await new WorkbenchRunJournal(cwd).load()).processes).toEqual([]);
  });

  it("returns actionable diagnostics without replacing a future run journal", async () => {
    const cwd = await createTempWorkspace();
    const journal = new WorkbenchRunJournal(cwd);
    await journal.save({ processes: [], checkpointSessions: [] });
    const futureJournal = JSON.stringify({ version: 99, processes: [], checkpointSessions: [] });
    await writeFile(journal.filePath, futureJournal, "utf8");

    const response = await fetch(`${baseUrl}/api/processes/list`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ cwd }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: expect.stringContaining("Upgrade OpenSpec UI to recover runs"),
    });
    expect(await readFile(journal.filePath, "utf8")).toBe(futureJournal);
  });
});

describe("server — WebSocket /api/ws", () => {
  beforeEach(async () => {
    await startServer(new Map([["fake-agent", fakeRunner(ALL_EVENT_VARIANTS)]]));
  });

  it("streams every event variant back over the same connection, in order", async () => {
    const client = new WebSocket(wsUrl, ["openspec-ui", `openspec-ui-token.${ACCESS_TOKEN}`]);
    await new Promise((resolve) => client.once("open", resolve));

    const received: Event[] = [];
    const done = new Promise<void>((resolve) => {
      client.on("message", (raw) => {
        received.push(JSON.parse(raw.toString()) as Event);
        if (received.length === ALL_EVENT_VARIANTS.length) resolve();
      });
    });

    client.send(JSON.stringify(implementCommand));
    await done;

    expect(received).toEqual(ALL_EVENT_VARIANTS);
    client.close();
  });

  it("ignores malformed messages without closing the connection", async () => {
    const client = new WebSocket(wsUrl, ["openspec-ui", `openspec-ui-token.${ACCESS_TOKEN}`]);
    await new Promise((resolve) => client.once("open", resolve));

    client.send("not json");
    client.send(JSON.stringify({ not: "a command" }));

    // Соединение остаётся открытым и продолжает обрабатывать валидные команды.
    const received: Event[] = [];
    const done = new Promise<void>((resolve) => {
      client.on("message", (raw) => {
        received.push(JSON.parse(raw.toString()) as Event);
        if (received.length === ALL_EVENT_VARIANTS.length) resolve();
      });
    });
    client.send(JSON.stringify(implementCommand));
    await done;

    expect(received).toEqual(ALL_EVENT_VARIANTS);
    client.close();
  });

  it("sends a failed event for an unknown agentId instead of crashing", async () => {
    const client = new WebSocket(wsUrl, ["openspec-ui", `openspec-ui-token.${ACCESS_TOKEN}`]);
    await new Promise((resolve) => client.once("open", resolve));

    const received: Event[] = [];
    const done = new Promise<void>((resolve) => {
      client.on("message", (raw) => {
        received.push(JSON.parse(raw.toString()) as Event);
        resolve();
      });
    });
    client.send(JSON.stringify({ ...implementCommand, agentId: "does-not-exist" }));
    await done;

    expect(received).toEqual([expect.objectContaining({ kind: "failed", runId: "run-1" })]);
    client.close();
  });

  it("rejects unauthenticated and hostile-origin handshakes", async () => {
    const unauthenticated = new WebSocket(wsUrl);
    const unauthenticatedError = await new Promise<Error>((resolve) => {
      unauthenticated.once("error", resolve);
    });
    expect(unauthenticatedError.message).toContain("401");

    const hostileOrigin = new WebSocket(
      wsUrl,
      ["openspec-ui", `openspec-ui-token.${ACCESS_TOKEN}`],
      { origin: "https://attacker.example" },
    );
    const hostileOriginError = await new Promise<Error>((resolve) => {
      hostileOrigin.once("error", resolve);
    });
    expect(hostileOriginError.message).toContain("401");
  });

  it("closes a connection that exceeds the WebSocket payload limit", async () => {
    await server.close();
    server = createServer({
      workspaceRoot: "/workspace/repo",
      host: "127.0.0.1",
      port: 0,
      accessToken: ACCESS_TOKEN,
      maxPayloadBytes: 64,
    });
    const address = await server.listen();
    wsUrl = `ws://127.0.0.1:${address.port}/api/ws`;

    const client = new WebSocket(wsUrl, ["openspec-ui", `openspec-ui-token.${ACCESS_TOKEN}`]);
    await new Promise((resolve) => client.once("open", resolve));
    const closed = new Promise<number>((resolve) => client.once("close", resolve));
    client.send("x".repeat(128));
    await expect(closed).resolves.toBe(1009);
  });
});
