// Adapter: Codex CLI (`codex`). Non-interactive mode (`exec`), the prompt
// is fed in via stdin (see claude.ts for the same pattern).

import type { AdapterInvocation, AgentAdapter } from "../agent-runner.js";
import type { Command, Event } from "../protocol.js";
import { commandInstruction, spawnAndStream } from "./shared.js";

export class CodexCliAdapter implements AgentAdapter {
  readonly name = "codex-cli";

  buildInvocation(_command: Command): AdapterInvocation {
    return { kind: "process", executable: "codex", args: ["exec", "--skip-git-repo-check"] };
  }

  async *execute(invocation: AdapterInvocation, command: Command, prompt: string): AsyncIterable<Event> {
    if (invocation.kind !== "process") {
      throw new Error("CodexCliAdapter expects invocation.kind === 'process'");
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
