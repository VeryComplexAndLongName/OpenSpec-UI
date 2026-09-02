// Unit tests for AcpSessionDriver.run() against a mocked ACP peer built
// with @agentclientprotocol/sdk's own `agent()` builder, connected
// in-process via ClientApp.connectWith's `AgentApp` overload — no real CLI
// process is spawned (see tasks.md 2.3 and this file's header comment in
// acp-session-driver.ts on why `run()` is decoupled from spawning).

import { AGENT_METHODS, CLIENT_METHODS, PROTOCOL_VERSION, agent } from "@agentclientprotocol/sdk";
import { describe, expect, it } from "vitest";
import type { Event } from "../protocol.js";
import { AcpSessionDriver } from "./acp-session-driver.js";

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
});
