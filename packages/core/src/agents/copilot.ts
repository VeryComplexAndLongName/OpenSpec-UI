// Adapter: GitHub Copilot CLI (`copilot`). Unlike the Claude/Codex/Gemini
// CLIs, `copilot -p` does not read the prompt from stdin — the prompt must
// be a positional argument right after `-p` (confirmed by a live smoke
// test, see openspec/changes/standalone-app/tasks.md 3.1/3.2: without the
// argument `copilot` responds "No task was specified", even though the
// same text on stdin is ignored by it).
//
// `buildInvocation()` intentionally returns the STATIC shape (`-p`,
// `--allow-all-tools`, without the prompt itself) — it is exactly this
// shape that gets checked by the allowlist BEFORE the prompt is even
// prepared (see agent-runner.ts). `execute()` embeds the actual prompt
// into argv only after that check — the prompt's content still cannot
// affect whether the run itself is permitted (the executable + fixed
// flags stay the same).

import type { AdapterInvocation, AgentAdapter } from "../agent-runner.js";
import type { Command, Event } from "../protocol.js";
import { commandInstruction, spawnAndStream } from "./shared.js";

export class CopilotCliAdapter implements AgentAdapter {
  readonly name = "copilot-cli";

  buildInvocation(_command: Command): AdapterInvocation {
    return { kind: "process", executable: "copilot", args: ["-p", "--allow-all-tools"] };
  }

  async *execute(invocation: AdapterInvocation, command: Command, prompt: string): AsyncIterable<Event> {
    if (invocation.kind !== "process") {
      throw new Error("CopilotCliAdapter expects invocation.kind === 'process'");
    }
    const fullPrompt = `${commandInstruction(command.kind)}\n\n${prompt}`;
    yield* spawnAndStream({
      executable: invocation.executable,
      args: ["-p", fullPrompt, "--allow-all-tools"],
      cwd: command.cwd,
      runId: command.runId,
      commandKind: command.kind,
    });
  }
}
