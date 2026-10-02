// The local agent as an Agent Client Protocol agent, run in process
// (local-llm-codes-in-process, ADR 0038 decision 1).
//
// `AcpSessionDriver.run()` connects to it as to any ACP agent, so a run
// reaches the same `agentUpdate`, `permissionRequest` and `usageReported`
// events, the same stop handling and the same audit as an ACP CLI. One app
// is built per run, with that run's abort signal: cancelling the run ends
// the loop at its next step and kills a command it is running.

import { AGENT_METHODS, CLIENT_METHODS, PROTOCOL_VERSION, agent, type AgentApp } from "@agentclientprotocol/sdk";
import type { FetchLike } from "../../direct-fetch.js";
import {
  describeLocalLlmModel,
  resolveLocalLlmModel,
  type LocalLlmAcpLimits,
  type LocalLlmSettings,
} from "../../local-llm-settings.js";
import { runAgentLoop, type LoopEvent, type StopReason } from "./agent-loop.js";
import type { ToolCall } from "./text-tool-calls.js";
import { TOOL_PARAMETER_TYPES, TOOL_SCHEMAS } from "./tools.js";

export interface LocalAgentOptions {
  settings: LocalLlmSettings;
  /** The stage's model, where it names one. */
  stageModel?: string;
  limits: LocalLlmAcpLimits;
  fetch: FetchLike;
  /** Ask through a permission request before each command. */
  askBeforeCommands: boolean;
  /** The run's signal: aborting it ends the loop. */
  signal: AbortSignal;
}

const TOOL_KINDS: Record<string, "read" | "edit" | "search" | "execute"> = {
  read_file: "read",
  list_dir: "read",
  write_file: "edit",
  replace_text: "edit",
  search_text: "search",
  run_command: "execute",
};

/** The protocol's stop reason for each way the loop ends. */
const STOP_REASONS: Record<StopReason, "end_turn" | "max_tokens" | "max_turn_requests" | "cancelled"> = {
  completed: "end_turn",
  cancelled: "cancelled",
  max_iterations: "max_turn_requests",
  max_tool_calls: "max_turn_requests",
  max_seconds: "max_turn_requests",
  max_prompt_tokens: "max_tokens",
  max_completion_tokens: "max_tokens",
  max_total_tokens: "max_tokens",
};

const TOOL_OUTPUT_SHOWN = 4000;

function toolTitle(call: ToolCall): string {
  for (const key of ["path", "command", "query"]) {
    const value = call.arguments[key];
    if (typeof value === "string" && value.length > 0) return `${call.name} ${value.length > 80 ? `${value.slice(0, 77)}...` : value}`;
  }
  return call.name;
}

/** The text of a prompt's content blocks: text blocks, and the text of an
 * embedded text resource. Images and audio are not readable by a text
 * model and are left out. */
function promptText(blocks: ReadonlyArray<unknown>): string {
  return blocks
    .map((block) => {
      if (typeof block !== "object" || block === null) return "";
      const record = block as { type?: unknown; text?: unknown; resource?: { text?: unknown } };
      if (record.type === "text" && typeof record.text === "string") return record.text;
      if (record.type === "resource" && typeof record.resource?.text === "string") return record.resource.text;
      return "";
    })
    .filter((part) => part.length > 0)
    .join("\n\n");
}

/** Builds the agent for one run. */
export function createLocalAgent(options: LocalAgentOptions): AgentApp {
  const sessions = new Map<string, { cwd: string }>();
  let sessionCount = 0;

  return agent({ name: "openspec-workbench-local-agent" })
    .onRequest(AGENT_METHODS.initialize, () => ({
      protocolVersion: PROTOCOL_VERSION,
      agentCapabilities: { loadSession: false, promptCapabilities: { image: false, audio: false, embeddedContext: true } },
      authMethods: [],
    }))
    .onRequest(AGENT_METHODS.session_new, ({ params }) => {
      sessionCount += 1;
      const sessionId = `local-${sessionCount}`;
      sessions.set(sessionId, { cwd: params.cwd });
      return { sessionId };
    })
    .onNotification(AGENT_METHODS.session_cancel, () => {
      // The run's own signal is what ends the loop; the driver aborts it
      // when it is asked to cancel.
    })
    .onRequest(AGENT_METHODS.session_prompt, async ({ params, client }) => {
      const session = sessions.get(params.sessionId);
      if (session === undefined) throw new Error(`Unknown session ${params.sessionId}`);
      const say = (text: string) =>
        client.notify(CLIENT_METHODS.session_update, {
          sessionId: params.sessionId,
          update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text } },
        });

      const model = await resolveLocalLlmModel(options.stageModel, options.settings, options.fetch);
      await say(`${describeLocalLlmModel(model)}\n\n`);

      const onEvent = async (event: LoopEvent) => {
        if (event.type === "text") {
          await say(event.text);
        } else if (event.type === "tool_call") {
          await client.notify(CLIENT_METHODS.session_update, {
            sessionId: params.sessionId,
            update: {
              sessionUpdate: "tool_call",
              toolCallId: event.call.id,
              title: toolTitle(event.call),
              kind: TOOL_KINDS[event.call.name] ?? "other",
              status: "in_progress",
              rawInput: event.call.arguments,
            },
          });
        } else if (event.type === "tool_result") {
          const output = event.result.output.length > TOOL_OUTPUT_SHOWN
            ? `${event.result.output.slice(0, TOOL_OUTPUT_SHOWN)}\n... (${event.result.output.length - TOOL_OUTPUT_SHOWN} more characters)`
            : event.result.output;
          await client.notify(CLIENT_METHODS.session_update, {
            sessionId: params.sessionId,
            update: {
              sessionUpdate: "tool_call_update",
              toolCallId: event.call.id,
              status: event.result.failed ? "failed" : "completed",
              content: [{ type: "content", content: { type: "text", text: output } }],
            },
          });
        }
      };

      const allowCommand = options.askBeforeCommands
        ? async (command: string): Promise<boolean> => {
          const answer = await client.request(CLIENT_METHODS.session_request_permission, {
            sessionId: params.sessionId,
            toolCall: { toolCallId: `permission-${Date.now()}`, title: `run_command ${command}`, kind: "execute", rawInput: { command } },
            options: [
              { optionId: "allow", name: "Allow", kind: "allow_once" },
              { optionId: "deny", name: "Deny", kind: "reject_once" },
            ],
          });
          return answer.outcome.outcome === "selected" && answer.outcome.optionId === "allow";
        }
        : undefined;

      const result = await runAgentLoop(promptText(params.prompt), {
        chat: {
          settings: options.settings,
          model: model.model,
          fetch: options.fetch,
          tools: TOOL_SCHEMAS,
          parameterTypes: TOOL_PARAMETER_TYPES,
          ...(options.limits.maxCompletionTokens !== undefined ? { maxCompletionTokens: options.limits.maxCompletionTokens } : {}),
        },
        cwd: session.cwd,
        limits: options.limits,
        onEvent,
        ...(allowCommand !== undefined ? { allowCommand } : {}),
        signal: options.signal,
      });

      // A stop the model did not write is still said to the person.
      if (result.stopReason !== "completed") await say(`\n\n${result.message}`);
      return {
        stopReason: STOP_REASONS[result.stopReason],
        ...(result.usage.reported
          ? { usage: { inputTokens: result.usage.promptTokens, outputTokens: result.usage.completionTokens, totalTokens: result.usage.totalTokens } }
          : {}),
        _meta: { localAgent: { stoppedReason: result.stopReason, model: model.model, modelSource: model.source } },
      };
    });
}
