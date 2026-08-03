// Адаптер: GitHub Copilot CLI (`copilot`). Неинтерактивный режим, промпт —
// через stdin (см. claude.ts за тем же паттерном и комментарием про
// консервативный парсинг вывода).

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
      throw new Error("CopilotCliAdapter ожидает invocation.kind === 'process'");
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
