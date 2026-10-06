// Adapter: the local LLM as a coding agent, run inside the product
// (local-llm-codes-in-process, ADR 0038).
//
// No process is started. The agent is an Agent Client Protocol agent built
// for each run (`createLocalAgent`) and driven by the shared
// `AcpSessionDriver`, so its text, tool calls, permission requests and
// usage reach the run as they do from an ACP CLI. It used to start an
// external `coding-agent` process, which a person had to find and install.

import type { AdapterInvocation, AgentAdapter } from "../agent-runner.js";
import type { FetchLike } from "../direct-fetch.js";
import type { LocalLlmAcpLimits, LocalLlmSettings } from "../local-llm-settings.js";
import type { Command, Event } from "../protocol.js";
import { AcpSessionDriver } from "./acp-session-driver.js";
import { createLocalAgent } from "./local-agent/acp-agent.js";
import { commandInstruction } from "./shared.js";

export interface LocalLlmAcpAdapterOptions {
  settings: LocalLlmSettings;
  limits: LocalLlmAcpLimits;
  fetch: FetchLike;
  searxngUrl?: string;
  askBeforeCommands: boolean;
}

export class LocalLlmAcpAdapter implements AgentAdapter {
  readonly name = "local-llm-acp";

  private readonly driver = new AcpSessionDriver();

  constructor(private readonly options: LocalLlmAcpAdapterOptions) { }

  buildInvocation(_command: Command): AdapterInvocation {
    return { kind: "in-process", agent: this.name };
  }

  async *execute(invocation: AdapterInvocation, command: Command, prompt: string, signal: AbortSignal): AsyncIterable<Event> {
    if (invocation.kind !== "in-process") {
      throw new Error("LocalLlmAcpAdapter expects invocation.kind === 'in-process'");
    }
    const target = createLocalAgent({
      settings: this.options.settings,
      ...(command.model !== undefined ? { stageModel: command.model } : {}),
      limits: this.options.limits,
      fetch: this.options.fetch,
      ...(this.options.searxngUrl !== undefined ? { searxngUrl: this.options.searxngUrl } : {}),
      askBeforeCommands: this.options.askBeforeCommands,
      signal,
    });
    yield* this.driver.run({
      target,
      cwd: command.cwd,
      runId: command.runId,
      commandKind: command.kind,
      prompt: `${commandInstruction(command.kind)}\n\n${prompt}`,
      signal,
    });
  }

  resolvePermission(runId: string, requestId: string, outcome: "allow" | "deny"): boolean {
    return this.driver.resolvePermission(runId, requestId, outcome);
  }
}
