// ACP-flavored adapter: Gemini CLI's native Agent Client Protocol server
// (`gemini --experimental-acp` — documented as a native flag in Google's
// own docs, geminicli.com/docs/cli/acp-mode; NOT live-verified on this
// machine, `gemini` is not installed here — see ADR 0013/design.md's
// "gemini-cli-acp's ... permission-relay is assumed, not yet
// live-verified"). Additional, not a replacement for `gemini-cli`
// (gemini.ts) — see design.md, "ACP-flavored adapters are new,
// additional AgentAdapters".
//
// Unlike the raw-text `gemini-cli` adapter, this one deliberately does
// NOT pass `--yolo`: pre-granting every tool would mean `gemini` never
// calls `session/request_permission` at all, for the same reason
// copilot-acp.ts's own header comment gives for omitting
// `--allow-all-tools`/`--yolo` there.

import type { AdapterInvocation, AgentAdapter } from "../agent-runner.js";
import type { Command, Event } from "../protocol.js";
import { AcpSessionDriver } from "./acp-session-driver.js";
import { commandInstruction } from "./shared.js";

export class GeminiCliAcpAdapter implements AgentAdapter {
  readonly name = "gemini-cli-acp";

  private readonly driver = new AcpSessionDriver();

  buildInvocation(_command: Command): AdapterInvocation {
    // No model/effort/budget flag rendered here, for the same reason
    // gemini.ts's raw-text adapter renders none: gemini has no
    // command-line reasoning-effort/spending-cap mechanism (see
    // gemini.ts's own comment) — this ACP-flavored counterpart has no
    // additional mechanism for them either.
    return { kind: "process", executable: "gemini", args: ["--experimental-acp"] };
  }

  async *execute(invocation: AdapterInvocation, command: Command, prompt: string, signal: AbortSignal): AsyncIterable<Event> {
    if (invocation.kind !== "process") {
      throw new Error("GeminiCliAcpAdapter expects invocation.kind === 'process'");
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
