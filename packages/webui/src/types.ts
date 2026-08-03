// Общие типы данных, которые компоненты `webui` принимают как props.
// Компоненты — презентационные: они не делают fetch и не парсят markdown/
// openspec-состояние сами (это делает хост — standalone-app/vscode-extension,
// используя `@openspec-ui/core`) — см. design.md "Goals".

import type { ChangeState } from "@openspec-ui/core";

export interface ChangeSummary {
  name: string;
  /** Вычислено `execution-core`'s `deriveChangeState`/`readChangeState` —
   * компонент только отображает, не пересчитывает (см. spec.md). */
  state: ChangeState;
  completedTasks: number;
  totalTasks: number;
  /** ISO timestamp последнего изменения, если доступен (для истории Archive). */
  lastModified?: string;
}

export interface TaskItem {
  id: string;
  description: string;
  done: boolean;
}
