// `openspec-ui-cli complete task|reopen task <change> <number> [--note <text>]` and
// `openspec-ui-cli commit tasks <change>` — what a Pipeline card does in its
// change's own worktree, from a terminal (a-card-works-its-own-tasks).
//
// Presentation only. Which directory is the change's own worktree, whether a
// task may be ticked without a note, and what is committed are core's
// (`findOwnTask`, `setTaskDone`, `commitTaskList`), under the same rules a
// card's controls are.

import {
  commitTaskList, findOwnTask, setTaskDone, readChangeTaskRows, formatMessage, say,
  buildDefaultAgentRunners, createFileRunLogs, FileAuditLog, auditLogPath,
  runOwnDelegatedItem, type AgentRunner, type Command
} from "@openspec-ui/core";
import { publicNameOf } from "./subcommands.js";
import { reportFailure, ReportRefusal, type ReportIo, type ReportOptions } from "./report-command.js";
import { RunTextRenderer, renderRunEventAsJsonLine } from "./render-run.js";
import type { CheckpointPrompt } from "./run-change.js";

export type TaskAction = "done" | "reopen" | "commit";

export interface TaskOptions {
  repositoryRoot: string;
  action: string | undefined;
  changeName: string | undefined;
  /** The task, as `tasks.md` numbers it. */
  number: string | undefined;
  note?: string;
  format: "text" | "json";
}

export interface TaskDeps {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
  /** Test seams. */
  find?: typeof findOwnTask;
  set?: typeof setTaskDone;
  commit?: typeof commitTaskList;
  buildRunners?: typeof buildDefaultAgentRunners;
}

export async function showTasksCommand(
  options: { repositoryRoot: string; changeName: string; format: "text" | "json" },
  deps: Pick<TaskDeps, "stdout" | "stderr"> & { read?: typeof readChangeTaskRows },
): Promise<number> {
  try {
    const result = await (deps.read ?? readChangeTaskRows)(options);
    if (!result.ok) {
      return reportFailure("show tasks", new ReportRefusal(result.reason), deps);
    }
    if (options.format === "json") deps.stdout(JSON.stringify(result, null, 2));
    else {
      deps.stdout(`${result.changeName}: ${result.tasksPath} (${result.source})`);
      for (const row of result.rows) {
        deps.stdout(`[${row.done ? "x" : " "}] ${row.number ?? "unnumbered"} ${row.text} (${row.closedBy}${row.agent ? `: ${row.agent}` : ""})`);
        if (row.body) deps.stdout(row.body);
      }
    }
    return 0;
  } catch (error) {
    return reportFailure("show tasks", error, deps);
  }
}

export async function runTaskCommand(
  options: ReportOptions & { number: string },
  deps: ReportIo & Pick<TaskDeps, "buildRunners"> & {
    permission: CheckpointPrompt;
    find?: typeof findOwnTask;
    run?: typeof runOwnDelegatedItem;
  },
): Promise<number> {
  const active = new Map<AgentRunner, Command>();
  const pending: Promise<unknown>[] = [];
  const cancel = () => {
    for (const [runner, command] of active) {
      pending.push((async () => { for await (const event of runner.run({ ...command, kind: "cancel" })) void event; })());
    }
  };
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  const renderer = new RunTextRenderer();
  try {
    const subject = { repositoryRoot: options.workspaceRoot, changeName: options.changeName! };
    const found = await (deps.find ?? findOwnTask)({ ...subject, number: options.number });
    if (!found.ok) throw new ReportRefusal(found.reason);
    if (found.item.done || !found.item.delegatedTo || found.item.humanOnly) throw new ReportRefusal("Only an open task with a declared delegate can run.");
    const result = await (deps.run ?? runOwnDelegatedItem)({
      ...subject, lineNumber: found.item.lineNumber, holdMutationLease: true,
      runnersFor: (root) => {
        const auditLog = new FileAuditLog(auditLogPath(root));
        const runners = (deps.buildRunners ?? buildDefaultAgentRunners)({ workspaceRoot: root, auditLog, runLogs: createFileRunLogs(root) });
        return (agentId) => {
          const runner = runners.get(agentId);
          if (!runner) return undefined;
          return {
            async *run(command) {
              active.set(runner, command);
              try {
                for await (const event of runner.run(command)) {
                  yield event;
                  if (event.kind === "permissionRequest") {
                    const allowed = await deps.permission.ask?.(`The agent asks: ${event.description}. Allow?`) ?? false;
                    for await (const answered of runner.run({ ...command, kind: "resolvePermission", permissionRequestId: event.requestId, permissionOutcome: allowed ? "allow" : "deny" })) void answered;
                  }
                }
              } finally { active.delete(runner); }
            }
          };
        };
      },
      onEvent: (event) => {
        if (options.format === "json") deps.stdout(renderRunEventAsJsonLine(event));
        else { const text = renderer.render(event); if (text !== undefined) deps.stdout(text); }
      },
    });
    if ("ok" in result) throw new ReportRefusal(result.reason);
    if (result.status === "refused") throw new ReportRefusal(result.reason);
    if (options.format === "json") deps.stdout(JSON.stringify({ kind: "taskResult", ...result }));
    else { const tail = renderer.finish(); if (tail) deps.stdout(tail); deps.stdout(result.message); }
    return result.outcome === "completed" && result.gate.kind === "recorded" ? 0 : 1;
  } catch (error) {
    return reportFailure("run task", error, deps);
  } finally {
    process.off("SIGINT", cancel);
    process.off("SIGTERM", cancel);
    await Promise.allSettled(pending);
  }
}

/** `0` on success, `1` on a refusal with its reason, `2` where the request
 * could not be attempted: an unknown action, a missing change or number, or
 * a failure reading or writing. */
export async function taskCommand(options: TaskOptions, deps: TaskDeps): Promise<number> {
  const { action, changeName } = options;
  if (action !== "done" && action !== "reopen" && action !== "commit") {
    deps.stderr(formatMessage(say("OSW-CLI-014")));
    return 2;
  }
  if (!changeName) {
    deps.stderr(formatMessage(say("OSW-CLI-005", { subcommand: publicNameOf("task", action) })));
    return 2;
  }

  const report = (result: { ok: boolean } & Record<string, unknown>, words: string): number => {
    if (options.format === "json") deps.stdout(JSON.stringify(result, null, 2));
    else if (result.ok) deps.stdout(words);
    else deps.stderr(`openspec-ui-cli: ${String(result.reason)}`);
    return result.ok ? 0 : 1;
  };

  try {
    if (action === "commit") {
      const result = await (deps.commit ?? commitTaskList)({ repositoryRoot: options.repositoryRoot, changeName });
      return report(result as never, result.ok ? `Committed ${result.commit.slice(0, 8)} (${result.message}) and pushed to ${result.pushedTo}.` : "");
    }

    if (!options.number) {
      deps.stderr(formatMessage(say("OSW-CLI-013", { subcommand: publicNameOf("task", action) })));
      return 2;
    }
    const found = await (deps.find ?? findOwnTask)({ repositoryRoot: options.repositoryRoot, changeName, number: options.number });
    if (!found.ok) return report(found as never, "");
    const result = await (deps.set ?? setTaskDone)({
      repositoryRoot: options.repositoryRoot,
      changeName,
      lineNumber: found.item.lineNumber,
      expectedText: found.item.text,
      done: action === "done",
      ...(options.note !== undefined ? { note: options.note } : {}),
    });
    return report(
      result as never,
      result.ok
        ? [result.line.trim(), ...(result.noteLine !== undefined ? [result.noteLine] : []), "Not committed: 'openspec-ui-cli commit tasks' sends it."].join("\n")
        : "",
    );
  } catch (error) {
    deps.stderr(`openspec-ui-cli: task ${action} could not complete: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
}
