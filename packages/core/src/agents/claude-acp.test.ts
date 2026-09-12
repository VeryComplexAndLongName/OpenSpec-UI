import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readAcpStreamedText } from "../acp-streamed-text.js";
import { describeAcpUpdate } from "../acp-update-line.js";
import type { Command, Event } from "../protocol.js";

// every-varying-check-has-a-budget: the only filesystem work here is one
// read of a 30-line fixture, the rest is in memory. Measured 2026-09-13 at
// 60ms idle for all 28 tests together; the ceiling is for a loaded
// machine, not for this work.
vi.setConfig({ testTimeout: 15_000 });

const spawnAndStreamMock = vi.fn();
vi.mock("./shared.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./shared.js")>();
  return { ...actual, spawnAndStream: (...args: unknown[]) => spawnAndStreamMock(...args) };
});

afterEach(() => {
  spawnAndStreamMock.mockReset();
});

const { CLAUDE_STREAM_JSON_META_KEY, ClaudeCliAcpAdapter, translateClaudeStream } = await import("./claude-acp.js");

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
      // an-agent-update-says-something: an assistant text block reaches
      // the stream as ACP's own message chunk, not as Claude's line type.
      expect(update.update.sessionUpdate).toBe("agent_message_chunk");
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

describe("translateClaudeStream — usage from the result line (usage-from-acp)", () => {
  function streamOf(lines: unknown[]): () => AsyncGenerator<Event> {
    return async function* () {
      yield { kind: "started", runId: "r", timestamp: "t", command: "implement", cwd: "/x" };
      for (const line of lines) {
        yield { kind: "stdout", runId: "r", timestamp: "t", chunk: `${JSON.stringify(line)}
` };
      }
      yield { kind: "completed", runId: "r", timestamp: "t" };
    };
  }

  async function collect(source: () => AsyncGenerator<Event>): Promise<Event[]> {
    const events: Event[] = [];
    for await (const e of translateClaudeStream(source(), "r")) events.push(e);
    return events;
  }

  it("reports the cost, tokens and per-model split the result line carried", async () => {
    const events = await collect(
      streamOf([
        { type: "assistant", message: { content: "working" } },
        {
          type: "result",
          subtype: "success",
          is_error: false,
          result: "done",
          total_cost_usd: 0.1234,
          usage: {
            input_tokens: 500,
            output_tokens: 200,
            cache_creation_input_tokens: 10,
            cache_read_input_tokens: 4000,
          },
          modelUsage: {
            "claude-opus-5": { inputTokens: 400, outputTokens: 180, costUSD: 0.12 },
            "claude-haiku-4-5": { inputTokens: 100, outputTokens: 20, costUSD: 0.0034 },
          },
        },
      ]),
    );

    const usageEvent = events.find((event) => event.kind === "usageReported");
    expect(usageEvent).toMatchObject({
      usage: {
        costUsd: 0.1234,
        inputTokens: 500,
        outputTokens: 200,
        cacheCreationInputTokens: 10,
        cacheReadInputTokens: 4000,
        byModel: {
          "claude-opus-5": { inputTokens: 400, outputTokens: 180, costUsd: 0.12 },
          "claude-haiku-4-5": { inputTokens: 100, outputTokens: 20, costUsd: 0.0034 },
        },
      },
    });

    // Before the terminal event, or agent-runner.ts's audit entry — written
    // the moment the stream ends — would never see it.
    const usageIndex = events.findIndex((event) => event.kind === "usageReported");
    const terminalIndex = events.findIndex((event) => event.kind === "completed");
    expect(usageIndex).toBeGreaterThanOrEqual(0);
    expect(usageIndex).toBeLessThan(terminalIndex);
  });

  it("reports usage for a failed run too — a run that failed still spent what it spent", async () => {
    const events = await collect(
      streamOf([
        {
          type: "result",
          subtype: "error_during_execution",
          is_error: true,
          total_cost_usd: 0.5,
          usage: { input_tokens: 9, output_tokens: 1 },
        },
      ]),
    );

    expect(events.find((event) => event.kind === "usageReported")).toMatchObject({
      usage: { costUsd: 0.5, inputTokens: 9, outputTokens: 1 },
    });
    expect(events.at(-1)?.kind).toBe("failed");
  });

  it("reports nothing when the result line carried no usage at all", async () => {
    const events = await collect(streamOf([{ type: "result", subtype: "success", is_error: false, result: "done" }]));

    // Absent, not zero: `checkBudget` fails open on absence by design, and
    // a zero would claim the run was free.
    expect(events.some((event) => event.kind === "usageReported")).toBe(false);
    expect(events.at(-1)).toMatchObject({ kind: "completed", summary: "done" });
  });
});

// an-agent-update-says-something tasks.md 5.1-5.4. The fixture is a real
// stream from `claude` 2.1.237, run with this adapter's own flags, with
// only its init line reduced so it names no machine. A test built from
// shapes written by hand checks the translation against what its author
// believed the format to be; this one checks it against what `claude`
// actually sent — which is how the first draft's `TodoWrite` mapping and
// its non-empty thinking were found not to exist.
describe("translateClaudeStream — ACP shapes, from a real 2.1.237 stream", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const fixture = readFileSync(path.join(here, "fixtures", "claude-2.1.237-stream.jsonl"), "utf8");
  const cwd = path.resolve("/workspace/capture");
  const failingCommand = 'Bash: node -e "process.exit(3)"';

  async function replay(text: string, chunkSize = text.length): Promise<Event[]> {
    async function* source(): AsyncGenerator<Event> {
      yield { kind: "started", runId: "r", timestamp: "t", command: "implement", cwd };
      for (let start = 0; start < text.length; start += chunkSize) {
        yield { kind: "stdout", runId: "r", timestamp: "t", chunk: text.slice(start, start + chunkSize) };
      }
      yield { kind: "completed", runId: "r", timestamp: "t" };
    }
    const events: Event[] = [];
    for await (const event of translateClaudeStream(source(), "r", cwd)) events.push(event);
    return events;
  }

  function updatesOf(events: Event[]): Array<Record<string, unknown>> {
    return events.flatMap((event) => (event.kind === "agentUpdate" ? [event.update] : []));
  }

  it("turns each tool use into a tool_call titled by what it acts on, with its kind", async () => {
    const calls = updatesOf(await replay(fixture))
      .filter((update) => update.sessionUpdate === "tool_call")
      .map((update) => [update.title, update.kind, update.status]);

    expect(calls).toEqual([
      ["ToolSearch", "other", "in_progress"],
      ["ToolSearch", "other", "in_progress"],
      ["Glob src/*.txt", "search", "in_progress"],
      ['Grep "alpha" in src', "search", "in_progress"],
      ["Read src/notes.txt", "read", "in_progress"],
      ["Edit src/notes.txt", "edit", "in_progress"],
      ["Bash: node --version", "execute", "in_progress"],
      [failingCommand, "execute", "in_progress"],
    ]);
  });

  it("turns each tool result into an update naming its call, failed where the result was an error", async () => {
    const results = updatesOf(await replay(fixture))
      .filter((update) => update.sessionUpdate === "tool_call_update")
      .map((update) => [update.title, update.status]);

    expect(results).toEqual([
      ["ToolSearch", "completed"],
      ["ToolSearch", "completed"],
      ["Glob src/*.txt", "completed"],
      ['Grep "alpha" in src', "completed"],
      ["Read src/notes.txt", "completed"],
      ["Edit src/notes.txt", "completed"],
      ["Bash: node --version", "completed"],
      [failingCommand, "failed"],
    ]);
  });

  it("sends the agent's words as message chunks, each ending its line", async () => {
    const messages = updatesOf(await replay(fixture))
      .filter((update) => update.sessionUpdate === "agent_message_chunk")
      .map((update) => readAcpStreamedText(update)?.text);

    expect(messages).toHaveLength(3);
    expect(messages[0]).toContain("TodoWrite isn't available");
    for (const text of messages) expect(text?.endsWith(String.fromCharCode(10))).toBe(true);
  });

  it("sends nothing for redacted thinking, and forwards only what ACP has no counterpart for", async () => {
    const updates = updatesOf(await replay(fixture));
    const translatedKinds = new Set(["tool_call", "tool_call_update", "agent_message_chunk"]);

    expect(updates.some((update) => update.sessionUpdate === "agent_thought_chunk")).toBe(false);
    expect(updates.map((update) => update.sessionUpdate).filter((kind) => !translatedKinds.has(String(kind)))).toEqual([
      "system",
      "rate_limit_event",
      "system",
      "system",
      "system",
      "system",
      "system",
      "system",
      "result",
    ]);
  });

  it("reads the same whether the stream arrives whole or in small pieces", async () => {
    const whole = updatesOf(await replay(fixture));
    const pieces = updatesOf(await replay(fixture, 97));

    expect(pieces).toEqual(whole);
  });

  it("still ends the run as the result line says, with the usage it reported", async () => {
    const events = await replay(fixture);

    expect(events.some((event) => event.kind === "usageReported")).toBe(true);
    const last = events.at(-1);
    expect(last?.kind).toBe("completed");
    expect(last?.kind === "completed" && last.summary).toContain("delta two");
  });

  it("carries the block each update came from in _meta", async () => {
    const read = updatesOf(await replay(fixture)).find((update) => update.title === "Read src/notes.txt");

    expect(read?._meta).toEqual({
      [CLAUDE_STREAM_JSON_META_KEY]: expect.objectContaining({ type: "tool_use", name: "Read" }),
    });
  });

  it("reads, through core's own reader, as the lines a person watching the run sees", async () => {
    const lines = updatesOf(await replay(fixture))
      .map((update) => describeAcpUpdate(update))
      .filter((line) => line !== undefined);

    expect(lines).toEqual([
      "ToolSearch",
      "ToolSearch",
      "Glob src/*.txt",
      'Grep "alpha" in src',
      "Read src/notes.txt",
      "Edit src/notes.txt",
      "Bash: node --version",
      failingCommand,
      `failed: ${failingCommand}`,
    ]);
  });
});

describe("translateClaudeStream — titles and degradation", () => {
  const cwd = path.resolve("/workspace/repo");
  const lineBreak = String.fromCharCode(10);

  async function updatesFor(lines: unknown[]): Promise<Array<Record<string, unknown>>> {
    async function* source(): AsyncGenerator<Event> {
      yield {
        kind: "stdout",
        runId: "r",
        timestamp: "t",
        chunk: lines.map((line) => JSON.stringify(line)).join(lineBreak) + lineBreak,
      };
    }
    const updates: Array<Record<string, unknown>> = [];
    for await (const event of translateClaudeStream(source(), "r", cwd)) {
      if (event.kind === "agentUpdate") updates.push(event.update);
    }
    return updates;
  }

  function toolUse(name: string, input: Record<string, unknown>, id = "toolu_1"): unknown {
    return { type: "assistant", message: { content: [{ type: "tool_use", id, name, input }] } };
  }

  it("titles an absolute path inside the working directory relative to it, and keeps it absolute in locations", async () => {
    const filePath = path.join(cwd, "src", "index.ts");
    const [call] = await updatesFor([toolUse("Edit", { file_path: filePath, old_string: "a", new_string: "b" })]);

    expect(call).toMatchObject({ sessionUpdate: "tool_call", title: "Edit src/index.ts", kind: "edit" });
    expect(call?.locations).toEqual([{ path: filePath }]);
  });

  it("leaves a path outside the working directory whole", async () => {
    const outside = path.resolve("/elsewhere/notes.md");
    const [call] = await updatesFor([toolUse("Read", { file_path: outside })]);

    expect(call?.title).toBe(`Read ${outside.split(path.sep).join("/")}`);
  });

  it("titles each known tool by the input that says what it acts on", async () => {
    const twoLineScript = ["Get-ChildItem", "Select-Object -First 1"].join(lineBreak);
    const titles = (
      await updatesFor([
        toolUse("PowerShell", { command: twoLineScript }, "a"),
        toolUse("Glob", { pattern: "**/*.md" }, "b"),
        toolUse("Grep", { pattern: "TODO" }, "c"),
        toolUse("WebFetch", { url: "https://example.com/doc" }, "d"),
        toolUse("WebSearch", { query: "acp tool call" }, "e"),
        toolUse("Task", { description: "Review the diff", prompt: "..." }, "f"),
        toolUse("NotebookEdit", { notebook_path: "analysis.ipynb" }, "g"),
        toolUse("Monitor", { anything: true }, "h"),
      ])
    ).map((update) => [update.title, update.kind]);

    expect(titles).toEqual([
      ["PowerShell: Get-ChildItem", "execute"],
      ["Glob **/*.md", "search"],
      ['Grep "TODO"', "search"],
      ["WebFetch https://example.com/doc", "fetch"],
      ['WebSearch "acp tool call"', "fetch"],
      ["Agent: Review the diff", "other"],
      ["NotebookEdit analysis.ipynb", "edit"],
      ["Monitor", "other"],
    ]);
  });

  it("titles a known tool missing its field by its name, keeping its kind", async () => {
    const [call] = await updatesFor([toolUse("Read", {})]);

    expect(call).toMatchObject({ title: "Read", kind: "read" });
  });

  it("reports a result for a call it never saw without a title", async () => {
    const [update] = await updatesFor([
      { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "unseen", content: "x", is_error: true }] } },
    ]);

    expect(update).toMatchObject({ sessionUpdate: "tool_call_update", toolCallId: "unseen", status: "failed" });
    expect(update).not.toHaveProperty("title");
  });

  it("forwards a line carrying only a block it does not recognise exactly as before", async () => {
    const line = { type: "assistant", message: { content: [{ type: "server_tool_use", id: "s1", name: "web" }] } };
    const [update] = await updatesFor([line]);

    expect(update).toEqual({ sessionUpdate: "assistant", ...line });
  });

  it("keeps what it recognised from a line that also carries a block it does not", async () => {
    const updates = await updatesFor([
      {
        type: "assistant",
        message: { content: [{ type: "server_tool_use", id: "s1" }, { type: "text", text: "Done." }] },
      },
    ]);

    expect(updates.map((update) => update.sessionUpdate)).toEqual(["agent_message_chunk"]);
  });

  it("does not add a second line break to text that already ends its line", async () => {
    const text = `Done.${lineBreak}`;
    const [update] = await updatesFor([{ type: "assistant", message: { content: [{ type: "text", text }] } }]);

    expect(readAcpStreamedText(update ?? {})?.text).toBe(text);
  });
});
