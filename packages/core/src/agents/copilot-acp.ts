// ACP-flavored adapter: GitHub Copilot CLI's native Agent Client Protocol
// server (`copilot --acp`, confirmed present in `copilot --help` — "Start
// as Agent Client Protocol server", GitHub Copilot CLI v1.0.78; see ADR
// 0013). Additional, not a replacement for `copilot-cli` (copilot.ts) —
// see design.md, "ACP-flavored adapters are new, additional
// AgentAdapters".
//
// Unlike the raw-text `copilot-cli` adapter, this one deliberately does
// NOT pass `--allow-all-tools`/`--yolo`: pre-granting every tool would
// mean `copilot` never calls `session/request_permission` at all, which
// defeats the entire reason this adapter exists (see proposal.md,
// "`copilot-cli` is currently unusable in this repository today" —
// `session/request_permission` is the one documented path back to a
// usable agent). The full prompt (including `commandInstruction`) is
// delivered whole via the ACP `session/prompt` message, over stdio — no
// argv length cap applies here, so `MAX_ARGV_PROMPT_LENGTH`/
// `buildFallbackPrompt` from copilot.ts do not apply and are not reused
// (see copilot.ts, unmodified by this change).

import type { AdapterInvocation, AgentAdapter } from "../agent-runner.js";
import type { Command, Event } from "../protocol.js";
import { AcpSessionDriver } from "./acp-session-driver.js";
import { commandInstruction } from "./shared.js";

export class CopilotCliAcpAdapter implements AgentAdapter {
  readonly name = "copilot-cli-acp";

  private readonly driver = new AcpSessionDriver();

  buildInvocation(command: Command): AdapterInvocation {
    const args = ["--acp"];
    if (command.model) args.push("--model", command.model);
    if (command.effort) args.push("--effort", command.effort);
    if (command.budget?.maxAiCredits !== undefined) args.push("--max-ai-credits", String(command.budget.maxAiCredits));
    return { kind: "process", executable: "copilot", args };
  }

  async *execute(invocation: AdapterInvocation, command: Command, prompt: string, signal: AbortSignal): AsyncIterable<Event> {
    if (invocation.kind !== "process") {
      throw new Error("CopilotCliAcpAdapter expects invocation.kind === 'process'");
    }
    yield* this.driver.runProcess({
      executable: invocation.executable,
      args: invocation.args,
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
