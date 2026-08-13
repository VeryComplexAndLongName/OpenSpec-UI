// Contract test (tasks.md 1.4): один и тот же сценарий (успех/ошибка/обрыв
// соединения) должен давать одинаковый набор событий через оба Transport,
// несмотря на разные механизмы доставки под капотом (WebSocket vs
// postMessage). Это прямой тест риска из design.md ("Два Transport-адаптера
// могут разойтись по обработке ошибок").

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
    // Отправка команды по сокету не участвует в этом сценарии — здесь
    // проверяется только доставка событий, приходящих обратно.
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
  // `command.kind === "implement"` идёт по WS — сокет создаётся при первом
  // `send()` (см. fetch-transport.ts), поэтому для доставки событий сначала
  // нужно инициировать команду, как это происходит в реальном сценарии.
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
      // MessageBridgeTransport не владеет lifecycle'ом eventTarget — обрыв
      // соединения здесь означает "хост перестал слать события", что не
      // требует явного действия для этого фейка.
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
