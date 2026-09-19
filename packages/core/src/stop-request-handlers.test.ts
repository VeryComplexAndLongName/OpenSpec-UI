import { describe, expect, it, vi } from "vitest";
import type { Command, Event } from "./protocol.js";
import { InMemoryAuditLog } from "./security.js";
import { agentStopRequestHandlers, chainStopRequestHandlers } from "./stop-request-handlers.js";

// a-run-elsewhere-can-be-asked-to-stop 2.2 and 2.3: what a host does when its
// run reads a request to stop it.

const command: Command = {
  kind: "chain",
  cwd: "/repo",
  runId: "run-1",
  context: { changeDir: "/repo/openspec/changes/alpha" },
};

describe("chainStopRequestHandlers", () => {
  it("stops the chain through requestStop, with the enrolled person and the request's message id", () => {
    const chainRunner = { requestStop: vi.fn(() => true) };

    chainStopRequestHandlers(chainRunner, command).onStopRequested?.({ reason: "live check", by: "Ada", messageId: "m-1" });

    // The fifth argument is the task a request may name; absent here,
     // which is what a plain stop has always been
     // (a-run-is-told-where-to-stop).
    expect(chainRunner.requestStop).toHaveBeenCalledWith("run-1", "live check", "Ada", "m-1", undefined);
  });

  it("passes the task a request named, so the run finishes it before stopping", () => {
    const chainRunner = { requestStop: vi.fn(() => true) };

    chainStopRequestHandlers(chainRunner, command).onStopRequested?.({
      reason: "only up to 4.6",
      by: "Ada",
      messageId: "m-3",
      afterTask: "4.6",
    });

    expect(chainRunner.requestStop).toHaveBeenCalledWith("run-1", "only up to 4.6", "Ada", "m-3", "4.6");
  });

  it("records a refused request as a message entry, without the reason nobody verified", () => {
    const auditLog = new InMemoryAuditLog();

    chainStopRequestHandlers({ requestStop: () => true }, command, auditLog).onStopRequestRefused?.({ messageId: "m-2", why: "unverified", reason: "unverified words" });

    expect(auditLog.entries).toEqual([
      expect.objectContaining({
        runId: "run-1",
        agent: "chain",
        outcome: "message",
        cwd: "/repo",
        changeDir: "/repo/openspec/changes/alpha",
        stopRequestRefused: { messageId: "m-2", why: "unverified" },
      }),
    ]);
    expect(JSON.stringify(auditLog.entries)).not.toContain("unverified words");
  });
});

describe("agentStopRequestHandlers", () => {
  it("sends the run's own runner a stop with the request's reason", async () => {
    const received: Command[] = [];
    const runner = {
      // eslint-disable-next-line require-yield
      async *run(sent: Command): AsyncIterable<Event> {
        received.push(sent);
      },
    };
    const single: Command = { ...command, kind: "implement", agentId: "claude-cli" };

    agentStopRequestHandlers(runner, single).onStopRequested?.({ reason: "live check", by: "Ada", messageId: "m-3" });

    await vi.waitFor(() => expect(received).toEqual([expect.objectContaining({ kind: "stop", runId: "run-1", reason: "live check", agentId: "claude-cli" })]));
  });

  it("records a refused request under the run's agent", () => {
    const auditLog = new InMemoryAuditLog();
    const single: Command = { ...command, kind: "implement", agentId: "claude-cli" };

    agentStopRequestHandlers({ run: async function* () {} }, single, auditLog).onStopRequestRefused?.({ messageId: "m-4", why: "stale", reason: "x" });

    expect(auditLog.entries).toEqual([expect.objectContaining({ agent: "claude-cli", outcome: "message", stopRequestRefused: { messageId: "m-4", why: "stale" } })]);
  });
});
