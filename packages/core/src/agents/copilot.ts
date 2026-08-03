// Адаптер: GitHub Copilot CLI (`copilot`). В отличие от Claude/Codex/Gemini
// CLI, `copilot -p` не читает промпт из stdin — промпт должен быть позиционным
// аргументом сразу после `-p` (подтверждено живым smoke-тестом, см.
// openspec/changes/standalone-app/tasks.md 3.1/3.2: без аргумента `copilot`
// отвечает "No task was specified", хотя тот же текст на stdin им
// игнорируется).
//
// `buildInvocation()` намеренно возвращает СТАТИЧЕСКУЮ форму (`-p`,
// `--allow-all-tools`, без самого промпта) — именно она проверяется
// allowlist'ом ДО того, как промпт вообще подготовлен (см. agent-runner.ts).
// `execute()` встраивает реальный промпт в argv уже после этой проверки —
// содержимое промпта по-прежнему не может повлиять на то, разрешён ли сам
// запуск (executable + фиксированные флаги остаются теми же).

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
