// Adapter: a local LLM via an OpenAI-compatible API (SGLang/vLLM) — a
// direct HTTP call to `/v1/chat/completions` with `stream: true`, rather
// than a CLI process (see tasks.md 2.6). The stream is parsed line-by-line
// in SSE format (`data: {...}\n\n`); lines that do not match the expected
// format are passed through to `stdout` as-is — the same conservative
// parsing principle used by the CLI adapters (shared.ts).

import type { AdapterInvocation, AgentAdapter } from "../agent-runner.js";
import type { Command, Event } from "../protocol.js";
import { commandInstruction } from "./shared.js";

function nowIso(): string {
  return new Date().toISOString();
}

export interface LocalLlmAdapterOptions {
  /** The server's base URL, e.g. http://hppii-gpu:30000. */
  baseUrl: string;
  model: string;
}

interface ChatCompletionChunk {
  choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>;
}

function isChatCompletionChunk(value: unknown): value is ChatCompletionChunk {
  return typeof value === "object" && value !== null;
}

export class LocalLlmAdapter implements AgentAdapter {
  readonly name = "local-llm";

  constructor(private readonly options: LocalLlmAdapterOptions) {}

  buildInvocation(_command: Command): AdapterInvocation {
    return { kind: "http", url: `${this.options.baseUrl}/v1/chat/completions`, method: "POST" };
  }

  async *execute(invocation: AdapterInvocation, command: Command, prompt: string, signal: AbortSignal): AsyncIterable<Event> {
    if (invocation.kind !== "http") {
      throw new Error("LocalLlmAdapter expects invocation.kind === 'http'");
    }
    const { runId, cwd, kind } = command;

    // An already-aborted signal never reaches a request at all — mirrors
    // spawnAndStream's own "cancellation requested before the process
    // starts" behavior for the subprocess adapters.
    if (signal.aborted) {
      yield { kind: "cancelled", runId, timestamp: nowIso() };
      return;
    }

    yield { kind: "started", runId, timestamp: nowIso(), command: kind, cwd };

    let response: Response;
    try {
      response = await fetch(invocation.url, {
        method: invocation.method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: this.options.model,
          stream: true,
          messages: [
            { role: "system", content: commandInstruction(kind) },
            { role: "user", content: prompt },
          ],
        }),
        signal,
      });
    } catch (err) {
      if (signal.aborted) {
        yield { kind: "cancelled", runId, timestamp: nowIso() };
        return;
      }
      yield { kind: "failed", runId, timestamp: nowIso(), reason: err instanceof Error ? err.message : String(err) };
      return;
    }

    if (!response.ok || !response.body) {
      yield { kind: "failed", runId, timestamp: nowIso(), reason: `HTTP ${response.status} ${response.statusText}` };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let full = "";

    try {
      while (true) {
        if (signal.aborted) {
          yield { kind: "cancelled", runId, timestamp: nowIso() };
          return;
        }
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          if (signal.aborted) {
            yield { kind: "cancelled", runId, timestamp: nowIso() };
            return;
          }
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (line.length === 0) continue;
          if (!line.startsWith("data:")) {
            yield { kind: "stdout", runId, timestamp: nowIso(), chunk: line + "\n" };
            continue;
          }
          const payload = line.slice("data:".length).trim();
          if (payload === "[DONE]") continue;
          let parsed: unknown;
          try {
            parsed = JSON.parse(payload);
          } catch {
            yield { kind: "stdout", runId, timestamp: nowIso(), chunk: line + "\n" };
            continue;
          }
          if (!isChatCompletionChunk(parsed)) {
            yield { kind: "stdout", runId, timestamp: nowIso(), chunk: line + "\n" };
            continue;
          }
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            full += content;
            yield { kind: "stdout", runId, timestamp: nowIso(), chunk: content };
          }
        }
      }
    } catch (err) {
      if (signal.aborted) {
        yield { kind: "cancelled", runId, timestamp: nowIso() };
        return;
      }
      yield { kind: "failed", runId, timestamp: nowIso(), reason: err instanceof Error ? err.message : String(err) };
      return;
    }

    yield { kind: "completed", runId, timestamp: nowIso(), summary: full };
  }
}
