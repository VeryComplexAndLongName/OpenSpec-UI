// local-llm-codes-in-process 2.6-2.7: the local agent run through the real
// `AcpSessionDriver`, in process, against a stand-in model. No process is
// started for the agent, and no server: the model is a `fetch` that answers
// as an OpenAI-compatible server does.

import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FetchLike } from "../direct-fetch.js";
import type { Command, Event } from "../protocol.js";
import { LocalLlmAcpAdapter } from "./local-llm-acp.js";

vi.setConfig({ testTimeout: 20_000 });

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function workspace(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-local-agent-"));
  roots.push(root);
  return root;
}

type Answer = { content?: string | null; tool_calls?: unknown; usage?: unknown };

/** A model that gives `answers` in turn, and lists `models` at /v1/models. */
function standInModel(answers: Answer[], models: string[] = ["stand-in-model"]): { fetch: FetchLike; requests: Array<{ url: string; body?: unknown }> } {
  const requests: Array<{ url: string; body?: unknown }> = [];
  let turn = 0;
  const fetchImpl: FetchLike = async (url, init) => {
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    requests.push({ url, body });
    if (url.endsWith("/models")) return new Response(JSON.stringify({ data: models.map((id) => ({ id })) }), { status: 200 });
    const answer = answers[Math.min(turn, answers.length - 1)] ?? {};
    turn += 1;
    return new Response(
      JSON.stringify({
        choices: [{ message: { role: "assistant", content: answer.content ?? null, tool_calls: answer.tool_calls ?? null } }],
        usage: answer.usage ?? { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 },
      }),
      { status: 200 },
    );
  };
  return { fetch: fetchImpl, requests };
}

function call(name: string, args: Record<string, unknown>, id = "c1") {
  return [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }];
}

function command(cwd: string, extra: Partial<Command> = {}): Command {
  return { kind: "implement", cwd, runId: `run-${Math.random()}`, context: { changeDir: path.join(cwd, "openspec", "changes", "x") }, ...extra };
}

async function collect(events: AsyncIterable<Event>, onEvent?: (event: Event) => void): Promise<Event[]> {
  const out: Event[] = [];
  for await (const event of events) {
    out.push(event);
    onEvent?.(event);
  }
  return out;
}

function updates(events: Event[]): Array<Record<string, unknown>> {
  return events.filter((e) => e.kind === "agentUpdate").map((e) => (e as { update: Record<string, unknown> }).update);
}

describe("LocalLlmAcpAdapter, in process", () => {
  it("starts no process: its invocation is in-process", () => {
    const adapter = new LocalLlmAcpAdapter({ settings: { baseUrl: "http://x" }, limits: {}, fetch: standInModel([]).fetch, askBeforeCommands: false });
    expect(adapter.buildInvocation(command("/tmp"))).toEqual({ kind: "in-process", agent: "local-llm-acp" });
  });

  it("writes a file in the run's directory, streaming the tool call, its result and the tokens", async () => {
    const cwd = await workspace();
    const model = standInModel([
      { content: "Writing it.", tool_calls: call("write_file", { path: "src/hello.txt", content: "hi" }) },
      { content: "Done." },
    ]);
    const adapter = new LocalLlmAcpAdapter({ settings: { baseUrl: "http://gpu.lan:8000/v1", apiKey: "k" }, limits: {}, fetch: model.fetch, askBeforeCommands: false });
    const cmd = command(cwd);

    const events = await collect(adapter.execute(adapter.buildInvocation(cmd), cmd, "make hello.txt", new AbortController().signal));

    expect(events[0]?.kind).toBe("started");
    expect(events.at(-1)?.kind).toBe("completed");
    const kinds = updates(events).map((u) => u.sessionUpdate);
    expect(kinds).toEqual(["agent_message_chunk", "agent_message_chunk", "tool_call", "tool_call_update", "agent_message_chunk"]);
    // The first update names the model and where it came from.
    expect((updates(events)[0]?.content as { text: string }).text).toContain("Model stand-in-model (the model the server serves)");
    expect(updates(events)[2]).toMatchObject({ toolCallId: "c1", title: "write_file src/hello.txt", kind: "edit", status: "in_progress" });
    expect(updates(events)[3]).toMatchObject({ toolCallId: "c1", status: "completed" });
    expect(await readFile(path.join(cwd, "src", "hello.txt"), "utf8")).toBe("hi");
    expect(events.find((e) => e.kind === "usageReported")).toMatchObject({ usage: { inputTokens: 200, outputTokens: 20 } });
    // The stage's request carries the tools, the model and the key.
    const chat = model.requests.find((r) => r.url.endsWith("/chat/completions"));
    expect(chat?.url).toBe("http://gpu.lan:8000/v1/chat/completions");
    expect(chat?.body).toMatchObject({ model: "stand-in-model", tool_choice: "auto" });
  });

  it("searches SearXNG and returns its JSON artifact in the ACP tool update", async () => {
    const cwd = await workspace();
    const model = standInModel([
      { content: "Searching.", tool_calls: call("search_web", { query: "OpenSpec" }) },
      { content: "The source is the guide." },
    ]);
    const fetch: FetchLike = async (url, init) => {
      if (url.startsWith("http://search.lan:8080/")) {
        return new Response(JSON.stringify({ results: [{ title: "OpenSpec guide", url: "https://example.org/guide", content: "Project overview" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return model.fetch(url, init);
    };
    const adapter = new LocalLlmAcpAdapter({
      settings: { baseUrl: "http://x" }, limits: {}, fetch, searxngUrl: "http://search.lan:8080", askBeforeCommands: false,
    });
    const cmd = command(cwd);
    const events = await collect(adapter.execute(adapter.buildInvocation(cmd), cmd, "Search for the guide", new AbortController().signal));

    expect(updates(events).find((update) => update.sessionUpdate === "tool_call")).toMatchObject({
      title: "search_web OpenSpec", status: "in_progress",
    });
    expect(updates(events).find((update) => update.sessionUpdate === "tool_call_update")).toMatchObject({
      status: "completed", content: [{ content: { text: expect.stringContaining("OpenSpec guide") } }],
    });
    const chat = model.requests.find((request) => request.url.endsWith("/chat/completions"));
    const offeredTools = (chat?.body as { tools: Array<{ function: { name: string } }> }).tools.map((tool) => tool.function.name);
    expect(offeredTools).toContain("search_web");
    expect(offeredTools).toContain("fetch_webpage");
  });

  it("uses the stage's model where the stage names one", async () => {
    const cwd = await workspace();
    const model = standInModel([{ content: "ok" }]);
    const adapter = new LocalLlmAcpAdapter({ settings: { baseUrl: "http://x", model: "from-settings" }, limits: {}, fetch: model.fetch, askBeforeCommands: false });
    const cmd = command(cwd, { model: "from-stage" });

    await collect(adapter.execute(adapter.buildInvocation(cmd), cmd, "go", new AbortController().signal));

    expect(model.requests.find((r) => r.url.endsWith("/chat/completions"))?.body).toMatchObject({ model: "from-stage" });
    expect(model.requests.some((r) => r.url.endsWith("/models"))).toBe(false);
  });

  it("reads a call the model wrote as text, as SGLang's hermes parser passes Qwen3.6's calls", async () => {
    const cwd = await workspace();
    const model = standInModel([
      { content: "<tool_call>\n<function=write_file>\n<parameter=path>\na.txt\n</parameter>\n<parameter=content>\nx\n</parameter>\n</function>\n</tool_call>", tool_calls: null },
      { content: "Done." },
    ]);
    const adapter = new LocalLlmAcpAdapter({ settings: { baseUrl: "http://x" }, limits: {}, fetch: model.fetch, askBeforeCommands: false });
    const cmd = command(cwd);

    await collect(adapter.execute(adapter.buildInvocation(cmd), cmd, "go", new AbortController().signal));

    expect(await readFile(path.join(cwd, "a.txt"), "utf8")).toBe("x");
  });

  it("refuses a path outside the run's directory, and tells the model", async () => {
    const cwd = await workspace();
    const model = standInModel([{ tool_calls: call("write_file", { path: "../escaped.txt", content: "no" }) }, { content: "ok" }]);
    const adapter = new LocalLlmAcpAdapter({ settings: { baseUrl: "http://x" }, limits: {}, fetch: model.fetch, askBeforeCommands: false });
    const cmd = command(cwd);

    const events = await collect(adapter.execute(adapter.buildInvocation(cmd), cmd, "go", new AbortController().signal));

    expect(updates(events).find((u) => u.sessionUpdate === "tool_call_update")).toMatchObject({ status: "failed" });
    await expect(readFile(path.join(cwd, "..", "escaped.txt"), "utf8")).rejects.toThrow();
  });

  it("asks before a command where told to, and runs it only when allowed", async () => {
    const cwd = await workspace();
    const model = standInModel([{ tool_calls: call("run_command", { command: "node -e \"require('fs').writeFileSync('ran.txt','y')\"" }) }, { content: "ok" }]);
    const adapter = new LocalLlmAcpAdapter({ settings: { baseUrl: "http://x" }, limits: {}, fetch: model.fetch, askBeforeCommands: true });
    const cmd = command(cwd);

    const events = await collect(adapter.execute(adapter.buildInvocation(cmd), cmd, "go", new AbortController().signal), (event) => {
      if (event.kind === "permissionRequest") adapter.resolvePermission(cmd.runId, event.requestId, "allow");
    });

    expect(events.find((e) => e.kind === "permissionRequest")).toMatchObject({ description: expect.stringContaining("run_command node -e") });
    expect(await readFile(path.join(cwd, "ran.txt"), "utf8")).toBe("y");
  });

  it("does not run a command the person denied", async () => {
    const cwd = await workspace();
    const model = standInModel([{ tool_calls: call("run_command", { command: "node -e \"require('fs').writeFileSync('ran.txt','y')\"" }) }, { content: "ok" }]);
    const adapter = new LocalLlmAcpAdapter({ settings: { baseUrl: "http://x" }, limits: {}, fetch: model.fetch, askBeforeCommands: true });
    const cmd = command(cwd);

    const events = await collect(adapter.execute(adapter.buildInvocation(cmd), cmd, "go", new AbortController().signal), (event) => {
      if (event.kind === "permissionRequest") adapter.resolvePermission(cmd.runId, event.requestId, "deny");
    });

    expect(updates(events).find((u) => u.sessionUpdate === "tool_call_update")).toMatchObject({ status: "failed" });
    await expect(readFile(path.join(cwd, "ran.txt"), "utf8")).rejects.toThrow();
  });

  it("stops at the iteration limit and says so", async () => {
    const cwd = await workspace();
    const model = standInModel([{ tool_calls: call("list_dir", {}) }]);
    const adapter = new LocalLlmAcpAdapter({ settings: { baseUrl: "http://x" }, limits: { maxIterations: 2 }, fetch: model.fetch, askBeforeCommands: false });
    const cmd = command(cwd);

    const events = await collect(adapter.execute(adapter.buildInvocation(cmd), cmd, "go", new AbortController().signal));

    const said = updates(events).filter((u) => u.sessionUpdate === "agent_message_chunk").map((u) => (u.content as { text: string }).text).join("");
    expect(said).toContain("Stopped at the 2-iteration limit.");
    expect(model.requests.filter((r) => r.url.endsWith("/chat/completions"))).toHaveLength(2);
  });
});
