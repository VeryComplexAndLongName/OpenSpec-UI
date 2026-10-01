import type { AdapterInvocation, AgentAdapter } from "../agent-runner.js";
import type { Command, Event } from "../protocol.js";
import type { LocalLlmAcpLimits } from "../local-llm-settings.js";
import { AcpSessionDriver } from "./acp-session-driver.js";
import { commandInstruction } from "./shared.js";

export interface LocalLlmAcpAdapterOptions {
  executable: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  limits: LocalLlmAcpLimits;
}

export class LocalLlmAcpAdapter implements AgentAdapter {
  readonly name = "local-llm-acp";

  private readonly driver = new AcpSessionDriver();

  constructor(private readonly options: LocalLlmAcpAdapterOptions) { }

  buildInvocation(_command: Command): AdapterInvocation {
    const args = [
      "acp",
      "--base-url",
      this.options.baseUrl,
      "--model",
      this.options.model,
      ...renderLimits(this.options.limits),
    ];
    return { kind: "process", executable: this.options.executable, args };
  }

  async *execute(invocation: AdapterInvocation, command: Command, prompt: string, signal: AbortSignal): AsyncIterable<Event> {
    if (invocation.kind !== "process") {
      throw new Error("LocalLlmAcpAdapter expects invocation.kind === 'process'");
    }

    const env: Record<string, string> = {
      CODING_AGENT_BASE_URL: this.options.baseUrl,
      CODING_AGENT_MODEL: this.options.model,
    };
    if (this.options.apiKey !== undefined) {
      env.CODING_AGENT_API_KEY = this.options.apiKey;
    }

    yield* this.driver.runProcess({
      executable: invocation.executable,
      args: invocation.args,
      cwd: command.cwd,
      runId: command.runId,
      commandKind: command.kind,
      prompt: `${commandInstruction(command.kind)}\n\n${prompt}`,
      signal,
      env,
    });
  }

  resolvePermission(runId: string, requestId: string, outcome: "allow" | "deny"): boolean {
    return this.driver.resolvePermission(runId, requestId, outcome);
  }
}

function renderLimits(limits: LocalLlmAcpLimits): string[] {
  const args: string[] = [];
  const append = (flag: string, value: number | undefined) => {
    if (value !== undefined) args.push(flag, String(value));
  };

  append("--max-iterations", limits.maxIterations);
  append("--max-tool-calls", limits.maxToolCalls);
  append("--max-seconds", limits.maxSeconds);
  append("--command-timeout-seconds", limits.commandTimeoutSeconds);
  append("--max-command-output-chars", limits.maxCommandOutputChars);
  append("--max-prompt-tokens", limits.maxPromptTokens);
  append("--max-completion-tokens", limits.maxCompletionTokens);
  append("--max-total-tokens", limits.maxTotalTokens);
  append("--max-context-used-tokens", limits.maxContextUsedTokens);
  append("--max-context-window-tokens", limits.maxContextWindowTokens);
  append("--max-context-share", limits.maxContextShare);
  append("--min-free-context-tokens", limits.minFreeContextTokens);

  return args;
}
