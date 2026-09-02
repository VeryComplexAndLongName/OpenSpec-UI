import { afterEach, describe, expect, it, vi } from "vitest";
import type { Command, Event } from "../protocol.js";

const spawnAndStreamMock = vi.fn();
vi.mock("./shared.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./shared.js")>();
  return { ...actual, spawnAndStream: (...args: unknown[]) => spawnAndStreamMock(...args) };
});

afterEach(() => {
  spawnAndStreamMock.mockReset();
});

const { ClaudeCliAcpAdapter, translateClaudeStream } = await import("./claude-acp.js");

const command: Command = {
  kind: "implement",
  cwd: "/workspace/repo",
  runId: "run-claude-acp-1",
  context: { changeDir: "/workspace/repo/openspec/changes/x" },
};

describe("ClaudeCliAcpAdapter", () => {
  it("builds a process invocation for claude's stream-json mode, including --dangerously-skip-permissions", () => {
    const adapter = new ClaudeCliAcpAdapter();
    expect(adapter.buildInvocation(command)).toEqual({
      kind: "process",
      executable: "claude",
      args: [
        "-p",
        "--input-format",
        "stream-json",
        "--output-format",
        "stream-json",
        "--verbose",
        "--dangerously-skip-permissions",
      ],
    });
  });

  it("sends the prompt as a stream-json user-message line on stdin, not as an argv element", async () => {
    async function* fakeEvents(): AsyncGenerator<Event> {
      yield { kind: "completed", runId: "run-claude-acp-1", timestamp: "t" };
    }
    spawnAndStreamMock.mockReturnValue(fakeEvents());

    const adapter = new ClaudeCliAcpAdapter();
    const invocation = adapter.buildInvocation(command);
    for await (const _ of adapter.execute(invocation, command, "FILE CONTENT HERE", new AbortController().signal)) {
      // drain
    }

    const call = spawnAndStreamMock.mock.calls[0]?.[0] as { args: string[]; stdin?: string };
    expect(call.args).not.toContain("FILE CONTENT HERE");
    expect(call.stdin).toBeDefined();
    const parsed = JSON.parse((call.stdin ?? "").trim()) as { type: string; message: { content: string } };
    expect(parsed.type).toBe("user");
    expect(parsed.message.content).toContain("FILE CONTENT HERE");
  });

  it("translates a full implement run's stream-json lines into agentUpdate events, with no permissionRequest ever emitted", async () => {
    async function* fakeEvents(): AsyncGenerator<Event> {
      yield { kind: "started", runId: "run-claude-acp-1", timestamp: "t", command: "implement", cwd: "/workspace/repo" };
      yield {
        kind: "stdout",
        runId: "run-claude-acp-1",
        timestamp: "t",
        chunk: `${JSON.stringify({ type: "system", subtype: "init" })}\n${JSON.stringify({
          type: "assistant",
          message: { content: [{ type: "text", text: "working on it" }] },
        })}\n`,
      };
      yield {
        kind: "stdout",
        runId: "run-claude-acp-1",
        timestamp: "t",
        chunk: `${JSON.stringify({ type: "result", subtype: "success", is_error: false, result: "done" })}\n`,
      };
      yield { kind: "completed", runId: "run-claude-acp-1", timestamp: "t" };
    }
    spawnAndStreamMock.mockReturnValue(fakeEvents());

    const adapter = new ClaudeCliAcpAdapter();
    const invocation = adapter.buildInvocation(command);
    const events: Event[] = [];
    for await (const e of adapter.execute(invocation, command, "prompt body", new AbortController().signal)) {
      events.push(e);
    }

    expect(events.map((e) => e.kind)).toEqual(["started", "agentUpdate", "agentUpdate", "agentUpdate", "completed"]);
    expect(events.some((e) => e.kind === "permissionRequest")).toBe(false);
    const last = events.at(-1);
    expect(last?.kind === "completed" && last.summary).toBe("done");
  });

  it("reports failed (not completed) when the final result line has is_error: true, using its result text as the reason", async () => {
    async function* fakeEvents(): AsyncGenerator<Event> {
      yield {
        kind: "stdout",
        runId: "run-claude-acp-1",
        timestamp: "t",
        chunk: `${JSON.stringify({ type: "result", subtype: "error_max_turns", is_error: true, result: "hit max turns" })}\n`,
      };
      yield { kind: "completed", runId: "run-claude-acp-1", timestamp: "t" };
    }
    spawnAndStreamMock.mockReturnValue(fakeEvents());

    const adapter = new ClaudeCliAcpAdapter();
    const invocation = adapter.buildInvocation(command);
    const events: Event[] = [];
    for await (const e of adapter.execute(invocation, command, "prompt body", new AbortController().signal)) {
      events.push(e);
    }

    const last = events.at(-1);
    expect(last?.kind).toBe("failed");
    expect(last?.kind === "failed" && last.reason).toBe("hit max turns");
  });

  it("passes through a non-JSON stdout line unchanged as stdout, not agentUpdate (conservative parsing)", async () => {
    async function* fakeEvents(): AsyncGenerator<Event> {
      yield { kind: "stdout", runId: "run-claude-acp-1", timestamp: "t", chunk: "not json at all\n" };
      yield { kind: "completed", runId: "run-claude-acp-1", timestamp: "t" };
    }
    spawnAndStreamMock.mockReturnValue(fakeEvents());

    const adapter = new ClaudeCliAcpAdapter();
    const invocation = adapter.buildInvocation(command);
    const events: Event[] = [];
    for await (const e of adapter.execute(invocation, command, "prompt body", new AbortController().signal)) {
      events.push(e);
    }

    expect(events.some((e) => e.kind === "stdout" && e.chunk.includes("not json at all"))).toBe(true);
    expect(events.some((e) => e.kind === "agentUpdate")).toBe(false);
  });

  it("buffers a JSON line split across two stdout chunks instead of dropping it", async () => {
    const fullLine = JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "hi" }] } });
    const splitPoint = Math.floor(fullLine.length / 2);
    async function* fakeEvents(): AsyncGenerator<Event> {
      yield { kind: "stdout", runId: "run-claude-acp-1", timestamp: "t", chunk: fullLine.slice(0, splitPoint) };
      yield { kind: "stdout", runId: "run-claude-acp-1", timestamp: "t", chunk: `${fullLine.slice(splitPoint)}\n` };
      yield { kind: "completed", runId: "run-claude-acp-1", timestamp: "t" };
    }
    spawnAndStreamMock.mockReturnValue(fakeEvents());

    const adapter = new ClaudeCliAcpAdapter();
    const invocation = adapter.buildInvocation(command);
    const events: Event[] = [];
    for await (const e of adapter.execute(invocation, command, "prompt body", new AbortController().signal)) {
      events.push(e);
    }

    const update = events.find((e) => e.kind === "agentUpdate");
    expect(update).toBeDefined();
    if (update?.kind === "agentUpdate") {
      expect(update.update.sessionUpdate).toBe("assistant");
    }
  });

  it("a fail-closed permission_denied line (this change's own live-spike transcript shape: no control_request ever offered back) still never produces a permissionRequest event", async () => {
    async function* fakeEvents(): AsyncGenerator<Event> {
      yield {
        kind: "stdout",
        runId: "run-claude-acp-1",
        timestamp: "t",
        chunk: `${JSON.stringify({ type: "system", subtype: "permission_denied", tool: "Write" })}\n`,
      };
      yield {
        kind: "stdout",
        runId: "run-claude-acp-1",
        timestamp: "t",
        chunk: `${JSON.stringify({ type: "result", subtype: "success", is_error: false, result: "" })}\n`,
      };
      yield { kind: "completed", runId: "run-claude-acp-1", timestamp: "t" };
    }
    spawnAndStreamMock.mockReturnValue(fakeEvents());

    const adapter = new ClaudeCliAcpAdapter();
    const invocation = adapter.buildInvocation(command);
    const events: Event[] = [];
    for await (const e of adapter.execute(invocation, command, "prompt body", new AbortController().signal)) {
      events.push(e);
    }

    expect(events.some((e) => e.kind === "permissionRequest")).toBe(false);
    const permissionDeniedUpdate = events.find(
      (e) => e.kind === "agentUpdate" && e.update.subtype === "permission_denied",
    );
    expect(permissionDeniedUpdate).toBeDefined();
  });

  it("has no resolvePermission method — the adapter never emits permissionRequest at all", () => {
    const adapter = new ClaudeCliAcpAdapter();
    expect((adapter as { resolvePermission?: unknown }).resolvePermission).toBeUndefined();
  });
});

describe("translateClaudeStream", () => {
  it("passes through non-stdout events (started/failed/cancelled) unchanged when there is no result line", async () => {
    async function* fakeEvents(): AsyncGenerator<Event> {
      yield { kind: "started", runId: "r", timestamp: "t", command: "implement", cwd: "/x" };
      yield { kind: "cancelled", runId: "r", timestamp: "t" };
    }
    const events: Event[] = [];
    for await (const e of translateClaudeStream(fakeEvents(), "r")) events.push(e);
    expect(events).toEqual([
      { kind: "started", runId: "r", timestamp: "t", command: "implement", cwd: "/x" },
      { kind: "cancelled", runId: "r", timestamp: "t" },
    ]);
  });
});
