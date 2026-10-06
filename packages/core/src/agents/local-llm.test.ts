import { afterEach, describe, expect, it, vi } from "vitest";
import type { Command, Event } from "../protocol.js";
import { LocalLlmAdapter } from "./local-llm.js";

const command: Command = {
  kind: "implement",
  cwd: "/workspace/repo",
  runId: "run-5",
  context: { changeDir: "/workspace/repo/openspec/changes/x" },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LocalLlmAdapter", () => {
  it("builds an http invocation to the OpenAI-compatible chat completions endpoint", () => {
    const adapter = new LocalLlmAdapter({ baseUrl: "http://hppii-gpu:30000", model: "qwen" });
    expect(adapter.buildInvocation(command)).toEqual({
      kind: "http",
      url: "http://hppii-gpu:30000/v1/chat/completions",
      method: "POST",
    });
  });

  it("returns completion text and offers only web-research tools", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "Hello world" } }] }), { status: 200 })));

    const adapter = new LocalLlmAdapter({ baseUrl: "http://hppii-gpu:30000", model: "qwen" });
    const invocation = adapter.buildInvocation(command);
    const events: Event[] = [];
    for await (const e of adapter.execute(invocation, command, "FILE CONTENT HERE", new AbortController().signal)) {
      events.push(e);
    }

    expect(events.map((e) => e.kind)).toEqual(["started", "stdout", "stdout", "completed"]);
    expect((events[1] as { chunk: string }).chunk).toContain("Model qwen (named in the local LLM settings)");
    expect((events[2] as { chunk: string }).chunk).toBe("Hello world");
    expect((events[3] as { summary?: string }).summary).toBe("Hello world");

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsedBody = JSON.parse(init.body as string) as { messages: Array<{ content: string }>; tools: Array<{ function: { name: string } }> };
    expect(parsedBody.messages[1]?.content).toContain("FILE CONTENT HERE");
    expect(parsedBody.tools.map((tool) => tool.function.name)).toEqual(["search_web", "fetch_webpage"]);
  });

  it("returns a SearXNG artifact to the model and continues its answer", async () => {
    const requestBodies: Array<{ messages: Array<{ role: string; content: string }>; tools: Array<{ function: { name: string } }> }> = [];
    let completionTurn = 0;
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      if (new URL(input).pathname === "/search") {
        return new Response(JSON.stringify({ results: [{ title: "Source", url: "https://example.org/page", content: "Snippet" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      const body = JSON.parse(String(init?.body)) as (typeof requestBodies)[number];
      requestBodies.push(body);
      completionTurn += 1;
      const message = completionTurn === 1
        ? { content: "Searching", tool_calls: [{ id: "search-1", type: "function", function: { name: "search_web", arguments: '{"query":"OpenSpec"}' } }] }
        : { content: "Found Source." };
      return new Response(JSON.stringify({ choices: [{ message }] }), { status: 200 });
    });
    const adapter = new LocalLlmAdapter({ baseUrl: "http://hppii-gpu:30000", model: "qwen", searxngUrl: "http://search.local:8080", fetch: fetchMock });
    const events: Event[] = [];
    for await (const event of adapter.execute(adapter.buildInvocation(command), command, "Search", new AbortController().signal)) events.push(event);

    expect(events.at(-1)).toMatchObject({ kind: "completed", summary: "SearchingFound Source." });
    expect(events.some((event) => event.kind === "stdout" && event.chunk.includes("https://example.org/page"))).toBe(true);
    expect(requestBodies[0]?.tools.map((tool) => tool.function.name)).toEqual(["search_web", "fetch_webpage"]);
    expect(requestBodies[1]?.messages.at(-1)).toMatchObject({ role: "tool", content: expect.stringContaining("https://example.org/page") });
  });

  // the-local-llm-is-where-you-say: a server that wants a key, reached at
  // a base URL written with its /v1.
  it("sends its key as a bearer token to a base written with /v1, and none without a key", async () => {
    // A stream per call: one read to its end cannot be read again.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "" } }] }), { status: 200 })));
    const keyed = new LocalLlmAdapter({ baseUrl: "http://gpu.lan:8000/v1", model: "qwen", apiKey: "secret" });
    const keyless = new LocalLlmAdapter({ baseUrl: "http://gpu.lan:8000/v1", model: "qwen" });

    for (const adapter of [keyed, keyless]) {
      for await (const _event of adapter.execute(adapter.buildInvocation(command), command, "p", new AbortController().signal)) { /* drained */ }
    }

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const [keyedUrl, keyedInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const [, keylessInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(keyedUrl).toBe("http://gpu.lan:8000/v1/chat/completions");
    expect(keyedInit.headers).toEqual({ "content-type": "application/json", authorization: "Bearer secret" });
    expect(keylessInit.headers).toEqual({ "content-type": "application/json" });
  });

  it("completes on an empty assistant turn without crashing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: null, tool_calls: null } }], usage: null }), { status: 200 })));

    const adapter = new LocalLlmAdapter({ baseUrl: "http://hppii-gpu:30000", model: "qwen" });
    const invocation = adapter.buildInvocation(command);
    const events: Event[] = [];
    for await (const e of adapter.execute(invocation, command, "p", new AbortController().signal)) {
      events.push(e);
    }

    expect(events.map((e) => e.kind)).toEqual(["started", "stdout", "completed"]);
  });

  it("emits failed on non-ok HTTP response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("failure", { status: 500, statusText: "Internal Server Error" })),
    );

    const adapter = new LocalLlmAdapter({ baseUrl: "http://hppii-gpu:30000", model: "qwen" });
    const invocation = adapter.buildInvocation(command);
    const events: Event[] = [];
    for await (const e of adapter.execute(invocation, command, "p", new AbortController().signal)) {
      events.push(e);
    }

    expect(events.map((e) => e.kind)).toEqual(["started", "stdout", "failed"]);
    expect((events[2] as { reason: string }).reason).toContain("500");
  });

  it("emits failed when the network call itself throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const adapter = new LocalLlmAdapter({ baseUrl: "http://hppii-gpu:30000", model: "qwen" });
    const invocation = adapter.buildInvocation(command);
    const events: Event[] = [];
    for await (const e of adapter.execute(invocation, command, "p", new AbortController().signal)) {
      events.push(e);
    }

    expect(events.map((e) => e.kind)).toEqual(["started", "stdout", "failed"]);
    expect((events[2] as { reason: string }).reason).toBe("ECONNREFUSED");
  });
});
