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

// Argv-only delivery (above) has a real ceiling on Windows: cross-spawn
// resolves `copilot`'s npm-global `.cmd` shim through `cmd.exe`, whose own
// command-line length budget is ~8191 characters — well under
// CreateProcess's ~32767-character ceiling. Before agent-prompt-context
// (openspec/changes/agent-prompt-context/), the embedded prompt was
// essentially empty, so this never mattered; now that it embeds real
// proposal/design/tasks/spec content, a large-enough change pushes the
// whole command line (copilot + -p + the prompt + --allow-all-tools +
// cmd.exe's own wrapper/quoting overhead) past that limit, and `copilot`
// never even starts — reproduced live: a ~9.5KB prompt failed instantly
// with cmd.exe's own "the command line is too long" (Windows' locale,
// decodes as CP866, not UTF-8 — garbled if read as UTF-8 text).
// 6000 leaves several hundred characters of margin for that surrounding
// overhead. Below it, behavior is unchanged (full embedded content).
const MAX_ARGV_PROMPT_LENGTH = 6000;

function buildFallbackPrompt(kind: Command["kind"], changeDir: string): string {
  return `${commandInstruction(kind)}\n\n` +
    "The full change context is too large to include inline. Before " +
    `proceeding, read proposal.md, design.md, tasks.md, and any ` +
    `specs/*/spec.md files directly from ${changeDir} using your own ` +
    "file tools. Work only within that directory — do not read or " +
    "modify files under any other openspec/changes/<id>/ directory. Also " +
    "run `openspec instructions tasks --change <id>` yourself (with <id> " +
    "the change's directory name) and follow what it returns — those are " +
    "this project's own rules for how the work must be done.";
}

export class CopilotCliAdapter implements AgentAdapter {
  readonly name = "copilot-cli";

  buildInvocation(command: Command): AdapterInvocation {
    const args = ["-p", "--allow-all-tools"];
    if (command.model) args.push("--model", command.model);
    if (command.effort) args.push("--effort", command.effort);
    if (command.budget?.maxAiCredits !== undefined) args.push("--max-ai-credits", String(command.budget.maxAiCredits));
    return { kind: "process", executable: "copilot", args };
  }

  async *execute(invocation: AdapterInvocation, command: Command, prompt: string, signal: AbortSignal): AsyncIterable<Event> {
    if (invocation.kind !== "process") {
      throw new Error("CopilotCliAdapter expects invocation.kind === 'process'");
    }
    const embeddedPrompt = `${commandInstruction(command.kind)}\n\n${prompt}`;
    const fullPrompt = embeddedPrompt.length <= MAX_ARGV_PROMPT_LENGTH
      ? embeddedPrompt
      : buildFallbackPrompt(command.kind, command.context.changeDir);
    const args = ["-p", fullPrompt, "--allow-all-tools"];
    if (command.model) args.push("--model", command.model);
    if (command.effort) args.push("--effort", command.effort);
    if (command.budget?.maxAiCredits !== undefined) args.push("--max-ai-credits", String(command.budget.maxAiCredits));
    yield* spawnAndStream({
      executable: invocation.executable,
      args,
      cwd: command.cwd,
      runId: command.runId,
      commandKind: command.kind,
      signal,
    });
  }
}
