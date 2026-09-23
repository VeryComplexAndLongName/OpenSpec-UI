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
// dsh runs on whatever `node` its shim finds, and on a Node below 22.18 or
// between 23.0 and 24.2 it exits with code 0 before answering, saying
// nothing at all - not even for `--version`, and with nothing on stderr
// under `--trace-uncaught`, because nothing throws. Its entry point ends
// with `if (import.meta.main) await runCli();`, and Node added
// `import.meta.main` in 24.2.0, backporting it to 22.18.0; below that it
// is `undefined` and the command is simply never run. Checked against
// 0.1.5-rc.2 on 2026-09-23.
//
// So the Node that would start dsh is asked its version first, and a run
// that cannot work is refused before anything is spawned. Where the
// version cannot be read the run goes ahead, and a process that closes
// without a word is still told which Node it met: "ACP connection closed"
// says nothing a person can act on.
//
// This repository pins 22.11.0 with Volta, below the floor, and Volta puts
// that Node first on the PATH of every process it starts - so a server
// started with `npm` inside this repository cannot run dsh, while the
// editor's host, which Volta does not start, finds the system Node.

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

/** The two Node versions that first carry `import.meta.main`, which dsh's
 * entry point is guarded by: 24.2.0, and 22.18.0 on the 22 line. Nothing
 * on the 23 line has it. See this file's header comment. */
export const DSH_NODE_FLOOR = [
  { major: 22, minor: 18 },
  { major: 24, minor: 2 },
] as const;

/** How the floor reads to a person. */
export const DSH_NODE_FLOOR_TEXT = "Node 22.18 or newer on the 22 line, or 24.2 or newer";

const NEWEST_FLOOR_LINE = Math.max(...DSH_NODE_FLOOR.map((floor) => floor.major));

/** `true` when dsh can run on this Node, `false` when it cannot, and
 * `undefined` when the version cannot be read - which is not a refusal,
 * since a run that might work is worth more than a guess. */
export function nodeCanRunDsh(version: string): boolean | undefined {
  const read = /^v?(\d+)\.(\d+)/u.exec(version.trim());
  if (!read) return undefined;
  const major = Number(read[1]);
  const minor = Number(read[2]);
  // Above every line named here, the feature is simply there.
  if (major > NEWEST_FLOOR_LINE) return true;
  // On a line that is named, it arrives at that line's own minor; a line
  // named by neither - the 23 line - never carries it at all.
  const line = DSH_NODE_FLOOR.find((floor) => floor.major === major);
  return line !== undefined && minor >= line.minor;
}

/** Why a run was refused before dsh was started. */
export function explainOldNode(version: string): string {
  return `dsh cannot run on the Node it would be started with (${version}). It needs ${DSH_NODE_FLOOR_TEXT}: its entry point is guarded by \`import.meta.main\`, which Node added in 24.2.0 and 22.18.0, and on an older Node dsh exits with code 0 without a word. Put a Node that has it first on the PATH the host starts agents with.`;
}

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
  return `${reason}: dsh exited before answering, and ${met}. dsh needs ${DSH_NODE_FLOOR_TEXT}, and exits this way without a word on anything older; put a Node that new first on the PATH the host starts agents with.`;
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

    // Asked before anything is spawned. Otherwise a run that cannot work
    // costs a person the whole run, and dsh's silence reads exactly like
    // an agent that had nothing to say.
    const askNode = this.nodeVersion ?? nodeVersionOnPath;
    const startingNode = await askNode(command.cwd);
    if (startingNode !== undefined && nodeCanRunDsh(startingNode) === false) {
      const now = new Date().toISOString();
      yield { kind: "started", runId: command.runId, timestamp: now, command: command.kind, cwd: command.cwd };
      yield { kind: "failed", runId: command.runId, timestamp: now, reason: explainOldNode(startingNode) };
      return;
    }

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
        yield { ...event, reason: explainSilentExit(event.reason, startingNode) };
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
