// One model turn against an OpenAI-compatible `/v1/chat/completions`, with
// tools (local-llm-codes-in-process).
//
// Read as servers send it, not as the schema says: SGLang answers a turn
// that calls no tool with `"tool_calls": null` and may send `"usage":
// null`; a call's arguments may be null. A call the server's parser did not
// recognise is read from the text (`toolCallsInText`).

import type { FetchLike } from "../../direct-fetch.js";
import { chatCompletionsUrl, localLlmHeaders, type LocalLlmSettings } from "../../local-llm-settings.js";
import { toolCallsInText, type ParameterTypes, type ToolCall } from "./text-tool-calls.js";
import type { ToolSchema } from "./tools.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

export interface TurnUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface AssistantTurn {
  text: string;
  calls: ToolCall[];
  usage: TurnUsage;
}

export interface ChatClientOptions {
  settings: Pick<LocalLlmSettings, "baseUrl" | "apiKey">;
  model: string;
  fetch: FetchLike;
  tools: readonly ToolSchema[];
  parameterTypes: ParameterTypes;
  maxCompletionTokens?: number;
}

function count(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "object" && part !== null && typeof (part as { text?: unknown }).text === "string" ? (part as { text: string }).text : ""))
      .filter((part) => part.length > 0)
      .join("\n");
  }
  return "";
}

/** Asks the model for its next turn. Throws on a transport failure or a
 * non-2xx answer, with the status and the start of the body. */
export async function completeTurn(options: ChatClientOptions, messages: readonly ChatMessage[], signal?: AbortSignal): Promise<AssistantTurn> {
  const body: Record<string, unknown> = {
    model: options.model,
    messages,
    tools: options.tools,
    tool_choice: "auto",
  };
  if (options.maxCompletionTokens !== undefined) body.max_tokens = options.maxCompletionTokens;
  const response = await options.fetch(chatCompletionsUrl(options.settings.baseUrl), {
    method: "POST",
    headers: localLlmHeaders(options.settings),
    body: JSON.stringify(body),
    ...(signal !== undefined ? { signal } : {}),
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    throw new Error(`HTTP ${response.status} ${response.statusText}${detail ? `: ${detail}` : ""}`);
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown; tool_calls?: unknown } }>;
    usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; total_tokens?: unknown } | null;
  };
  const message = data.choices?.[0]?.message ?? {};
  let text = textOf(message.content);
  let calls: ToolCall[] = [];
  const rawCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
  rawCalls.forEach((raw: unknown, index) => {
    if (typeof raw !== "object" || raw === null) return;
    const record = raw as { id?: unknown; function?: { name?: unknown; arguments?: unknown } | null };
    const fn = record.function ?? {};
    if (typeof fn.name !== "string" || fn.name.length === 0) return;
    let args: unknown = fn.arguments ?? {};
    if (typeof args === "string") {
      try {
        args = args.trim().length > 0 ? JSON.parse(args) : {};
      } catch {
        args = {};
      }
    }
    calls.push({
      id: typeof record.id === "string" && record.id.length > 0 ? record.id : `call-${index + 1}`,
      name: fn.name,
      arguments: typeof args === "object" && args !== null && !Array.isArray(args) ? (args as Record<string, unknown>) : {},
    });
  });
  if (calls.length === 0) {
    const fromText = toolCallsInText(text, options.parameterTypes);
    calls = fromText.calls;
    text = fromText.text;
  }
  const usage = data.usage ?? {};
  return {
    text,
    calls,
    usage: {
      ...(count(usage.prompt_tokens) !== undefined ? { promptTokens: count(usage.prompt_tokens) } : {}),
      ...(count(usage.completion_tokens) !== undefined ? { completionTokens: count(usage.completion_tokens) } : {}),
      ...(count(usage.total_tokens) !== undefined ? { totalTokens: count(usage.total_tokens) } : {}),
    },
  };
}
