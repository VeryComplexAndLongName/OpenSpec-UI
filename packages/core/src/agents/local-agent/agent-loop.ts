// The local agent's loop (local-llm-codes-in-process, ADR 0038 decision 1):
// ask the model, run the tools it calls, give it their results, until it
// answers without a call or a limit stops it. Ported from `coding-agent`'s
// `CodingAgent.run_prompt`.

import type { LocalLlmAcpLimits } from "../../local-llm-settings.js";
import { completeTurn, type ChatClientOptions, type ChatMessage, type TurnUsage } from "./chat-client.js";
import type { ToolCall } from "./text-tool-calls.js";
import { DEFAULT_TOOL_LIMITS, runTool, type ToolResult } from "./tools.js";
import type { WebResearchOptions } from "../../web-research.js";

export const SYSTEM_PROMPT =
  "You are a coding agent working in a repository. Use the tools to read, change and verify files; "
  + "every path is relative to the working directory, and nothing outside it can be reached. "
  + "Run the commands that check your work. When the task is done, or cannot be done, end your turn with a "
  + "concise summary of what you did and what is left.";

const DEFAULT_MAX_ITERATIONS = 40;
const DEFAULT_MAX_TOOL_CALLS = 120;
const DEFAULT_MAX_SECONDS = 1800;

/** Why the loop ended: `completed`, or the limit that ended it. */
export type StopReason =
  | "completed"
  | "cancelled"
  | "max_iterations"
  | "max_tool_calls"
  | "max_seconds"
  | "max_prompt_tokens"
  | "max_completion_tokens"
  | "max_total_tokens";

export type LoopEvent =
  | { type: "text"; text: string }
  | { type: "tool_call"; call: ToolCall }
  | { type: "tool_result"; call: ToolCall; result: ToolResult }
  | { type: "usage"; usage: TurnUsage };

export interface LoopOptions {
  chat: ChatClientOptions;
  cwd: string;
  limits: LocalLlmAcpLimits;
  onEvent: (event: LoopEvent) => Promise<void> | void;
  /** Asked before `run_command` where the host said to ask; false means
   * the command is not run, and the model is told so. */
  allowCommand?: (command: string) => Promise<boolean>;
  signal?: AbortSignal;
  webResearch?: WebResearchOptions;
  /** A clock, for tests. */
  now?: () => number;
}

export interface LoopResult {
  stopReason: StopReason;
  message: string;
  usage: Required<TurnUsage> & { reported: boolean };
}

function exceeded(limit: number | undefined, value: number): boolean {
  return limit !== undefined && value > limit;
}

/** Runs one prompt to its end. */
export async function runAgentLoop(prompt: string, options: LoopOptions): Promise<LoopResult> {
  const now = options.now ?? Date.now;
  const started = now();
  const limits = options.limits;
  const maxIterations = limits.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const maxToolCalls = limits.maxToolCalls ?? DEFAULT_MAX_TOOL_CALLS;
  const maxSeconds = limits.maxSeconds ?? DEFAULT_MAX_SECONDS;
  const toolLimits = {
    commandTimeoutSeconds: limits.commandTimeoutSeconds ?? DEFAULT_TOOL_LIMITS.commandTimeoutSeconds,
    maxCommandOutputChars: limits.maxCommandOutputChars ?? DEFAULT_TOOL_LIMITS.maxCommandOutputChars,
  };
  const usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, reported: false };
  const end = (stopReason: StopReason, message: string): LoopResult => ({ stopReason, message, usage });

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: prompt },
  ];
  let toolCalls = 0;

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    if (options.signal?.aborted) return end("cancelled", "The run was cancelled.");
    if ((now() - started) / 1000 > maxSeconds) return end("max_seconds", `Stopped at the ${maxSeconds} s limit.`);

    const turn = await completeTurn(options.chat, messages, options.signal);
    if (turn.usage.promptTokens !== undefined || turn.usage.completionTokens !== undefined || turn.usage.totalTokens !== undefined) {
      usage.reported = true;
      usage.promptTokens += turn.usage.promptTokens ?? 0;
      usage.completionTokens += turn.usage.completionTokens ?? 0;
      usage.totalTokens += turn.usage.totalTokens ?? (turn.usage.promptTokens ?? 0) + (turn.usage.completionTokens ?? 0);
      await options.onEvent({ type: "usage", usage: turn.usage });
    }
    if (turn.text.trim().length > 0) await options.onEvent({ type: "text", text: turn.text });

    messages.push({
      role: "assistant",
      content: turn.text,
      ...(turn.calls.length > 0
        ? { tool_calls: turn.calls.map((call) => ({ id: call.id, type: "function" as const, function: { name: call.name, arguments: JSON.stringify(call.arguments) } })) }
        : {}),
    });

    if (exceeded(limits.maxPromptTokens, usage.promptTokens)) return end("max_prompt_tokens", `Stopped at the ${limits.maxPromptTokens}-token prompt limit.`);
    if (exceeded(limits.maxCompletionTokens, usage.completionTokens)) return end("max_completion_tokens", `Stopped at the ${limits.maxCompletionTokens}-token completion limit.`);
    if (exceeded(limits.maxTotalTokens, usage.totalTokens)) return end("max_total_tokens", `Stopped at the ${limits.maxTotalTokens}-token total limit.`);

    if (turn.calls.length === 0) return end("completed", turn.text.trim() || "Completed with an empty answer.");

    for (const call of turn.calls) {
      if (options.signal?.aborted) return end("cancelled", "The run was cancelled.");
      toolCalls += 1;
      if (toolCalls > maxToolCalls) return end("max_tool_calls", `Stopped at the ${maxToolCalls}-tool-call limit.`);
      await options.onEvent({ type: "tool_call", call });
      let result: ToolResult;
      if (call.name === "run_command" && options.allowCommand !== undefined
        && !(await options.allowCommand(typeof call.arguments.command === "string" ? call.arguments.command : ""))) {
        result = { output: "The person did not allow this command; it was not run.", failed: true };
      } else {
        result = await runTool(call.name, call.arguments, options.cwd, toolLimits, options.signal, options.webResearch);
      }
      await options.onEvent({ type: "tool_result", call, result });
      messages.push({ role: "tool", tool_call_id: call.id, content: result.output });
    }
  }
  return end("max_iterations", `Stopped at the ${maxIterations}-iteration limit.`);
}
