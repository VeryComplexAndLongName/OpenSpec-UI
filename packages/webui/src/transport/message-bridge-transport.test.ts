import { describe, expect, it, vi } from "vitest";
import type { Command, Event } from "@openspec-ui/core";
import { MessageBridgeTransport } from "./message-bridge-transport.js";

const command: Command = {
  kind: "review",
  cwd: "/workspace/repo",
  runId: "run-1",
  context: { changeDir: "/workspace/repo/openspec/changes/x" },
};

describe("MessageBridgeTransport", () => {
  it("send() posts a message via the injected vscodeApi, wrapping the command", () => {
    const postMessage = vi.fn();
    const transport = new MessageBridgeTransport({ vscodeApi: { postMessage } });

    transport.send(command);

    expect(postMessage).toHaveBeenCalledWith({ type: "openspec-ui/command", command });
  });

  it("subscribe() decodes events from window 'message' events with the expected envelope", () => {
    const transport = new MessageBridgeTransport({ vscodeApi: { postMessage: vi.fn() } });
    const received: Event[] = [];
    transport.subscribe((e) => received.push(e));

    const event: Event = { kind: "stdout", runId: "run-1", timestamp: "t", chunk: "hi\n" };
    window.dispatchEvent(new MessageEvent("message", { data: { type: "openspec-ui/event", event } }));

    expect(received).toEqual([event]);
  });

  it("ignores unrelated window messages without throwing", () => {
    const transport = new MessageBridgeTransport({ vscodeApi: { postMessage: vi.fn() } });
    const received: Event[] = [];
    transport.subscribe((e) => received.push(e));

    expect(() => window.dispatchEvent(new MessageEvent("message", { data: { type: "some-other-extension/thing" } }))).not.toThrow();
    expect(() => window.dispatchEvent(new MessageEvent("message", { data: "plain string" }))).not.toThrow();
    expect(received).toHaveLength(0);
  });

  it("unsubscribe() removes the listener and stops delivering events", () => {
    const transport = new MessageBridgeTransport({ vscodeApi: { postMessage: vi.fn() } });
    const received: Event[] = [];
    const unsubscribe = transport.subscribe((e) => received.push(e));
    unsubscribe();

    const event: Event = { kind: "completed", runId: "run-1", timestamp: "t" };
    window.dispatchEvent(new MessageEvent("message", { data: { type: "openspec-ui/event", event } }));

    expect(received).toHaveLength(0);
  });

  it("supports an injected eventTarget instead of the global window (for host isolation)", () => {
    const fakeTarget = new EventTarget();
    const transport = new MessageBridgeTransport({ vscodeApi: { postMessage: vi.fn() }, eventTarget: fakeTarget });
    const received: Event[] = [];
    transport.subscribe((e) => received.push(e));

    const event: Event = { kind: "failed", runId: "run-1", timestamp: "t", reason: "boom" };
    fakeTarget.dispatchEvent(new MessageEvent("message", { data: { type: "openspec-ui/event", event } }));

    expect(received).toEqual([event]);
  });
});

describe("MessageBridgeTransport — every event kind reaches the webview", () => {
  // Where the defect was actually felt. `isEvent` is the gate this
  // transport puts in front of every incoming event, and a kind it does
  // not recognize is dropped here with no error anywhere — so
  // `cancelling` and `usageReported` were emitted by the core, posted by
  // the extension, and silently discarded one line before the UI.
  const cases: Event[] = [
    { kind: "cancelling", runId: "run-1", timestamp: "t", attempted: "termination-requested" },
    { kind: "cancelling", runId: "run-1", timestamp: "t", attempted: "nothing-to-cancel" },
    { kind: "usageReported", runId: "run-1", timestamp: "t", usage: { inputTokens: 10, outputTokens: 4, costUsd: 0.26 } },
  ];

  for (const event of cases) {
    it(`delivers a ${event.kind} event`, () => {
      const fakeTarget = new EventTarget();
      const transport = new MessageBridgeTransport({ vscodeApi: { postMessage: vi.fn() }, eventTarget: fakeTarget });
      const received: Event[] = [];
      transport.subscribe((e) => received.push(e));

      fakeTarget.dispatchEvent(new MessageEvent("message", { data: { type: "openspec-ui/event", event } }));

      expect(received).toEqual([event]);
    });
  }

  it("still drops a payload whose kind the protocol does not define", () => {
    const fakeTarget = new EventTarget();
    const transport = new MessageBridgeTransport({ vscodeApi: { postMessage: vi.fn() }, eventTarget: fakeTarget });
    const received: Event[] = [];
    transport.subscribe((e) => received.push(e));

    fakeTarget.dispatchEvent(
      new MessageEvent("message", { data: { type: "openspec-ui/event", event: { kind: "bogus", runId: "r", timestamp: "t" } } }),
    );

    expect(received).toHaveLength(0);
  });
});

