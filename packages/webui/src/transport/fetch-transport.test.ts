import { describe, expect, it, vi } from "vitest";
import type { Command } from "@openspec-ui/core";
import { FetchTransport } from "./fetch-transport.js";

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

function makeEventSourceCtor(): { ctor: typeof EventSource; instances: FakeEventSource[] } {
  const instances: FakeEventSource[] = [];
  const ctor = vi.fn((url: string) => {
    const instance = new FakeEventSource(url);
    instances.push(instance);
    return instance;
  }) as unknown as typeof EventSource;
  return { ctor, instances };
}

const command: Command = {
  kind: "implement",
  cwd: "/workspace/repo",
  runId: "run-1",
  context: { changeDir: "/workspace/repo/openspec/changes/x" },
};

describe("FetchTransport", () => {
  it("send() POSTs the command as JSON to /api/commands", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    const { ctor } = makeEventSourceCtor();
    const transport = new FetchTransport({
      baseUrl: "http://localhost:4000",
      fetchImpl: fetchMock as unknown as typeof fetch,
      eventSourceCtor: ctor,
    });

    transport.send(command);

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/commands", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(command),
    });
  });

  it("logs but does not throw when the POST rejects", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    const { ctor } = makeEventSourceCtor();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const transport = new FetchTransport({
      baseUrl: "http://localhost:4000",
      fetchImpl: fetchMock as unknown as typeof fetch,
      eventSourceCtor: ctor,
    });

    expect(() => transport.send(command)).not.toThrow();
    await new Promise((r) => setImmediate(r));
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("subscribe() opens an EventSource at /api/events and decodes protocol Events", () => {
    const { ctor, instances } = makeEventSourceCtor();
    const transport = new FetchTransport({
      baseUrl: "http://localhost:4000",
      fetchImpl: vi.fn() as unknown as typeof fetch,
      eventSourceCtor: ctor,
    });

    const received: unknown[] = [];
    transport.subscribe((e) => received.push(e));

    expect(instances[0]?.url).toBe("http://localhost:4000/api/events");
    instances[0]?.emit(JSON.stringify({ kind: "started", runId: "r1", timestamp: "t", command: "plan", cwd: "/x" }));
    expect(received).toEqual([{ kind: "started", runId: "r1", timestamp: "t", command: "plan", cwd: "/x" }]);
  });

  it("ignores malformed SSE payloads without throwing", () => {
    const { ctor, instances } = makeEventSourceCtor();
    const transport = new FetchTransport({
      baseUrl: "http://localhost:4000",
      fetchImpl: vi.fn() as unknown as typeof fetch,
      eventSourceCtor: ctor,
    });

    const received: unknown[] = [];
    transport.subscribe((e) => received.push(e));

    expect(() => instances[0]?.emit("not json at all")).not.toThrow();
    expect(() => instances[0]?.emit(JSON.stringify({ kind: "not-a-real-kind" }))).not.toThrow();
    expect(received).toHaveLength(0);
  });

  it("unsubscribe() closes the EventSource and stops delivering events", () => {
    const { ctor, instances } = makeEventSourceCtor();
    const transport = new FetchTransport({
      baseUrl: "http://localhost:4000",
      fetchImpl: vi.fn() as unknown as typeof fetch,
      eventSourceCtor: ctor,
    });

    const received: unknown[] = [];
    const unsubscribe = transport.subscribe((e) => received.push(e));
    unsubscribe();

    expect(instances[0]?.closed).toBe(true);
    instances[0]?.emit(JSON.stringify({ kind: "cancelled", runId: "r1", timestamp: "t" }));
    expect(received).toHaveLength(0);
  });

  it("throws a clear error when EventSource is unavailable and not injected", () => {
    const withEventSource = globalThis as { EventSource?: typeof EventSource };
    const original = withEventSource.EventSource;
    delete withEventSource.EventSource;
    try {
      expect(
        () => new FetchTransport({ baseUrl: "http://localhost:4000", fetchImpl: vi.fn() as unknown as typeof fetch }),
      ).toThrow(/EventSource/);
    } finally {
      withEventSource.EventSource = original;
    }
  });
});
