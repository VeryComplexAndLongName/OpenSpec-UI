// Adapter: Codex CLI (`codex`). Non-interactive mode (`exec`), the prompt
// is fed in via stdin (see claude.ts for the same pattern).

import type { AdapterInvocation, AgentAdapter } from "../agent-runner.js";
import type { Command, Event } from "../protocol.js";
import { commandInstruction, spawnAndStream } from "./shared.js";

export class CodexCliAdapter implements AgentAdapter {
  readonly name = "codex-cli";

  buildInvocation(command: Command): AdapterInvocation {
    const args = ["exec", "--skip-git-repo-check"];
    // codex has no dedicated effort flag — only a generic `-c key=value`
    // config override. Render that one key only: `-c` reaches codex's
    // whole configuration surface (sandbox mode, approval policy,
    // provider), and admitting the flag rather than this one setting
    // would open the argv allowlist far wider than this feature needs —
    // see design.md, "codex-cli's config override is admitted for
    // exactly one key". No budget mechanism was found for codex.
    if (command.effort) args.push("-c", `model_reasoning_effort="${command.effort}"`);
    return { kind: "process", executable: "codex", args };
  }

  async *execute(invocation: AdapterInvocation, command: Command, prompt: string, signal: AbortSignal): AsyncIterable<Event> {
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
      signal,
    });
  }
}
