// Where a schedule is kept, and how it survives the application closing.
//
// The whole point of the feature is the case where nothing is running at
// the appointed time, so the schedule has to outlive the process. It
// lives beside the audit log, in `.openspec-ui/`, which is gitignored:
// "start this one at six" is one person's intent on one machine, not
// project configuration that belongs in a committed file.
//
// Node-only, so `scheduled-runs.ts` stays pure and the browser can read
// what is due without pulling `node:fs` into its bundle.
//
// See a-run-can-be-scheduled.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ScheduledRun } from "./scheduled-runs.js";

export function scheduledRunsPath(workspaceRoot: string): string {
  return path.join(path.resolve(workspaceRoot), ".openspec-ui", "scheduled-runs.json");
}

/** Everything scheduled in this workspace.
 *
 * A missing file is an empty schedule — the ordinary state of a
 * workspace nobody has scheduled anything in. A file that cannot be
 * parsed is also read as empty rather than thrown: a schedule is not
 * worth refusing to open the application over, and the next write
 * replaces it. */
export async function readScheduledRuns(workspaceRoot: string): Promise<ScheduledRun[]> {
  try {
    const raw = await readFile(scheduledRunsPath(workspaceRoot), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isScheduledRun);
  } catch {
    return [];
  }
}

export async function writeScheduledRuns(workspaceRoot: string, entries: readonly ScheduledRun[]): Promise<void> {
  const filePath = scheduledRunsPath(workspaceRoot);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
}

/** Adds one, keeping what is already there. The file is replaced on
 * every write, so an add that did not read first would delete every
 * other schedule — the same defect this repository has now fixed three
 * times in configuration writers. */
export async function addScheduledRun(workspaceRoot: string, entry: ScheduledRun): Promise<ScheduledRun[]> {
  const entries = [...await readScheduledRuns(workspaceRoot), entry];
  await writeScheduledRuns(workspaceRoot, entries);
  return entries;
}

function isScheduledRun(value: unknown): value is ScheduledRun {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.changeName === "string" && entry.changeName.length > 0
    && typeof entry.startAt === "string" && entry.startAt.length > 0
    && typeof entry.path === "string"
    && typeof entry.requestedAt === "string";
}
