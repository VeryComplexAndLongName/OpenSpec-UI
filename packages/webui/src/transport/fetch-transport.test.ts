import { describe, expect, it, vi } from "vitest";
import type { Command } from "@openspec-ui/core";
import { FetchTransport } from "./fetch-transport.js";

class FakeWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState = FakeWebSocket.CONNECTING;
  sent: string[] = [];

  constructor(public url: string) {
    super();
  }

  send(data: string) {
    this.sent.push(data);
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.dispatchEvent(new Event("open"));
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatchEvent(new Event("close"));
  }

  emitMessage(data: string) {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
}

function makeWebSocketCtor(): { ctor: typeof WebSocket; instances: FakeWebSocket[] } {
  const instances: FakeWebSocket[] = [];
  const ctor = vi.fn((url: string) => {
    const instance = new FakeWebSocket(url);
    instances.push(instance);
    return instance;
  }) as unknown as typeof WebSocket;
  Object.assign(ctor, {
    CONNECTING: FakeWebSocket.CONNECTING,
    OPEN: FakeWebSocket.OPEN,
    CLOSING: FakeWebSocket.CLOSING,
    CLOSED: FakeWebSocket.CLOSED,
  });
  return { ctor, instances };
}

const planCommand: Command = {
  kind: "plan",
  cwd: "/workspace/repo",
  runId: "run-1",
  context: { changeDir: "/workspace/repo/openspec/changes/x" },
};

const statusCommand: Command = {
  kind: "status",
  cwd: "/workspace/repo",
  runId: "run-status",
  context: { changeDir: "/workspace/repo/openspec/changes/x" },
};

describe("FetchTransport — status (REST)", () => {
  it("POSTs the status command to /api/status and dispatches the returned events", async () => {
    const events = [
      { kind: "started", runId: "run-status", timestamp: "t", command: "status", cwd: "/workspace/repo" },
      { kind: "completed", runId: "run-status", timestamp: "t", summary: "up to date" },
    ];
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ events }) });
    const { ctor } = makeWebSocketCtor();
    const transport = new FetchTransport({
      baseUrl: "http://localhost:4000",
      fetchImpl: fetchMock as unknown as typeof fetch,
      webSocketCtor: ctor,
    });

    const received: unknown[] = [];
    transport.subscribe((e) => received.push(e));
    transport.send(statusCommand);
    await new Promise((r) => setImmediate(r));

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(statusCommand),
    });
    expect(received).toEqual(events);
  });

  it("does not open a WebSocket for a status-only command", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ events: [] }) });
    const { ctor, instances } = makeWebSocketCtor();
    const transport = new FetchTransport({
      baseUrl: "http://localhost:4000",
      fetchImpl: fetchMock as unknown as typeof fetch,
      webSocketCtor: ctor,
    });
    transport.send(statusCommand);
    await new Promise((r) => setImmediate(r));
    expect(instances).toHaveLength(0);
  });

  it("logs but does not throw on a failed status request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: "Internal Server Error" });
    const { ctor } = makeWebSocketCtor();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const transport = new FetchTransport({
      baseUrl: "http://localhost:4000",
      fetchImpl: fetchMock as unknown as typeof fetch,
      webSocketCtor: ctor,
    });
    expect(() => transport.send(statusCommand)).not.toThrow();
    await new Promise((r) => setImmediate(r));
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe("FetchTransport — event-driven commands (WebSocket)", () => {
  it("opens a WebSocket to /api/ws and sends the command once open", () => {
    const { ctor, instances } = makeWebSocketCtor();
    const transport = new FetchTransport({
      baseUrl: "http://localhost:4000",
      fetchImpl: vi.fn() as unknown as typeof fetch,
      webSocketCtor: ctor,
    });

    transport.send(planCommand);

    expect(instances[0]?.url).toBe("ws://localhost:4000/api/ws");
    expect(instances[0]?.sent).toHaveLength(0); // ещё не открыт
    instances[0]?.open();
    expect(instances[0]?.sent).toEqual([JSON.stringify(planCommand)]);
  });

  it("sends immediately when the socket is already open", () => {
    const { ctor, instances } = makeWebSocketCtor();
    const transport = new FetchTransport({
      baseUrl: "http://localhost:4000",
      fetchImpl: vi.fn() as unknown as typeof fetch,
      webSocketCtor: ctor,
    });

    transport.send(planCommand);
    instances[0]?.open();
    transport.send({ ...planCommand, kind: "cancel" });

    expect(instances).toHaveLength(1); // переиспользует то же соединение
    expect(instances[0]?.sent).toHaveLength(2);
  });

  it("decodes protocol Events arriving over the WebSocket", () => {
    const { ctor, instances } = makeWebSocketCtor();
    const transport = new FetchTransport({
      baseUrl: "http://localhost:4000",
      fetchImpl: vi.fn() as unknown as typeof fetch,
      webSocketCtor: ctor,
    });

    const received: unknown[] = [];
    transport.subscribe((e) => received.push(e));
    transport.send(planCommand);
    instances[0]?.open();

    instances[0]?.emitMessage(
      JSON.stringify({ kind: "started", runId: "run-1", timestamp: "t", command: "plan", cwd: "/x" }),
    );
    expect(received).toEqual([{ kind: "started", runId: "run-1", timestamp: "t", command: "plan", cwd: "/x" }]);
  });

  it("ignores malformed WebSocket payloads without throwing", () => {
    const { ctor, instances } = makeWebSocketCtor();
    const transport = new FetchTransport({
      baseUrl: "http://localhost:4000",
      fetchImpl: vi.fn() as unknown as typeof fetch,
      webSocketCtor: ctor,
    });
    const received: unknown[] = [];
    transport.subscribe((e) => received.push(e));
    transport.send(planCommand);
    instances[0]?.open();

    expect(() => instances[0]?.emitMessage("not json")).not.toThrow();
    expect(() => instances[0]?.emitMessage(JSON.stringify({ kind: "bogus" }))).not.toThrow();
    expect(received).toHaveLength(0);
  });

  it("closes the socket once the last subscriber unsubscribes", () => {
    const { ctor, instances } = makeWebSocketCtor();
    const transport = new FetchTransport({
      baseUrl: "http://localhost:4000",
      fetchImpl: vi.fn() as unknown as typeof fetch,
      webSocketCtor: ctor,
    });
    const unsubscribe = transport.subscribe(() => {});
    transport.send(planCommand);
    instances[0]?.open();

    unsubscribe();
    expect(instances[0]?.readyState).toBe(FakeWebSocket.CLOSED);
  });

  it("throws a clear error when WebSocket is unavailable and not injected", () => {
    const withWs = globalThis as { WebSocket?: typeof WebSocket };
    const original = withWs.WebSocket;
    delete withWs.WebSocket;
    try {
      expect(
        () => new FetchTransport({ baseUrl: "http://localhost:4000", fetchImpl: vi.fn() as unknown as typeof fetch }),
      ).toThrow(/WebSocket/);
    } finally {
      withWs.WebSocket = original;
    }
  });
});
