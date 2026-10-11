import { readChangeReadiness, readChangeStagesOfWorkspace, readChangeTaskRows } from "@openspec-ui/core";
import { reportCommand, type ReportIo, type ReportOptions } from "./report-command.js";

export async function readChangesReport(options: ReportOptions) {
  const [stages, readiness] = await Promise.all([
    readChangeStagesOfWorkspace(options.workspaceRoot),
    readChangeReadiness({ workspaceRoot: options.workspaceRoot }),
  ]);
  return Promise.all(stages.map(async (stage) => {
    const tasks = await readChangeTaskRows({ repositoryRoot: options.workspaceRoot, changeName: stage.changeName });
    const ready = readiness.changes.find((item) => item.changeName === stage.changeName);
    return {
      ...stage, readiness: ready,
      path: tasks.ok ? tasks.path : ready?.worktreePath,
      tasks: tasks.ok ? { total: tasks.rows.length, done: tasks.rows.filter((row) => row.done).length } : undefined,
      taskReadRefusal: tasks.ok ? undefined : tasks.reason,
    };
  }));
}

export function showChangesCommand(options: ReportOptions, io: ReportIo, read = readChangesReport) {
  return reportCommand("show changes", options, io, () => read(options), (rows) => rows.length === 0
    ? "No active changes."
    : rows.map((row) => `${row.changeName} ${row.stage} ${row.tasks ? `${row.tasks.done}/${row.tasks.total} tasks` : "tasks unavailable"} ${row.path ?? "source unavailable"}${row.readiness?.blockers.length ? ` blocked by ${row.readiness.blockers.join(", ")}` : ""}`).join("\n"));
}