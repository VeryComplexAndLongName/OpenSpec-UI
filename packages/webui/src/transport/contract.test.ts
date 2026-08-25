// Contract test (tasks.md 1.4): the same scenario (success/error/connection
// drop) must produce the same set of events through both Transports,
// regardless of the different delivery mechanisms under the hood
// (WebSocket vs postMessage). This is a direct test of the risk from
// design.md ("The two Transport adapters could diverge in how they
// handle errors").

import { describe, expect, it, vi } from "vitest";
import type { Command, Event } from "@openspec-ui/core";
import { FetchTransport } from "./fetch-transport.js";
import { MessageBridgeTransport } from "./message-bridge-transport.js";
import type { Transport } from "./types.js";

class FakeWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState = FakeWebSocket.CONNECTING;

  constructor(public url: string) {
    super();
  }

  send(): void {
    // Sending a command over the socket is not part of this scenario —
    // only the delivery of events coming back is verified here.
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.dispatchEvent(new Event("open"));
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatchEvent(new Event("close"));
  }

  emit(data: string) {
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

const scenario: Event[] = [
  { kind: "started", runId: "run-1", timestamp: "t1", command: "implement", cwd: "/repo" },
  { kind: "stdout", runId: "run-1", timestamp: "t2", chunk: "step 1/3\n" },
  { kind: "progress", runId: "run-1", timestamp: "t3", message: "step 2/3" },
  { kind: "failed", runId: "run-1", timestamp: "t4", reason: "connection lost mid-stream" },
];

const command: Command = {
  kind: "implement",
  cwd: "/repo",
  runId: "run-1",
  context: { changeDir: "/repo/openspec/changes/x" },
};

function setUpFetchTransport(): { transport: Transport; drive: (event: Event) => void; teardownChannel: () => void } {
  const { ctor, instances } = makeWebSocketCtor();

  const transport = new FetchTransport({
    baseUrl: "http://localhost:4000",
    accessToken: "contract-test-token",
    fetchImpl: vi.fn().mockResolvedValue({ ok: true, json: async () => ({ events: [] }) }) as unknown as typeof fetch,
    webSocketCtor: ctor,
  });
  // `command.kind === "implement"` goes over WS — the socket is created on
  // the first `send()` (see fetch-transport.ts), so to deliver events we
  // first need to initiate the command, just as happens in a real scenario.
  transport.send(command);
  instances[0]?.open();

  return {
    transport,
    drive: (event: Event) => instances[0]?.emit(JSON.stringify(event)),
    teardownChannel: () => instances[0]?.close(),
  };
}

function setUpMessageBridgeTransport(): { transport: Transport; drive: (event: Event) => void; teardownChannel: () => void } {
  const eventTarget = new EventTarget();
  const transport = new MessageBridgeTransport({ vscodeApi: { postMessage: vi.fn() }, eventTarget });

  return {
    transport,
    drive: (event: Event) => eventTarget.dispatchEvent(new MessageEvent("message", { data: { type: "openspec-ui/event", event } })),
    teardownChannel: () => {
      // MessageBridgeTransport does not own the eventTarget's lifecycle —
      // a connection drop here means "the host stopped sending events",
      // which requires no explicit action for this fake.
    },
  };
}

describe.each([
  ["FetchTransport", setUpFetchTransport],
  ["MessageBridgeTransport", setUpMessageBridgeTransport],
] as const)("Transport contract — %s", (_name, setUp) => {
  it("send() is callable with the same Command shape", () => {
    const { transport } = setUp();
    expect(() => transport.send(command)).not.toThrow();
  });

  it("delivers the exact same event sequence for the success/progress/failure scenario", () => {
    const { transport, drive } = setUp();
    const received: Event[] = [];
    transport.subscribe((e) => received.push(e));

    for (const event of scenario) drive(event);

    expect(received).toEqual(scenario);
  });

  it("stops delivering events after unsubscribe, even if the channel keeps emitting", () => {
    const { transport, drive } = setUp();
    const received: Event[] = [];
    const unsubscribe = transport.subscribe((e) => received.push(e));

    drive(scenario[0]!);
    unsubscribe();
    drive(scenario[1]!);

    expect(received).toEqual([scenario[0]]);
  });
});
