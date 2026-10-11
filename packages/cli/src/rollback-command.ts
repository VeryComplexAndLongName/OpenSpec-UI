import path from "node:path";
import { createGitWrapper, describeWorkspaceLeaseConflict, readAgentStatuses, resolveAgentStatusDirectory,
  withWorkspaceLease, WorkbenchRecoveryService, WorkspaceLeaseManager } from "@openspec-ui/core";
import { changeSource, reportFailure, ReportRefusal, type ReportIo, type ReportOptions } from "./report-command.js";
import type { CheckpointPrompt } from "./run-change.js";

export interface RollbackDeps extends ReportIo {
  confirmation: CheckpointPrompt;
  source?: typeof changeSource;
  open?: typeof WorkbenchRecoveryService.open;
  busy?: (options: ReportOptions, root: string) => Promise<boolean>;
}

async function hasLiveWriter(options: ReportOptions, root: string) {
  const directory = await resolveAgentStatusDirectory(createGitWrapper({ cwd: options.workspaceRoot }), options.workspaceRoot);
  const { reports } = await readAgentStatuses(directory);
  return reports.some((report) => !report.gone && path.resolve(report.workingDirectory) === path.resolve(root));
}

export async function rollbackCommand(options: ReportOptions, deps: RollbackDeps): Promise<number> {
  try {
    if (!deps.confirmation.ask) throw new ReportRefusal("No interactive terminal can confirm restoration; nothing restored.");
    const source = await (deps.source ?? changeSource)(options);
    const lease = new WorkspaceLeaseManager(source.path, { hostKind: "cli" });
    const held = await withWorkspaceLease(lease, async () => {
      if (await (deps.busy ?? hasLiveWriter)(options, source.path)) throw new ReportRefusal("A live writer is working in this directory.");
      if (!await deps.confirmation.ask!(`Restore files changed by eligible recorded processes of ${options.changeName} to their earlier contents? This replaces current file contents and updates the recovery journal.`)) {
        throw new ReportRefusal("Restoration declined; nothing restored.");
      }
      const recovery = await (deps.open ?? WorkbenchRecoveryService.open)(source.path);
      const details = await recovery.changeRollbackDetails(options.changeName!);
      if (!details) throw new ReportRefusal("No eligible recorded checkpoints for this change.");
      const result = await recovery.rollbackChange(options.changeName!);
      if (result.conflicts.length) throw new ReportRefusal(`Conflicting files: ${result.conflicts.join(", ")}; nothing restored.`);
      deps.stdout(options.format === "json" ? JSON.stringify(result, null, 2) : `Restored ${result.restored.length} files.`);
      return 0;
    });
    if (!held.ok) throw new ReportRefusal(describeWorkspaceLeaseConflict(held.conflict));
    return held.value;
  } catch (error) {
    return reportFailure("rollback change", error, deps);
  }
}