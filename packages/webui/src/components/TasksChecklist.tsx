// 4.1 Чек-лист + прогресс.
// 4.2 Запуск отдельной задачи — компонент остаётся презентационным
// (не знает про `Transport`): вызывает `onRunTask`, а фактическая отправка
// команды `implement`, скоуп на этот пункт, через активный `Transport` —
// ответственность хоста/контейнера, который его использует (см. AiPanel.tsx
// за примером того, как это выглядит для компонента, которому Transport
// действительно нужен напрямую).

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
