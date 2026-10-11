import { createGitWrapper, isRunLogId, readRepositoryAuditEntries, readRunLog, repositoryWorkspaceRoots } from "@openspec-ui/core";
import { reportCommand, ReportRefusal, type ReportIo, type ReportOptions } from "./report-command.js";

export async function readRunReport(options: ReportOptions) {
  const runId = options.changeName!;
  if (!isRunLogId(runId)) throw new Error("Invalid runId; use a persisted run id, not a path.");
  const git = createGitWrapper({ cwd: options.workspaceRoot });
  const roots = await repositoryWorkspaceRoots({ git, workspaceRoot: options.workspaceRoot });
  const entries = (await readRepositoryAuditEntries({ git, workspaceRoot: options.workspaceRoot }))
    .filter((entry) => entry.runId === runId).sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  const logs = await Promise.all(roots.map(async (root) => ({ path: root, records: await readRunLog(root, runId) })));
  const retained = logs.filter((log) => log.records !== undefined);
  if (entries.length === 0 && retained.length === 0) throw new ReportRefusal(`Unknown runId ${runId}; status instanceId is a different identifier.`);
  return { runId, entries, logs: retained, outputMissing: retained.length === 0 };
}

export function showRunCommand(options: ReportOptions, io: ReportIo, read = readRunReport) {
  return reportCommand("show run", options, io, () => read(options), (result) =>
    `runId ${result.runId}${result.outputMissing ? " (retained output unavailable)" : ""}\n${JSON.stringify(result, null, 2)}`);
}