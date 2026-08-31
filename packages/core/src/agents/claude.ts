// Adapter: Claude CLI (`claude`). Non-interactive print mode (`-p`), the
// prompt is fed in as an argument, cwd is the process's working directory.
// The CLI's output format can change between versions — it is not parsed
// structurally, it is passed through as `stdout`/`stderr` as-is (see
// shared.ts).
//
// `--dangerously-skip-permissions` is required: `claude -p` still enforces
// its normal interactive tool-approval model by default, and with no TTY to
// answer an approval prompt, any tool needing approval (Edit/Write/Bash)
// stalls with no way to proceed — reproduced live, see
// openspec/changes/claude-cli-permission-bypass/. Matches this project's
// already-established posture for the other adapters (`gemini-cli` already
// uses `--yolo`, `copilot-cli` already uses `--allow-all-tools`); this
// project's actual security boundary is `checkCwdSandbox` + the allowlist +
// `AuditLog` in security.ts, not any individual CLI's own interactive
// prompts.

import type { AdapterInvocation, AgentAdapter } from "../agent-runner.js";
import type { Command, Event } from "../protocol.js";
import { commandInstruction, spawnAndStream } from "./shared.js";

export class ClaudeCliAdapter implements AgentAdapter {
  readonly name = "claude-cli";

  buildInvocation(_command: Command): AdapterInvocation {
    return {
      kind: "process",
      executable: "claude",
      args: ["-p", "--output-format", "text", "--dangerously-skip-permissions"],
    };
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
