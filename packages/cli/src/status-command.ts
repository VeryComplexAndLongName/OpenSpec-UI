// `openspec-ui-cli status` — an agent says what it is doing.
//
// Presentation only. Where a run's record lives is resolved by core
// (`resolveAgentStatusDirectory`) and what a directory of them says is
// read by core (`readAgentStatuses`); this turns that into something a
// person reads and an exit code.
//
// Answerable without a browser, which is the case a person hits at the
// moment something looks wrong: a run's heartbeat and its process both
// look fine, and the only missing fact is what it last said it was
// doing.

import {
  createGitWrapper,
  readAgentStatuses,
  resolveAgentStatusDirectory,
  type AgentStatusReadResult,
  type GitWrapper,
} from "@openspec-ui/core";

export interface StatusOptions {
  workspaceRoot: string;
  format: "text" | "json";
}

export interface StatusDeps {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
  /** Test seams, the same shape `worktreeCommand`'s `createGit` already
   * is — `createGitWrapper` needs a real repository on disk, which a
   * unit test must not require just to reach `read`. */
  createGit?: (cwd: string) => GitWrapper;
  resolveDirectory?: typeof resolveAgentStatusDirectory;
  read?: typeof readAgentStatuses;
}

/** Always `0`, whether or not anything is running — the same reasoning
 * `ready` and `lease` already use: the question was answered either
 * way, and a script asking "is anything running" should read the
 * output rather than infer it from a failure code. */
export async function statusCommand(options: StatusOptions, deps: StatusDeps): Promise<number> {
  let result: AgentStatusReadResult;
  try {
    const git = (deps.createGit ?? ((cwd: string) => createGitWrapper({ cwd })))(options.workspaceRoot);
    const directory = await (deps.resolveDirectory ?? resolveAgentStatusDirectory)(git, options.workspaceRoot);
    result = await (deps.read ?? readAgentStatuses)(directory);
  } catch (error) {
    deps.stderr(`openspec-ui-cli: could not read agent status: ${message(error)}`);
    return 2;
  }

  if (options.format === "json") {
    deps.stdout(JSON.stringify(result, null, 2));
    return 0;
  }

  if (result.reports.length === 0 && result.malformed.length === 0) {
    deps.stdout("No runs are reporting themselves.");
    return 0;
  }

  for (const report of result.reports) {
    const activitySeconds = Math.round(report.activitySinceMs / 1000);
    const heartbeatSeconds = Math.round(report.heartbeatAgeMs / 1000);
    const change = report.changeName ? ` on "${report.changeName}"` : "";
    const stage = report.stage ? ` (${report.stage})` : "";
    deps.stdout(`${report.instanceId}${change}${stage}`);
    deps.stdout(`    in ${report.workingDirectory}`);
    deps.stdout(`    ${report.activity}`);
    deps.stdout(
      `    said this ${activitySeconds}s ago, last heard from ${heartbeatSeconds}s ago` +
        (report.gone ? " — gone" : ""),
    );
  }

  for (const bad of result.malformed) {
    deps.stderr(`openspec-ui-cli: ${bad.fileName}: ${bad.reason}`);
  }

  return 0;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
