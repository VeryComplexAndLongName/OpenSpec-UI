// Adapter: Claude CLI (`claude`). Non-interactive print mode (`-p`), the
// prompt is fed in as an argument, cwd is the process's working directory.
// The CLI's output format can change between versions — it is not parsed
// structurally, it is passed through as `stdout`/`stderr` as-is (see
// shared.ts).

import type { AdapterInvocation, AgentAdapter } from "../agent-runner.js";
import type { Command, Event } from "../protocol.js";
import { commandInstruction, spawnAndStream } from "./shared.js";

export class ClaudeCliAdapter implements AgentAdapter {
  readonly name = "claude-cli";

  buildInvocation(_command: Command): AdapterInvocation {
    return { kind: "process", executable: "claude", args: ["-p", "--output-format", "text"] };
  }

  async *execute(invocation: AdapterInvocation, command: Command, prompt: string): AsyncIterable<Event> {
    if (invocation.kind !== "process") {
      throw new Error("ClaudeCliAdapter expects invocation.kind === 'process'");
    }
    yield* spawnAndStream({
      executable: invocation.executable,
      args: invocation.args,
      cwd: command.cwd,
      runId: command.runId,
      commandKind: command.kind,
      stdin: `${commandInstruction(command.kind)}\n\n${prompt}`,
    });
  }
}
