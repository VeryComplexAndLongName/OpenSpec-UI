// Counting over a change's task list, apart from reading one.
//
// `task-checklist.ts` opens files, so it can never reach the browser
// bundle; the arithmetic over what it produced has no such need. The
// leaf beside the reader, the way `human-only-inbox-view.ts` sits
// beside `human-only-inbox.ts`.
//
// It exists because the same one-line count had been written three
// times — twice in the extension's command handlers and once in the
// standalone shell's run dispatch — feeding the same
// `recommendTemplate` input. Three copies of a rule is three chances
// for it to mean three things. See a-date-is-one-day-in-every-source.

/** How many of a change's tasks are still open.
 *
 * Deliberately takes the shape rather than `TaskChecklistItem`, so a
 * caller holding a `ChangeTimelineTask` — which is that item plus its
 * dates — passes it without a cast, and so nothing here needs the
 * module that reads files. */
export function openTaskCount(tasks: readonly { done: boolean }[]): number {
  return tasks.filter((task) => !task.done).length;
}
