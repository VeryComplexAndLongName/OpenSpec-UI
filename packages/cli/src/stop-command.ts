// `openspec-ui-cli stop <instanceId> --reason <text>` — ask a run elsewhere to
// stop, through ADR 0028's signed channel (a-run-elsewhere-can-be-asked-to-stop).
//
// Presentation only. Which runs are live is read by core (`readAgentStatuses`);
// the request is written by core (`askRunToStop`), sealed with this machine's
// key. The command line allows asking any live run: the console offers Stop
// only on a person's own runs, and the request names who asked either way
// (ADR 0028, "the protocol forbids nothing").

import os from "node:os";
import {
  askRunToStop,
  isTaskNumber,
  createGitWrapper,
  loadOrCreateMachineKey,
  messageDirectoryBeside,
  readAgentStatuses,
  readGitAuthor,
  resolveAgentStatusDirectory,
  type GitWrapper,
  type MachineKey,
} from "@openspec-ui/core";

export interface StopOptions {
  workspaceRoot: string;
  /** The run to ask, by the instance id its status record names. */
  instanceId: string | undefined;
  reason: string | undefined;
  /** The task the run may finish before it stops, as `tasks.md` numbers
   * it. Absent asks it to stop at the next sound point, which is what a
   * stop has always meant (a-run-is-told-where-to-stop). */
  afterTask?: string;
  format: "text" | "json";
}

export interface StopDeps {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
  /** Test seams. */
  createGit?: (cwd: string) => GitWrapper;
  resolveDirectory?: typeof resolveAgentStatusDirectory;
  read?: typeof readAgentStatuses;
  loadKey?: () => Promise<MachineKey>;
  readAuthor?: (cwd: string) => Promise<string | undefined>;
  machine?: string;
  ask?: typeof askRunToStop;
}

/** `0` when the request was written, `1` when there is no live run of that
 * id to ask, `2` when the command could not ask at all: a missing id or
 * reason, or a directory, key or file it could not use. */
export async function stopCommand(options: StopOptions, deps: StopDeps): Promise<number> {
  const instanceId = options.instanceId?.trim();
  const reason = options.reason?.trim();
  if (!instanceId) {
    deps.stderr("openspec-ui-cli: stop needs the instance id of the run to ask, as 'openspec-ui status' prints it");
    return 2;
  }
  if (!reason) {
    deps.stderr("openspec-ui-cli: stop needs a reason: --reason <text>");
    return 2;
  }
  const afterTask = options.afterTask?.trim();
  // Refused here, before anything is read or written: a request carrying a
  // task no list can name is one the run would have to refuse later, and
  // by then the operator has stopped watching.
  if (options.afterTask !== undefined && (afterTask === undefined || !isTaskNumber(afterTask))) {
    deps.stderr(`openspec-ui-cli: --after takes a task number, such as 4.6; it was given ${JSON.stringify(options.afterTask)}`);
    return 2;
  }

  let directory: string;
  let live: boolean;
  try {
    const git = (deps.createGit ?? ((cwd: string) => createGitWrapper({ cwd })))(options.workspaceRoot);
    directory = await (deps.resolveDirectory ?? resolveAgentStatusDirectory)(git, options.workspaceRoot);
    const { reports } = await (deps.read ?? readAgentStatuses)(directory);
    // A record that does not check out names no run, and a gone run reads no
    // requests: neither is one this could ask.
    live = reports.some((report) => report.instanceId === instanceId && !report.gone && report.signature !== "does-not-check-out");
  } catch (error) {
    deps.stderr(`openspec-ui-cli: could not read agent status: ${message(error)}`);
    return 2;
  }
  if (!live) {
    deps.stderr(`openspec-ui-cli: no live run reports itself as ${instanceId}, so there is nothing to ask. 'openspec-ui status' lists the runs that do.`);
    return 1;
  }

  let messageId: string;
  try {
    const key = await (deps.loadKey ?? (() => loadOrCreateMachineKey()))();
    const gitAuthor = await (deps.readAuthor ?? readGitAuthor)(options.workspaceRoot).catch(() => undefined);
    messageId = await (deps.ask ?? askRunToStop)({
      directory: messageDirectoryBeside(directory),
      to: instanceId,
      reason,
      ...(afterTask !== undefined ? { afterTask } : {}),
      key,
      machine: deps.machine ?? os.hostname(),
      ...(gitAuthor !== undefined ? { gitAuthor } : {}),
    });
  } catch (error) {
    deps.stderr(`openspec-ui-cli: could not write the request: ${message(error)}`);
    return 2;
  }

  if (options.format === "json") {
    deps.stdout(JSON.stringify({ messageId, to: instanceId, ...(afterTask !== undefined ? { afterTask } : {}) }, null, 2));
  } else {
    deps.stdout(afterTask !== undefined ? `${messageId} (after ${afterTask})` : messageId);
  }
  return 0;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
