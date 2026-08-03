// Адаптер: Claude CLI (`claude`). Неинтерактивный print-режим (`-p`), промпт
// подаётся аргументом, cwd — рабочая директория процесса. Формат вывода CLI
// может меняться между версиями — не парсится структурно, передаётся как
// `stdout`/`stderr` как есть (см. shared.ts).

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
      throw new Error("ClaudeCliAdapter ожидает invocation.kind === 'process'");
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
