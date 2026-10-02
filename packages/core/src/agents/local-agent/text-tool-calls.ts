// Tool calls a model wrote into its text (local-llm-codes-in-process, ADR
// 0038 decision 4).
//
// A server whose tool-call parser does not match the model passes the
// model's calls through as text in `content`, with `tool_calls` empty.
// Measured 2026-10-01 against SGLang with `--tool-call-parser hermes`
// serving Qwen3.6, which writes Qwen3-Coder's form: 0 of 6 calls came back
// structured. Ported from `coding-agent`'s `tool_calls_in_text`, verified
// live the same day.

/** A call the agent loop runs: the id it answers with, the tool, its
 * arguments. */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** Each offered tool's name, with the JSON type of each parameter. */
export type ParameterTypes = ReadonlyMap<string, Readonly<Record<string, string>>>;

const TOOL_CALL_BLOCK = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
const XML_FUNCTION = /<function=([^>\s]+)>([\s\S]*?)<\/function>/;
const XML_PARAMETER = /<parameter=([^>\s]+)>([\s\S]*?)<\/parameter>/g;

/** The calls written inside `<tool_call>` in Qwen3-Coder's
 * `<function=name><parameter=p>value</parameter>` form or as Hermes'
 * `{"name": ..., "arguments": ...}`, and the text without them. Only a call
 * to an offered tool is taken; anything else stays text. */
export function toolCallsInText(content: string, known: ParameterTypes): { calls: ToolCall[]; text: string } {
  const calls: ToolCall[] = [];
  const taken: Array<[number, number]> = [];
  for (const block of content.matchAll(TOOL_CALL_BLOCK)) {
    const call = parseCall(block[1] ?? "", known, calls.length + 1);
    if (call !== undefined && block.index !== undefined) {
      calls.push(call);
      taken.push([block.index, block.index + block[0].length]);
    }
  }
  if (calls.length === 0) return { calls, text: content };
  let text = content;
  for (const [start, end] of [...taken].reverse()) text = text.slice(0, start) + text.slice(end);
  return { calls, text: text.trim() };
}

function parseCall(body: string, known: ParameterTypes, index: number): ToolCall | undefined {
  let name: string;
  let args: Record<string, unknown>;
  const fn = XML_FUNCTION.exec(body);
  if (fn) {
    name = fn[1] ?? "";
    const types = known.get(name) ?? {};
    args = {};
    for (const parameter of (fn[2] ?? "").matchAll(XML_PARAMETER)) {
      const key = parameter[1] ?? "";
      args[key] = parameterValue(parameter[2] ?? "", types[key] ?? "string");
    }
  } else {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return undefined;
    }
    if (typeof parsed !== "object" || parsed === null) return undefined;
    const record = parsed as { name?: unknown; arguments?: unknown };
    if (typeof record.name !== "string") return undefined;
    name = record.name;
    let raw = record.arguments ?? {};
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        return undefined;
      }
    }
    args = typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  }
  if (!known.has(name)) return undefined;
  return { id: `text-call-${index}`, name, arguments: args };
}

/** A parameter's text, without the newline the format puts around it. Read
 * as JSON only where the tool declares an array or an object: a file's
 * content that looks like JSON is still the text to write. */
function parameterValue(raw: string, jsonType: string): unknown {
  let value = raw.startsWith("\n") ? raw.slice(1) : raw;
  value = value.endsWith("\n") ? value.slice(0, -1) : value;
  if (jsonType === "array" || jsonType === "object") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}
