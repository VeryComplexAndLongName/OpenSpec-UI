// 4.1 Checklist + progress.
// 4.2 Running an individual task — the component stays presentational
// (it does not know about `Transport`): it calls `onRunTask`, and actually
// sending the `implement` command, scoped to that item, through the active
// `Transport` is the responsibility of the host/container that uses it
// (see AiPanel.tsx for an example of what that looks like for a component
// that genuinely needs the Transport directly).

import type { TaskItem } from "../types.js";

export interface TasksChecklistProps {
  tasks: TaskItem[];
  onRunTask?: (task: TaskItem) => void;
}

export function TasksChecklist({ tasks, onRunTask }: TasksChecklistProps) {
  const completed = tasks.filter((t) => t.done).length;

  return (
    <div className="openspec-tasks-checklist">
      <div className="openspec-tasks-progress" data-testid="tasks-progress">
        {completed}/{tasks.length} complete
      </div>
      <ul data-testid="tasks-list">
        {tasks.map((task) => (
          <li key={task.id} className={task.done ? "openspec-task--done" : "openspec-task--pending"}>
            <span aria-hidden="true">{task.done ? "[x]" : "[ ]"}</span>
            <span>{task.description}</span>
            {!task.done && (
              <button type="button" data-testid={`run-task-${task.id}`} onClick={() => onRunTask?.(task)}>
                Run
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
