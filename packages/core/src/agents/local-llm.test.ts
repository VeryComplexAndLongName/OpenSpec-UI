import { afterEach, describe, expect, it, vi } from "vitest";
import type { Command, Event } from "../protocol.js";
import { LocalLlmAdapter } from "./local-llm.js";

const command: Command = {
  kind: "implement",
  cwd: "/workspace/repo",
  runId: "run-5",
  context: { changeDir: "/workspace/repo/openspec/changes/x" },
};

function sseStream(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(line + "\n"));
      }
      controller.close();
    },
  });
}

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

  it("streams SSE deltas as stdout and emits completed with the accumulated summary", async () => {
    const body = sseStream([
      'data: {"choices":[{"delta":{"content":"Hello"}}]}',
      "",
      'data: {"choices":[{"delta":{"content":" world"}}]}',
      "",
      "data: [DONE]",
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: "OK", body }),
    );

    const adapter = new LocalLlmAdapter({ baseUrl: "http://hppii-gpu:30000", model: "qwen" });
    const invocation = adapter.buildInvocation(command);
    const events: Event[] = [];
    for await (const e of adapter.execute(invocation, command, "FILE CONTENT HERE", new AbortController().signal)) {
      events.push(e);
    }

    expect(events.map((e) => e.kind)).toEqual(["started", "stdout", "stdout", "completed"]);
    expect((events[1] as { chunk: string }).chunk).toBe("Hello");
    expect((events[2] as { chunk: string }).chunk).toBe(" world");
    expect((events[3] as { summary?: string }).summary).toBe("Hello world");

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsedBody = JSON.parse(init.body as string) as { messages: Array<{ content: string }> };
    expect(parsedBody.messages[1]?.content).toContain("FILE CONTENT HERE");
  });

  // the-local-llm-is-where-you-say: a server that wants a key, reached at
  // a base URL written with its /v1.
  it("sends its key as a bearer token to a base written with /v1, and none without a key", async () => {
    // A stream per call: one read to its end cannot be read again.
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => ({ ok: true, status: 200, statusText: "OK", body: sseStream(["data: [DONE]"]) })));
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

  it("passes through malformed SSE payloads as stdout without crashing", async () => {
    const body = sseStream(["not-a-data-line", "data: not-json", "data: [DONE]"]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: "OK", body }));

    const adapter = new LocalLlmAdapter({ baseUrl: "http://hppii-gpu:30000", model: "qwen" });
    const invocation = adapter.buildInvocation(command);
    const events: Event[] = [];
    for await (const e of adapter.execute(invocation, command, "p", new AbortController().signal)) {
      events.push(e);
    }

    expect(events.map((e) => e.kind)).toEqual(["started", "stdout", "stdout", "completed"]);
  });

  it("emits failed on non-ok HTTP response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: "Internal Server Error", body: null }),
    );

    const adapter = new LocalLlmAdapter({ baseUrl: "http://hppii-gpu:30000", model: "qwen" });
    const invocation = adapter.buildInvocation(command);
    const events: Event[] = [];
    for await (const e of adapter.execute(invocation, command, "p", new AbortController().signal)) {
      events.push(e);
    }

    expect(events.map((e) => e.kind)).toEqual(["started", "failed"]);
    expect((events[1] as { reason: string }).reason).toContain("500");
  });

  it("emits failed when the network call itself throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const adapter = new LocalLlmAdapter({ baseUrl: "http://hppii-gpu:30000", model: "qwen" });
    const invocation = adapter.buildInvocation(command);
    const events: Event[] = [];
    for await (const e of adapter.execute(invocation, command, "p", new AbortController().signal)) {
      events.push(e);
    }

    expect(events.map((e) => e.kind)).toEqual(["started", "failed"]);
    expect((events[1] as { reason: string }).reason).toBe("ECONNREFUSED");
  });
});
