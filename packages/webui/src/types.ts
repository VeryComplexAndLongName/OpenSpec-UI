// Shared data types that `webui` components accept as props. Components
// are presentational: they do not fetch data or parse markdown/openspec
// state themselves (that is done by the host — standalone-app/
// vscode-extension, using `@openspec-ui/core`) — see design.md "Goals".

import type { ChangeState } from "@openspec-ui/core";

export interface ChangeSummary {
  name: string;
  /** Computed by `execution-core`'s `deriveChangeState`/`readChangeState` —
   * the component only displays it, it does not recompute it (see spec.md). */
  state: ChangeState;
  completedTasks: number;
  totalTasks: number;
  /** ISO timestamp of the last modification, if available (for the Archive history). */
  lastModified?: string;
}

export interface TaskItem {
  id: string;
  description: string;
  done: boolean;
}
