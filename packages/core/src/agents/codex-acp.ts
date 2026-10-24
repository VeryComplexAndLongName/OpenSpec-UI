// ACP-flavored adapter: Codex CLI, via the externally installed
// `codex-acp` binary (`@agentclientprotocol/codex-acp`, npm — the
// maintained successor to the deprecated `@zed-industries/codex-acp`;
// supports ChatGPT-login auth). `codex-cli` itself has no native ACP mode
// — this binary IS the ACP server, started directly with no arguments.
// NOT added to `packages/core/package.json` as an npm dependency — see
// design.md's "codex-acp is invoked as an external binary, never an npm
// dependency of packages/core": its own `@openai/codex` dependency bundles
// a native, platform-specific binary fetched via postinstall.
//
// The model, the effort and the sandbox are ACP session options, not
// arguments (codex-cli-acp-is-a-full-agent, ADR 0052): `codex-acp` 2.2.2's
// `session/new`, read live on 2026-10-24, offers `mode` (`read-only`,
// `workspace-write`, `agent`, `agent-full-access`), `model` and
// `reasoning_effort`, and the driver sets each with
// `session/set_config_option` before the prompt, refusing a value the
// session does not list.
//
// Additional, not a replacement for `codex-cli` (codex.ts) — see
// design.md, "ACP-flavored adapters are new, additional AgentAdapters".

import type { AdapterInvocation, AgentAdapter } from "../agent-runner.js";
import type { Command, Event } from "../protocol.js";
import { AcpSessionDriver, type AcpSessionOption } from "./acp-session-driver.js";
import { codexSandboxFor } from "./codex.js";
import { commandInstruction } from "./shared.js";

/** The session options a command sets, in the order they are sent. The
 * `mode` is the sandbox `codex-cli` names for the same command (ADR
 * 0051) — `codex-acp` calls its `workspace-write` and `read-only` modes
 * by the same names. Its own default, `agent` ("Auto review"), is not
 * used: what that lets through is codex's decision, and a stage needs to
 * say what it allows. */
export function codexAcpSessionOptions(command: Command): AcpSessionOption[] {
  const options: AcpSessionOption[] = [{ id: "mode", value: codexSandboxFor(command.kind) }];
  if (command.model) options.push({ id: "model", value: command.model });
  if (command.effort) options.push({ id: "reasoning_effort", value: command.effort });
  return options;
}

export class CodexCliAcpAdapter implements AgentAdapter {
  readonly name = "codex-cli-acp";

  private readonly driver = new AcpSessionDriver();

  buildInvocation(_command: Command): AdapterInvocation {
    // Nothing on the command line: everything this adapter sets is a
    // session option (see the header).
    return { kind: "process", executable: "codex-acp", args: [] };
  }

  async *execute(invocation: AdapterInvocation, command: Command, prompt: string, signal: AbortSignal): AsyncIterable<Event> {
    if (invocation.kind !== "process") {
      throw new Error("CodexCliAcpAdapter expects invocation.kind === 'process'");
    }
    yield* this.driver.runProcess({
      executable: invocation.executable,
      args: invocation.args,
      cwd: command.cwd,
      runId: command.runId,
      commandKind: command.kind,
      prompt: `${commandInstruction(command.kind)}\n\n${prompt}`,
      signal,
      sessionOptions: { agent: "codex-acp", set: codexAcpSessionOptions(command) },
    });
  }

  resolvePermission(runId: string, requestId: string, outcome: "allow" | "deny"): boolean {
    return this.driver.resolvePermission(runId, requestId, outcome);
  }
}
