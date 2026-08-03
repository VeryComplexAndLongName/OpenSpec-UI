// Contract test (tasks.md 1.4): один и тот же сценарий (успех/ошибка/обрыв
// соединения) должен давать одинаковый набор событий через оба Transport,
// несмотря на разные механизмы доставки под капотом (SSE vs postMessage).
// Это прямой тест риска из design.md ("Два Transport-адаптера могут
// разойтись по обработке ошибок").

import { describe, expect, it, vi } from "vitest";
import type { Command, Event } from "@openspec-ui/core";
import { FetchTransport } from "./fetch-transport.js";
import { MessageBridgeTransport } from "./message-bridge-transport.js";
import type { Transport } from "./types.js";

class FakeEventSource extends EventTarget {
  closed = false;
  constructor(public url: string) {
    super();
  }
  close() {
    this.closed = true;
  }
  emit(data: string) {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
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
  let source: FakeEventSource | undefined;
  const ctor = vi.fn((url: string) => {
    source = new FakeEventSource(url);
    return source;
  }) as unknown as typeof EventSource;

  const transport = new FetchTransport({
    baseUrl: "http://localhost:4000",
    fetchImpl: vi.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch,
    eventSourceCtor: ctor,
  });

  return {
    transport,
    drive: (event: Event) => source?.emit(JSON.stringify(event)),
    teardownChannel: () => source?.close(),
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
