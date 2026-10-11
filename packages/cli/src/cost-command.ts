import path from "node:path";
import { buildUsageReport, createGitWrapper, readRepositoryAuditEntries, repositoryWorkspaceRoots } from "@openspec-ui/core";
import { changeSource, reportCommand, type ReportIo, type ReportOptions } from "./report-command.js";

export async function readCostReport(options: ReportOptions) {
  await changeSource(options);
  const git = createGitWrapper({ cwd: options.workspaceRoot });
  const roots = await repositoryWorkspaceRoots({ git, workspaceRoot: options.workspaceRoot });
  const normalize = (value: string) => process.platform === "win32" ? path.resolve(value).toLowerCase() : path.resolve(value);
  const directories = new Set(roots.map((root) => normalize(path.join(root, "openspec", "changes", options.changeName!))));
  const entries = await readRepositoryAuditEntries({ git, workspaceRoot: options.workspaceRoot });
  const runIds = new Set(entries.filter((entry) => entry.changeDir && directories.has(normalize(entry.changeDir))).map((entry) => entry.runId));
  const selected = entries.filter((entry) => runIds.has(entry.runId));
  return { changeName: options.changeName, recordedRunCount: runIds.size, ...buildUsageReport(selected) };
}

export function showCostCommand(options: ReportOptions, io: ReportIo, read = readCostReport) {
  return reportCommand("show cost", options, io, () => read(options), (result) =>
    `Recorded usage for ${result.changeName}: ${result.recordedRunCount} runs, ${result.unmeasuredRunCount} unmeasured\n${JSON.stringify(result.totalsByAgent, null, 2)}`);
}