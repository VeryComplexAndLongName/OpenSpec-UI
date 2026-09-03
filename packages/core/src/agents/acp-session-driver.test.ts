// Unit tests for AcpSessionDriver.run() against a mocked ACP peer built
// with @agentclientprotocol/sdk's own `agent()` builder, connected
// in-process via ClientApp.connectWith's `AgentApp` overload — no real CLI
// process is spawned (see tasks.md 2.3 and this file's header comment in
// acp-session-driver.ts on why `run()` is decoupled from spawning).

import { AGENT_METHODS, CLIENT_METHODS, PROTOCOL_VERSION, agent } from "@agentclientprotocol/sdk";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.fn();
vi.mock("cross-spawn", () => ({
  default: (...args: unknown[]) => spawnMock(...args),
}));

import type { AgentUsage } from "../agent-usage.js";
import type { Event } from "../protocol.js";
import { AcpSessionDriver } from "./acp-session-driver.js";

class FakeChildProcess extends EventEmitter {
  stdout = new PassThrough();
  stderr = new PassThrough();
  stdin = new PassThrough();
  pid: number | undefined;
}

let killSpy: ReturnType<typeof vi.fn<(pid: number, signal?: string | number) => true>>;
beforeEach(() => {
  killSpy = vi.fn<(pid: number, signal?: string | number) => true>(() => true);
  vi.spyOn(process, "kill").mockImplementation(killSpy);
});

afterEach(() => {
  spawnMock.mockReset();
  vi.restoreAllMocks();
});

async function collect(gen: AsyncGenerator<Event>, onEvent?: (event: Event) => void): Promise<Event[]> {
  const events: Event[] = [];
  for await (const event of gen) {
    events.push(event);
    onEvent?.(event);
  }
  return events;
}

describe("AcpSessionDriver", () => {
  it("translates a session/update notification into an agentUpdate event", async () => {
    const mockAgent = agent({ name: "mock-agent" })
      .onRequest(AGENT_METHODS.initialize, () => ({ protocolVersion: PROTOCOL_VERSION }))
      .onRequest(AGENT_METHODS.session_new, () => ({ sessionId: "session-1" }))
      .onRequest(AGENT_METHODS.session_prompt, async ({ params, client }) => {
        await client.notify(CLIENT_METHODS.session_update, {
          sessionId: params.sessionId,
          update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "hello" } },
        });
        return { stopReason: "end_turn" };
      });

    const driver = new AcpSessionDriver();
    const events = await collect(
      driver.run({ target: mockAgent, cwd: "/tmp/work", runId: "run-1", commandKind: "implement", prompt: "do it" }),
    );

    expect(events[0]?.kind).toBe("started");
    const update = events.find((event) => event.kind === "agentUpdate");
    expect(update).toBeDefined();
    if (update?.kind === "agentUpdate") {
      expect(update.update.sessionUpdate).toBe("agent_message_chunk");
    }
    expect(events.every((event) => event.kind !== "stdout")).toBe(true);
    expect(events.at(-1)?.kind).toBe("completed");
  });

  it("translates session/request_permission into permissionRequest, resolved by resolvePermission", async () => {
    const mockAgent = agent({ name: "mock-agent" })
      .onRequest(AGENT_METHODS.initialize, () => ({ protocolVersion: PROTOCOL_VERSION }))
      .onRequest(AGENT_METHODS.session_new, () => ({ sessionId: "session-1" }))
      .onRequest(AGENT_METHODS.session_prompt, async ({ params, client }) => {
        const response = await client.request(CLIENT_METHODS.session_request_permission, {
          sessionId: params.sessionId,
          toolCall: { toolCallId: "tool-1", title: "Write to src/index.ts" },
          options: [
            { optionId: "allow-once", name: "Allow", kind: "allow_once" },
            { optionId: "reject-once", name: "Deny", kind: "reject_once" },
          ],
        });
        if (response.outcome.outcome === "selected" && response.outcome.optionId === "allow-once") {
          await client.notify(CLIENT_METHODS.session_update, {
            sessionId: params.sessionId,
            update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "wrote the file" } },
          });
        }
        return { stopReason: "end_turn" };
      });

    const driver = new AcpSessionDriver();
    let resolvedRequestId: string | undefined;
    const events = await collect(
      driver.run({ target: mockAgent, cwd: "/tmp/work", runId: "run-2", commandKind: "implement", prompt: "do it" }),
      (event) => {
        if (event.kind === "permissionRequest" && resolvedRequestId === undefined) {
          resolvedRequestId = event.requestId;
          driver.resolvePermission("run-2", event.requestId, "allow");
        }
      },
    );

    expect(resolvedRequestId).toBeDefined();
    const permissionEvent = events.find((event) => event.kind === "permissionRequest");
    expect(permissionEvent).toBeDefined();
    if (permissionEvent?.kind === "permissionRequest") {
      expect(permissionEvent.description).toBe("Write to src/index.ts");
    }
    // The mock agent only sends the post-permission agentUpdate once it
    // sees the "allow" outcome round-tripped back as a selected option —
    // its presence here proves resolvePermission actually unblocked the
    // agent's pending session/request_permission call, not merely that a
    // permissionRequest event was observed.
    expect(events.some((event) => event.kind === "agentUpdate")).toBe(true);
    expect(events.at(-1)?.kind).toBe("completed");
    // Resolved once; a second attempt against the same runId/requestId is
    // a no-op, matching spec.md's "no second permissionRequest is emitted
    // for the same action".
    expect(driver.resolvePermission("run-2", resolvedRequestId as string, "allow")).toBe(false);
  });

  it("a peer that never issues session/request_permission never produces a permissionRequest event", async () => {
    const mockAgent = agent({ name: "mock-agent" })
      .onRequest(AGENT_METHODS.initialize, () => ({ protocolVersion: PROTOCOL_VERSION }))
      .onRequest(AGENT_METHODS.session_new, () => ({ sessionId: "session-1" }))
      .onRequest(AGENT_METHODS.session_prompt, async () => ({ stopReason: "end_turn" }));

    const driver = new AcpSessionDriver();
    const events = await collect(
      driver.run({ target: mockAgent, cwd: "/tmp/work", runId: "run-3", commandKind: "implement", prompt: "do it" }),
    );

    expect(events.some((event) => event.kind === "permissionRequest")).toBe(false);
    expect(events.at(-1)?.kind).toBe("completed");
  });

  it("resolvePermission for an unknown runId/requestId is a no-op, not an error", () => {
    const driver = new AcpSessionDriver();
    expect(driver.resolvePermission("unknown-run", "unknown-request", "allow")).toBe(false);
  });

  it("an already-aborted signal yields only cancelled, never started", async () => {
    const mockAgent = agent({ name: "mock-agent" }).onRequest(AGENT_METHODS.initialize, () => ({
      protocolVersion: PROTOCOL_VERSION,
    }));
    const controller = new AbortController();
    controller.abort();

    const driver = new AcpSessionDriver();
    const events = await collect(
      driver.run({
        target: mockAgent,
        cwd: "/tmp/work",
        runId: "run-4",
        commandKind: "implement",
        prompt: "do it",
        signal: controller.signal,
      }),
    );

    expect(events).toEqual([{ kind: "cancelled", runId: "run-4", timestamp: events[0]?.timestamp }]);
  });

  it("does not emit cancelled for an aborted ACP process before the child exits (task 5.4)", async () => {
    const child = new FakeChildProcess();
    child.pid = 4242;
    spawnMock.mockReturnValue(child);
    const controller = new AbortController();
    const driver = new AcpSessionDriver();
    const run = driver.runProcess({
      executable: "copilot",
      args: ["--acp"],
      cwd: "/tmp/work",
      runId: "run-5",
      commandKind: "implement",
      prompt: "do it",
      signal: controller.signal,
    });

    expect((await run.next()).value).toMatchObject({ kind: "started", runId: "run-5" });

    const terminal = run.next();
    controller.abort();
    await Promise.resolve();

    let settled = false;
    void terminal.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    child.emit("close", 0);
    expect((await terminal).value).toMatchObject({ kind: "cancelled", runId: "run-5" });
  });
});

describe("AcpSessionDriver — reporting what the agent said it spent", () => {
  function usageEventsOf(events: Event[]): AgentUsage[] {
    return events.flatMap((event) => (event.kind === "usageReported" ? [event.usage] : []));
  }

  it("reports the usage a prompt response carried", async () => {
    const mockAgent = agent({ name: "mock-agent" })
      .onRequest(AGENT_METHODS.initialize, () => ({ protocolVersion: PROTOCOL_VERSION }))
      .onRequest(AGENT_METHODS.session_new, () => ({ sessionId: "session-1" }))
      .onRequest(AGENT_METHODS.session_prompt, async () => ({
        stopReason: "end_turn",
        usage: { inputTokens: 1200, outputTokens: 340, thoughtTokens: 55, totalTokens: 1595 },
      }));

    const driver = new AcpSessionDriver();
    const events = await collect(
      driver.run({ target: mockAgent, cwd: "/tmp/work", runId: "run-u1", commandKind: "implement", prompt: "do it" }),
    );

    expect(usageEventsOf(events)).toEqual([{ inputTokens: 1200, outputTokens: 340, thoughtTokens: 55 }]);
    expect(events.at(-1)?.kind).toBe("completed");
  });

  it("reports nothing at all when the prompt response carried no usage", async () => {
    const mockAgent = agent({ name: "mock-agent" })
      .onRequest(AGENT_METHODS.initialize, () => ({ protocolVersion: PROTOCOL_VERSION }))
      .onRequest(AGENT_METHODS.session_new, () => ({ sessionId: "session-1" }))
      .onRequest(AGENT_METHODS.session_prompt, async () => ({ stopReason: "end_turn" }));

    const driver = new AcpSessionDriver();
    const events = await collect(
      driver.run({ target: mockAgent, cwd: "/tmp/work", runId: "run-u2", commandKind: "implement", prompt: "do it" }),
    );

    // No usageReported at all — not a usageReported carrying zeros. A run
    // that said nothing must stay distinguishable from one that said "free".
    expect(usageEventsOf(events)).toEqual([]);
    expect(events.at(-1)?.kind).toBe("completed");
  });

  it("captures a streamed usage_update's cost, and never its `used` as tokens spent", async () => {
    const mockAgent = agent({ name: "mock-agent" })
      .onRequest(AGENT_METHODS.initialize, () => ({ protocolVersion: PROTOCOL_VERSION }))
      .onRequest(AGENT_METHODS.session_new, () => ({ sessionId: "session-1" }))
      .onRequest(AGENT_METHODS.session_prompt, async ({ params, client }) => {
        await client.notify(CLIENT_METHODS.session_update, {
          sessionId: params.sessionId,
          update: { sessionUpdate: "usage_update", used: 90_000, size: 200_000, cost: { amount: 0.42, currency: "USD" } },
        });
        return { stopReason: "end_turn" };
      });

    const driver = new AcpSessionDriver();
    const events = await collect(
      driver.run({ target: mockAgent, cwd: "/tmp/work", runId: "run-u3", commandKind: "implement", prompt: "do it" }),
    );

    const [usage] = usageEventsOf(events);
    expect(usage).toEqual({ costUsd: 0.42 });
    // `used` is context occupancy, and it falls after a compaction.
    // Recording it as consumption would under-count exactly the long runs
    // that compact.
    expect(usage?.inputTokens).toBeUndefined();
    expect(usage?.outputTokens).toBeUndefined();
    // The notification is still forwarded verbatim — observing the stream
    // must not filter it.
    expect(events.some((event) => event.kind === "agentUpdate" && event.update.sessionUpdate === "usage_update")).toBe(
      true,
    );
  });

  it("keeps a non-USD cost whole instead of writing it into costUsd", async () => {
    const mockAgent = agent({ name: "mock-agent" })
      .onRequest(AGENT_METHODS.initialize, () => ({ protocolVersion: PROTOCOL_VERSION }))
      .onRequest(AGENT_METHODS.session_new, () => ({ sessionId: "session-1" }))
      .onRequest(AGENT_METHODS.session_prompt, async ({ params, client }) => {
        await client.notify(CLIENT_METHODS.session_update, {
          sessionId: params.sessionId,
          update: { sessionUpdate: "usage_update", used: 10, size: 100, cost: { amount: 3, currency: "EUR" } },
        });
        return { stopReason: "end_turn", usage: { inputTokens: 7, outputTokens: 2, totalTokens: 9 } };
      });

    const driver = new AcpSessionDriver();
    const events = await collect(
      driver.run({ target: mockAgent, cwd: "/tmp/work", runId: "run-u4", commandKind: "implement", prompt: "do it" }),
    );

    expect(usageEventsOf(events)).toEqual([
      { inputTokens: 7, outputTokens: 2, cost: { amount: 3, currency: "EUR" } },
    ]);
  });
});
