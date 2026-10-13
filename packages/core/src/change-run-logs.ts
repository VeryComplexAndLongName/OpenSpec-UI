import { resolveOwnWorktree } from "./own-worktree-tasks.js";
import { listRunLogs, readRunLog, type RunLogRecord, type RunLogSummary } from "./run-log.js";
import type { GitWrapper } from "./git.js";

export interface ChangeLogsOptions {
    repositoryRoot: string;
    changeName: string;
    /** Test seam; production lists the repository's worktrees. */
    git?: Pick<GitWrapper, "worktreeList">;
}

/** Where a change's logs are: its own worktree where it has one, else the host's root. */
export async function changeLogsRoot(options: ChangeLogsOptions): Promise<string> {
    const own = await resolveOwnWorktree({
        repositoryRoot: options.repositoryRoot,
        changeName: options.changeName,
        ...(options.git !== undefined ? { git: options.git } : {}),
    });
    return own.ok ? own.path : options.repositoryRoot;
}

/** The runs a change left logs of, newest first. */
export async function listChangeRunLogs(options: ChangeLogsOptions): Promise<RunLogSummary[]> {
    return listRunLogs(await changeLogsRoot(options), { changeName: options.changeName });
}

/** One run's log, read where the change's own logs are. */
export async function readChangeRunLog(options: ChangeLogsOptions & { runId: string }): Promise<RunLogRecord[] | undefined> {
    return readRunLog(await changeLogsRoot(options), options.runId);
}
