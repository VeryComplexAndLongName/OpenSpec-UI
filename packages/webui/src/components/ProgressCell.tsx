// A change's task progress as the summary's rows draw it
// (the-summary-looks-like-the-mockup): a bar and "done / total". The bar is an
// image named by its percentage, since the count beside it already says the
// rest; a change with no tasks has no bar, only "0 / 0".

import { taskCompletionPercent } from "./task-progress.js";

export function ProgressCell({ completedTasks, totalTasks }: { completedTasks: number; totalTasks: number }) {
  const percent = taskCompletionPercent(completedTasks, totalTasks);
  return (
    <span className="openspec-row-tasks">
      {percent === null ? null : (
        <span className="openspec-progress" role="img" aria-label={`${percent}% done`}>
          <span style={{ width: `${percent}%` }} />
        </span>
      )}
      <span className="openspec-change-progress">{`${completedTasks} / ${totalTasks}`}</span>
    </span>
  );
}
