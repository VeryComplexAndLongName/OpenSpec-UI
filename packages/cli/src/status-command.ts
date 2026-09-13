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
  describeSignature,
  describeTaskInHand,
  describeWaiting,
  readAgentStatuses,
  readTaskChecklist,
  resolveAgentStatusDirectory,
  sweepAgentStatuses,
  taskInHand,
  type AgentStatusReadResult,
  type AgentStatusReport,
  type AgentStatusSweepResult,
  type GitWrapper,
  type TaskChecklistItem,
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
  sweep?: typeof sweepAgentStatuses;
  /** Test seam for reading a run's change's task list. */
  readTasks?: (workingDirectory: string, changeName: string) => Promise<TaskChecklistItem[]>;
}

/** The task list of a run's own change in the run's own directory, or no
 * items where it cannot be read: a run is still reported without the task
 * line. */
async function tasksOf(report: AgentStatusReport, deps: StatusDeps): Promise<TaskChecklistItem[]> {
  if (report.task === null || report.changeName === null) return [];
  try {
    const read = deps.readTasks ?? ((workingDirectory: string, changeName: string) => readTaskChecklist(workingDirectory, changeName, false));
    return await read(report.workingDirectory, report.changeName);
  } catch {
    return [];
  }
}

/** Always `0`, whether or not anything is running — the same reasoning
 * `ready` and `lease` already use: the question was answered either
 * way, and a script asking "is anything running" should read the
 * output rather than infer it from a failure code. */
export async function statusCommand(options: StatusOptions, deps: StatusDeps): Promise<number> {
  let result: AgentStatusReadResult;
  let swept: AgentStatusSweepResult | undefined;
  try {
    const git = (deps.createGit ?? ((cwd: string) => createGitWrapper({ cwd })))(options.workspaceRoot);
    const directory = await (deps.resolveDirectory ?? resolveAgentStatusDirectory)(git, options.workspaceRoot);
    // Records of runs that will never write again go before reading, since
    // this is where the directory is already being looked at
    // (a-stale-status-is-swept). A sweep that fails is no reason not to
    // answer the question that was asked.
    swept = await (deps.sweep ?? sweepAgentStatuses)(directory).catch(() => undefined);
    result = await (deps.read ?? readAgentStatuses)(directory);
  } catch (error) {
    deps.stderr(`openspec-ui-cli: could not read agent status: ${message(error)}`);
    return 2;
  }

  if (options.format === "json") {
    deps.stdout(JSON.stringify(result, null, 2));
    return 0;
  }

  // Said on stderr, so what stdout says about runs reads the same whether
  // or not anything was removed first.
  for (const fileName of swept?.removedRecords ?? []) {
    deps.stderr(`openspec-ui-cli: removed ${fileName}: its writer stopped reporting past the staleness window`);
  }
  for (const fileName of swept?.removedTemporaryFiles ?? []) {
    deps.stderr(`openspec-ui-cli: removed ${fileName}: left by a write that never finished`);
  }

  if (result.reports.length === 0 && result.malformed.length === 0) {
    deps.stdout("No runs are reporting themselves.");
    return 0;
  }

  for (const report of result.reports) {
    // A record that does not check out is named by its file and nothing it
    // says is printed (a-run-is-signed-by-its-person).
    if (report.signature === "does-not-check-out") {
      deps.stdout(report.instanceId);
      deps.stdout(`    ${describeSignature(report.signature)}`);
      continue;
    }
    const activitySeconds = Math.round(report.activitySinceMs / 1000);
    const heartbeatSeconds = Math.round(report.heartbeatAgeMs / 1000);
    const change = report.changeName ? ` on "${report.changeName}"` : "";
    const stage = report.stage ? ` (${report.stage})` : "";
    deps.stdout(`${report.instanceId}${change}${stage}`);
    deps.stdout(`    in ${report.workingDirectory}`);
    deps.stdout(`    ${report.activity}`);
    // The task in hand, paired with the change's own list: a number the
    // list does not have names no task (a-run-says-which-task-it-is-on).
    const task = taskInHand(report.task, await tasksOf(report, deps));
    if (task) deps.stdout(`    ${describeTaskInHand(task)}`);
    if (report.waiting) deps.stdout(`    ${describeWaiting(report.waiting)}`);
    deps.stdout(
      `    said this ${activitySeconds}s ago, last heard from ${heartbeatSeconds}s ago` +
        (report.gone ? " — gone" : ""),
    );
    // Whose the run is, as far as its signature shows, and no further: the
    // run itself is still only what its record claims.
    deps.stdout(`    ${describeSignature(report.signature, report.person)}`);
  }

  for (const bad of result.malformed) {
    deps.stderr(`openspec-ui-cli: ${bad.fileName}: ${bad.reason}`);
  }

  return 0;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
