import { writeFile } from "node:fs/promises";
import path from "node:path";
import { captureCheckpoint, serializeCheckpoint, WorkbenchRunJournal } from "@openspec-ui/core";

export interface SeedInterruptedRunOptions {
  root: string;
  relativeFilePath: string;
  beforeContent: string;
  afterContent: string;
  changeName: string;
  processId?: string;
}

/** Seeds a journal representing a run that was `running` when its host
 * stopped, with a checkpoint captured before the mutation but not yet
 * finalized -- exactly the on-disk state a real crash-mid-run would leave
 * (see design.md: WorkbenchRecoveryService.runMutating() only persists
 * after a run completes, so this can never happen for a real WS-driven
 * `implement` run today; this fixture recreates it directly so the real
 * recovery/finalize/rollback pipeline -- which does exist and does work --
 * can be exercised through the browser). Must run before any server opens
 * `root`: WorkbenchRecoveryService.open()'s constructor flips the seeded
 * `running` state to `interrupted` and finalizes the checkpoint's delta
 * against whatever the filesystem looks like at that moment, which is why
 * the mutation happens after the checkpoint is captured but before the
 * journal reflects a finalized delta. */
export async function seedInterruptedRun(options: SeedInterruptedRunOptions): Promise<string> {
  const { root, relativeFilePath, beforeContent, afterContent, changeName, processId = "seeded-interrupted-run" } = options;
  const filePath = path.join(root, relativeFilePath);

  await writeFile(filePath, beforeContent, "utf8");
  const checkpoint = await captureCheckpoint(root);
  await writeFile(filePath, afterContent, "utf8");

  await new WorkbenchRunJournal(root).save({
    processes: [{
      id: processId,
      operation: "implement",
      changeName,
      mutating: true,
      state: "running",
      createdAt: new Date(Date.now() - 60_000).toISOString(),
      startedAt: new Date(Date.now() - 30_000).toISOString(),
    }],
    checkpointSessions: [{
      processId,
      changeName,
      checkpoint: serializeCheckpoint(checkpoint),
    }],
  });

  return processId;
}
