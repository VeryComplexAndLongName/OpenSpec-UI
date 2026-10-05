// `openspec-ui-cli task done|reopen <change> <number> [--note <text>]` and
// `openspec-ui-cli task commit <change>` — what a Pipeline card does in its
// change's own worktree, from a terminal (a-card-works-its-own-tasks).
//
// Presentation only. Which directory is the change's own worktree, whether a
// task may be ticked without a note, and what is committed are core's
// (`findOwnTask`, `setTaskDone`, `commitTaskList`), under the same rules a
// card's controls are.

import { commitTaskList, findOwnTask, setTaskDone } from "@openspec-ui/core";

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
}

/** `0` on success, `1` on a refusal with its reason, `2` where the request
 * could not be attempted: an unknown action, a missing change or number, or
 * a failure reading or writing. */
export async function taskCommand(options: TaskOptions, deps: TaskDeps): Promise<number> {
  const { action, changeName } = options;
  if (action !== "done" && action !== "reopen" && action !== "commit") {
    deps.stderr("openspec-ui-cli: task takes done, reopen or commit");
    return 2;
  }
  if (!changeName) {
    deps.stderr(`openspec-ui-cli: task ${action} needs a change name`);
    return 2;
  }

  const say = (result: { ok: boolean } & Record<string, unknown>, words: string): number => {
    if (options.format === "json") deps.stdout(JSON.stringify(result, null, 2));
    else if (result.ok) deps.stdout(words);
    else deps.stderr(`openspec-ui-cli: ${String(result.reason)}`);
    return result.ok ? 0 : 1;
  };

  try {
    if (action === "commit") {
      const result = await (deps.commit ?? commitTaskList)({ repositoryRoot: options.repositoryRoot, changeName });
      return say(result as never, result.ok ? `Committed ${result.commit.slice(0, 8)} (${result.message}) and pushed to ${result.pushedTo}.` : "");
    }

    if (!options.number) {
      deps.stderr(`openspec-ui-cli: task ${action} needs the task's number, as tasks.md numbers it (for example 6.4)`);
      return 2;
    }
    const found = await (deps.find ?? findOwnTask)({ repositoryRoot: options.repositoryRoot, changeName, number: options.number });
    if (!found.ok) return say(found as never, "");
    const result = await (deps.set ?? setTaskDone)({
      repositoryRoot: options.repositoryRoot,
      changeName,
      lineNumber: found.item.lineNumber,
      expectedText: found.item.text,
      done: action === "done",
      ...(options.note !== undefined ? { note: options.note } : {}),
    });
    return say(
      result as never,
      result.ok
        ? [result.line.trim(), ...(result.noteLine !== undefined ? [result.noteLine] : []), "Not committed: 'openspec-ui-cli task commit' sends it."].join("\n")
        : "",
    );
  } catch (error) {
    deps.stderr(`openspec-ui-cli: task ${action} could not complete: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
}
