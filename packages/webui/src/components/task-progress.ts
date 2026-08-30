// Shared task-completion formatting for ChangesList/ArchiveList (see
// openspec/changes/change-progress-display/proposal.md) — one
// implementation, not two independently-maintained copies.

/** `null` when `totalTasks <= 0` — a change with no tasks at all is a
 * different state than "0% done," not the same thing. */
export function taskCompletionPercent(completedTasks: number, totalTasks: number): number | null {
  if (totalTasks <= 0) return null;
  return Math.round((completedTasks / totalTasks) * 100);
}

export function formatTaskProgress(completedTasks: number, totalTasks: number): string {
  const percent = taskCompletionPercent(completedTasks, totalTasks);
  return percent === null ? `${completedTasks}/${totalTasks}` : `${completedTasks}/${totalTasks} (${percent}%)`;
}
