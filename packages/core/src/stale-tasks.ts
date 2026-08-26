// Stale-pending-task detection over an already-fetched `ChangeTimeline`
// (see openspec/changes/add-stale-task-detection/design.md). Pure date
// math only — no git/fs access here, so this is safe to export from the
// browser-safe barrel too and reuse identically in both delivery
// targets, per host-neutral shared-logic convention (ADR-0001).

import type { ChangeTimeline, ChangeTimelineTask } from "./change-timeline.js";

/** A pending task sitting untouched for two weeks is a reasonable
 * default signal that it may have been forgotten — long enough not to
 * flag normal day-to-day pending work, short enough to still be
 * actionable when raised. */
export const DEFAULT_STALE_TASK_THRESHOLD_DAYS = 14;

/** A task is stale when it is still pending and its line has not been
 * touched (per git blame) within `thresholdDays`. A task whose
 * `lastTouchedDate` is undeterminable is never flagged — staleness is a
 * best-effort nudge, not something to guess at. */
export function isTaskStale(
  task: ChangeTimelineTask,
  thresholdDays: number = DEFAULT_STALE_TASK_THRESHOLD_DAYS,
  now: Date = new Date(),
): boolean {
  if (task.done || !task.lastTouchedDate) return false;
  const ageMs = now.getTime() - new Date(task.lastTouchedDate).getTime();
  return ageMs >= thresholdDays * 24 * 60 * 60 * 1000;
}

/** Returns every stale task in `timeline`, in their original `tasks.md`
 * order. */
export function findStaleTasks(
  timeline: ChangeTimeline,
  thresholdDays: number = DEFAULT_STALE_TASK_THRESHOLD_DAYS,
  now: Date = new Date(),
): ChangeTimelineTask[] {
  return timeline.tasks.filter((task) => isTaskStale(task, thresholdDays, now));
}
