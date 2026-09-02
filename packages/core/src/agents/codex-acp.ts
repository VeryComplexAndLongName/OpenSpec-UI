// ACP-flavored adapter: Codex CLI, via the externally installed
// `codex-acp` binary (`@agentclientprotocol/codex-acp`, npm, v1.7.0 — the
// actively maintained, genuinely TypeScript successor to the deprecated
// `@zed-industries/codex-acp`; supports ChatGPT-login auth). `codex-cli`
// itself has no native ACP mode — this binary IS the ACP server, started
// directly (no `--acp`-style flag; unlike `copilot`/`gemini`, ACP is its
// only mode). NOT added to `packages/core/package.json` as an npm
// dependency — see design.md's "codex-acp is invoked as an external
// binary, never an npm dependency of packages/core": its own
// `@openai/codex` dependency bundles a native, platform-specific binary
// fetched via postinstall, which would otherwise force every
// contributor's `npm install` to download it regardless of use. Presence
// on `PATH` is detected the same best-effort way as every other CLI this
// project shells out to (agent-detection.ts) — not live-verified in this
// change, `codex-acp` is not installed on this machine (see ADR 0013).
//
// Additional, not a replacement for `codex-cli` (codex.ts) — see
// design.md, "ACP-flavored adapters are new, additional AgentAdapters".

import type { AdapterInvocation, AgentAdapter } from "../agent-runner.js";
import type { Command, Event } from "../protocol.js";
import { AcpSessionDriver } from "./acp-session-driver.js";
import { commandInstruction } from "./shared.js";

export class CodexCliAcpAdapter implements AgentAdapter {
  readonly name = "codex-cli-acp";

  private readonly driver = new AcpSessionDriver();

  buildInvocation(_command: Command): AdapterInvocation {
    // No model/effort/budget flag rendered here: `codex-acp` has no
    // documented command-line surface for either (codex.ts's own
    // raw-text adapter renders effort only via a generic `-c key=value`
    // config override on the `codex` binary itself, not on `codex-acp` —
    // see codex.ts's comment; that mechanism is specific to that binary
    // and is not assumed to carry over here without live verification).
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
    });
  }

  resolvePermission(runId: string, requestId: string, outcome: "allow" | "deny"): boolean {
    return this.driver.resolvePermission(runId, requestId, outcome);
  }
}
