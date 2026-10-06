// Adapter: a local LLM via an OpenAI-compatible API (SGLang/vLLM) — a
// direct HTTP call to `/v1/chat/completions` with `stream: true`, rather
// than a CLI process (see tasks.md 2.6). The stream is parsed line-by-line
// in SSE format (`data: {...}\n\n`); lines that do not match the expected
// format are passed through to `stdout` as-is — the same conservative
// parsing principle used by the CLI adapters (shared.ts).

import type { AdapterInvocation, AgentAdapter } from "../agent-runner.js";
import type { Command, Event } from "../protocol.js";
import { commandInstruction } from "./shared.js";
import type { FetchLike } from "../direct-fetch.js";
import { chatCompletionsUrl, describeLocalLlmModel, resolveLocalLlmModel } from "../local-llm-settings.js";
import { completeTurn, type ChatMessage } from "./local-agent/chat-client.js";
import { runWebResearchTool, WEB_RESEARCH_PARAMETER_TYPES, WEB_RESEARCH_TOOL_SCHEMAS } from "../web-research.js";

const MAX_WEB_TOOL_ITERATIONS = 10;
const MAX_WEB_TOOL_CALLS = 20;

function nowIso(): string {
  return new Date().toISOString();
}

export interface LocalLlmAdapterOptions {
  /** The server's base URL, with its `/v1` or without, e.g.
   * http://hppii-gpu:30000 or http://hppii-gpu:8000/v1. */
  baseUrl: string;
  /** Where the settings name one; otherwise the stage's, the server's or
   * `default` (`resolveLocalLlmModel`, local-llm-codes-in-process). */
  model?: string;
  /** Sent as a bearer token, and nowhere else (the-local-llm-is-where-you-say). */
  apiKey?: string;
  /** Optional configured SearXNG `/search` endpoint. */
  searxngUrl?: string;
  /** How the server is reached: directly where agents ignore the system
   * proxy (`localFetch`). The process's `fetch` where absent. */
  fetch?: FetchLike;
}

export class LocalLlmAdapter implements AgentAdapter {
  readonly name = "local-llm";

  constructor(private readonly options: LocalLlmAdapterOptions) { }

  buildInvocation(_command: Command): AdapterInvocation {
    return { kind: "http", url: chatCompletionsUrl(this.options.baseUrl), method: "POST" };
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

    const fetchImpl: FetchLike = this.options.fetch ?? ((input, init) => fetch(input, init));
    const model = await resolveLocalLlmModel(command.model, this.options, fetchImpl);
    yield { kind: "stdout", runId, timestamp: nowIso(), chunk: `${describeLocalLlmModel(model)}\n\n` };

    const messages: ChatMessage[] = [
      { role: "system", content: commandInstruction(kind) },
      { role: "user", content: prompt },
    ];
    let full = "";
    let toolCalls = 0;

    for (let iteration = 0; iteration < MAX_WEB_TOOL_ITERATIONS; iteration += 1) {
      if (signal.aborted) {
        yield { kind: "cancelled", runId, timestamp: nowIso() };
        return;
      }

      let turn;
      try {
        turn = await completeTurn({
          settings: this.options,
          model: model.model,
          fetch: fetchImpl,
          tools: WEB_RESEARCH_TOOL_SCHEMAS,
          parameterTypes: WEB_RESEARCH_PARAMETER_TYPES,
        }, messages, signal);
      } catch (err) {
        if (signal.aborted) {
          yield { kind: "cancelled", runId, timestamp: nowIso() };
          return;
        }
        yield { kind: "failed", runId, timestamp: nowIso(), reason: err instanceof Error ? err.message : String(err) };
        return;
      }

      if (turn.text) {
        full += turn.text;
        yield { kind: "stdout", runId, timestamp: nowIso(), chunk: turn.text };
      }
      messages.push({
        role: "assistant",
        content: turn.text,
        ...(turn.calls.length > 0
          ? { tool_calls: turn.calls.map((call) => ({ id: call.id, type: "function" as const, function: { name: call.name, arguments: JSON.stringify(call.arguments) } })) }
          : {}),
      });
      if (turn.calls.length === 0) {
        yield { kind: "completed", runId, timestamp: nowIso(), summary: full };
        return;
      }

      for (const call of turn.calls) {
        toolCalls += 1;
        if (toolCalls > MAX_WEB_TOOL_CALLS) {
          const reason = `Stopped at the ${MAX_WEB_TOOL_CALLS}-web-tool-call limit.`;
          yield { kind: "stdout", runId, timestamp: nowIso(), chunk: `\n${reason}` };
          yield { kind: "completed", runId, timestamp: nowIso(), summary: full || reason };
          return;
        }
        yield { kind: "stdout", runId, timestamp: nowIso(), chunk: `\n[${call.name}]\n` };
        const result = await runWebResearchTool(call.name, call.arguments, {
          fetch: fetchImpl,
          ...(this.options.searxngUrl !== undefined ? { searxngUrl: this.options.searxngUrl } : {}),
        }, signal);
        yield { kind: "stdout", runId, timestamp: nowIso(), chunk: `${result.output}\n` };
        messages.push({ role: "tool", tool_call_id: call.id, content: result.output });
      }
    }

    const reason = `Stopped at the ${MAX_WEB_TOOL_ITERATIONS}-iteration web-tool limit.`;
    yield { kind: "stdout", runId, timestamp: nowIso(), chunk: `\n${reason}` };
    yield { kind: "completed", runId, timestamp: nowIso(), summary: full || reason };
  }
}
