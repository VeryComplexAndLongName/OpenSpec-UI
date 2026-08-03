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
