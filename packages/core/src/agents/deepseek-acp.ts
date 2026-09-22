// ACP adapter: DeepSeek, through the DeepSeek CLI `dsh`
// (`@deepseek-ai/dsh`, npm), whose ACP server is a profile rather than a
// flag: `dsh --profile acp` serves ACP over stdio until disconnect
// (deepseek-joins-as-an-acp-agent). Checked live on 2026-09-22 against
// 0.1.5-rc.2: `initialize` answers as `deepseek-harness-acp` with no auth
// method to run - the key lives in the person's own dsh profile, never
// here - and `session/new` offers its models as a config option, with
// DeepSeek-V4-Flash as the default.
//
// No model, effort or budget is rendered: the model is an ACP session
// option, not a command-line flag, and nothing here sets session options
// yet. The shared driver speaks everything else.
//
// Like codex-acp, an external binary found on PATH, never an npm
// dependency of packages/core.
//
// dsh runs on whatever `node` its shim finds, and on Node 22.11 - which
// this repository pins with Volta, and which Volta puts first on the PATH
// of every process it starts - it exits with code 0 before answering,
// saying nothing. The same run on Node 24.18 completed. A run that ends
// that way is told which Node it met, since "ACP connection closed" says
// nothing a person can act on.

import crossSpawn from "cross-spawn";
import type { AdapterInvocation, AgentAdapter } from "../agent-runner.js";
import type { Command, Event } from "../protocol.js";
import { AcpSessionDriver } from "./acp-session-driver.js";
import { commandInstruction } from "./shared.js";

export const DEEPSEEK_ACP_ARGS = ["--profile", "acp"] as const;

/** Put before every prompt. The owner found DeepSeek does best with
 * instructions taken literally and one at a time, and says so up front
 * rather than leaving the model to infer how strictly to read what
 * follows. */
export const DEEPSEEK_PREAMBLE = [
  "Follow the instructions below literally and in order.",
  "Do exactly what each step asks, and nothing it does not ask.",
  "Where a step names a file, a command or a task number, use that one and no other.",
  "When a step is finished, say which step it was before starting the next.",
  "If a step cannot be done as written, stop and say why, instead of doing something else.",
].join(String.fromCharCode(10));

/** The version `node -v` prints where dsh is started, or `undefined`. */
export function nodeVersionOnPath(cwd: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    let out = "";
    try {
      const child = crossSpawn("node", ["-v"], { cwd, stdio: ["ignore", "pipe", "ignore"] });
      child.stdout?.on("data", (chunk: Buffer) => { out += chunk.toString("utf8"); });
      child.on("error", () => resolve(undefined));
      child.on("close", () => resolve(out.trim() || undefined));
    } catch {
      resolve(undefined);
    }
  });
}

/** Why a dsh run that said nothing at all ended, in words a person can act on. */
export function explainSilentExit(reason: string, nodeVersion: string | undefined): string {
  const met = nodeVersion === undefined ? "no node could be asked its version" : `the Node on this PATH is ${nodeVersion}`;
  return `${reason}: dsh exited before answering, and ${met}. dsh 0.1.5 exits this way on Node 22.11 and runs on Node 24.18; put a newer Node first on the PATH the host starts agents with.`;
}

export class DeepSeekAcpAdapter implements AgentAdapter {
  readonly name = "deepseek-cli-acp";

  private readonly driver = new AcpSessionDriver();

  buildInvocation(_command: Command): AdapterInvocation {
    return { kind: "process", executable: "dsh", args: [...DEEPSEEK_ACP_ARGS] };
  }

  async *execute(invocation: AdapterInvocation, command: Command, prompt: string, signal: AbortSignal): AsyncIterable<Event> {
    if (invocation.kind !== "process") {
      throw new Error("DeepSeekAcpAdapter expects invocation.kind === 'process'");
    }
    const NL = String.fromCharCode(10);
    let heard = false;
    for await (const event of this.driver.runProcess({
      executable: invocation.executable,
      args: invocation.args,
      cwd: command.cwd,
      runId: command.runId,
      commandKind: command.kind,
      prompt: `${DEEPSEEK_PREAMBLE}${NL}${NL}${commandInstruction(command.kind)}${NL}${NL}${prompt}`,
      signal,
    })) {
      if (event.kind === "agentUpdate") heard = true;
      if (event.kind === "failed" && !heard && !signal.aborted) {
        yield { ...event, reason: explainSilentExit(event.reason, await (this.nodeVersion ?? nodeVersionOnPath)(command.cwd)) };
        continue;
      }
      yield event;
    }
  }

  /** Test seam: how the Node on the PATH is asked its version. */
  nodeVersion?: (cwd: string) => Promise<string | undefined>;

  resolvePermission(runId: string, requestId: string, outcome: "allow" | "deny"): boolean {
    return this.driver.resolvePermission(runId, requestId, outcome);
  }
}
