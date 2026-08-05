// 1.4 Contract test: сервер корректно сериализует/десериализует каждый
// вариант `Event` из протокола `execution-core`, через реальные HTTP/WS
// соединения (не мок node:http) — реестр `AgentRunner` подменяется фиктивным,
// чтобы не требовать реальных CLI-агентов для этого теста (см. tasks.md 3.1
// за отдельным живым smoke-тестом с реальным агентом).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import type { AgentRunner, Command, Event } from "@openspec-ui/core";
import { createServer, type OpenSpecUiServer } from "./server.js";

const statusChangeMock = vi.fn();
const listChangesMock = vi.fn();
vi.mock("@openspec-ui/core", async () => {
  const actual = await vi.importActual<typeof import("@openspec-ui/core")>("@openspec-ui/core");
  return {
    ...actual,
    statusChange: (...args: unknown[]) => statusChangeMock(...args),
    listChanges: (...args: unknown[]) => listChangesMock(...args),
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

async function startServer(runners: Map<string, AgentRunner>) {
  server = createServer({ workspaceRoot: "/workspace/repo", host: "127.0.0.1", port: 0, runners });
  const address = await server.listen();
  baseUrl = `http://127.0.0.1:${address.port}`;
  wsUrl = `ws://127.0.0.1:${address.port}/api/ws`;
}

afterEach(async () => {
  await server?.close();
});

describe("server — REST /api/status", () => {
  beforeEach(async () => {
    await startServer(new Map([["fake-agent", fakeRunner(ALL_EVENT_VARIANTS)]]));
  });

  it("returns every event variant produced by the resolved AgentRunner", async () => {
    const res = await fetch(`${baseUrl}/api/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(statusCommand),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { events: Event[] };
    expect(body.events).toEqual(ALL_EVENT_VARIANTS);
  });

  it("returns 400 for a malformed body", async () => {
    const res = await fetch(`${baseUrl}/api/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ not: "a command" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for an unknown agentId", async () => {
    const res = await fetch(`${baseUrl}/api/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
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
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cwd: "" }),
    });
    expect(res.status).toBe(400);
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
      headers: { "content-type": "application/json" },
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
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...statusCommand, kind: "list" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { events: Event[] };
    expect(body.events[0]).toMatchObject({ kind: "started", runId: statusCommand.runId, command: "list" });
    expect(body.events[1]).toMatchObject({ kind: "stdout", runId: statusCommand.runId });
    expect(body.events[2]).toMatchObject({ kind: "completed", runId: statusCommand.runId });
  });
});

describe("server — WebSocket /api/ws", () => {
  beforeEach(async () => {
    await startServer(new Map([["fake-agent", fakeRunner(ALL_EVENT_VARIANTS)]]));
  });

  it("streams every event variant back over the same connection, in order", async () => {
    const client = new WebSocket(wsUrl);
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
    const client = new WebSocket(wsUrl);
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
    const client = new WebSocket(wsUrl);
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
});
