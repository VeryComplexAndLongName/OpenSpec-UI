// Adapter: Gemini CLI (`gemini`). Non-interactive mode, the prompt is fed
// in via stdin (see claude.ts for the same pattern).

import type { AdapterInvocation, AgentAdapter } from "../agent-runner.js";
import type { Command, Event } from "../protocol.js";
import { commandInstruction, spawnAndStream } from "./shared.js";

export class GeminiCliAdapter implements AgentAdapter {
  readonly name = "gemini-cli";

  buildInvocation(_command: Command): AdapterInvocation {
    // No effort or budget flag is rendered here: gemini has no
    // command-line reasoning-effort control (only the interactive
    // `/model` menu) and no spending-cap mechanism. `harness-config.ts`
    // already refuses either setting for this agent at configuration
    // time — see harness-step-effort-and-budget design.md, "An agent
    // that cannot express a setting refuses it" — so `command.effort`/
    // `command.budget` should never actually be set here in practice.
    return { kind: "process", executable: "gemini", args: ["--yolo"] };
  }

  async *execute(invocation: AdapterInvocation, command: Command, prompt: string, signal: AbortSignal): AsyncIterable<Event> {
    if (invocation.kind !== "process") {
      throw new Error("GeminiCliAdapter expects invocation.kind === 'process'");
    }
    yield* spawnAndStream({
      executable: invocation.executable,
      args: invocation.args,
      cwd: command.cwd,
      runId: command.runId,
      commandKind: command.kind,
      stdin: `${commandInstruction(command.kind)}\n\n${prompt}`,
      signal,
    });
  }
}
