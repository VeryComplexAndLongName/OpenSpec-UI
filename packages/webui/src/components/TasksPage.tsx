// A change's tasks on a page of their own — a-card-works-its-own-tasks.
//
// What a card's name opens in a browser, which cannot open a file in an
// editor: every task of the change, whole, from the change's own worktree
// (or this checkout's copy, read-only), with the controls its card offers.
// A page has the room a card does not, so each task's body is shown under
// it; pressing a task opens the same panel the board uses.

import { useCallback, useEffect, useRef, useState } from "react";
import { describeTaskRows, type SurveyedTask, type TaskRow } from "@openspec-ui/core/browser";
import { renderInlineMarkdown, renderMarkdown } from "../markdown.js";
import { TaskPanel, type TaskActions, type TaskSelection } from "./TaskPanel.js";

/** What the page reads: the shape of core's `readChangeTaskRows`. */
export type ChangeTasksReading =
  | { ok: true; changeName: string; source: "own-worktree" | "this-checkout"; path: string; tasksPath: string; rows: SurveyedTask[] }
  | { ok: false; kind: string; reason: string };

export interface TasksPageProps {
  changeName: string;
  load: () => Promise<ChangeTasksReading>;
  /** What may be done in the change's own worktree. The page's own "Go to
   * line" is its own: it scrolls to the task. */
  actions?: TaskActions;
  copyText?: (text: string) => Promise<void>;
  /** The line to bring into view and mark on opening, from the address. */
  line?: number;
}

export function TasksPage({ changeName, load, actions, copyText, line }: TasksPageProps): JSX.Element {
  const [reading, setReading] = useState<ChangeTasksReading | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [chosen, setChosen] = useState<TaskSelection | undefined>(undefined);
  const [marked, setMarked] = useState<number | undefined>(line);
  const list = useRef<HTMLOListElement>(null);

  const read = useCallback(async () => {
    try {
      setReading(await load());
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [load]);
  useEffect(() => { void read(); }, [read]);

  useEffect(() => {
    if (marked === undefined) return;
    const row = list.current?.querySelector<HTMLElement>(`[data-line='${marked}']`);
    if (row !== null && row !== undefined && typeof row.scrollIntoView === "function") row.scrollIntoView({ block: "center" });
  }, [marked, reading]);

  if (error !== undefined) return <p className="openspec-shell-error" role="alert" data-testid="tasks-page-error">{error}</p>;
  if (reading === undefined) return <p className="openspec-shell-note" data-testid="tasks-page-loading">{`Reading the tasks of ${changeName}…`}</p>;
  if (!reading.ok) return <p className="openspec-shell-note" data-testid="tasks-page-refused">{reading.reason}</p>;

  const own = reading.source === "own-worktree";
  const where = own ? reading.path : "this checkout";
  const rows: TaskRow[] = describeTaskRows(reading.rows, undefined);
  // On this page "Go to line" is a scroll: the task is already here.
  const pageActions: TaskActions | undefined = actions === undefined ? undefined : {
    ...actions,
    open: (name, target, at) => {
      if (target === "tasks" && at !== undefined && name === changeName) {
        setChosen(undefined);
        setMarked(at);
        return;
      }
      actions.open?.(name, target, at);
    },
  };

  return (
    <div className="openspec-tasks-page" data-testid="tasks-page">
      <div className="openspec-panel-head">
        <h2>{`Tasks of ${changeName}`}</h2>
        <span className="openspec-panel-head-note" data-testid="tasks-page-where">
          {own ? `from its own worktree, ${reading.path}` : "from this checkout, read-only: it has no worktree of its own"}
        </span>
      </div>
      {own && actions !== undefined ? (
        <button
          type="button"
          className="button"
          data-testid="tasks-page-list"
          onClick={() => setChosen({ changeName, directory: reading.path, where, own })}
        >
          Show Actions...
        </button>
      ) : null}
      <ol className="openspec-tasks-page-list" ref={list}>
        {rows.map((row) => (
          <li
            key={row.lineNumber ?? row.text}
            data-line={row.lineNumber}
            data-done={row.done ? "true" : "false"}
            data-marked={row.lineNumber === marked ? "true" : "false"}
            className="openspec-tasks-page-task"
          >
            <button
              type="button"
              className="openspec-tasks-page-open"
              data-testid={`tasks-page-row-${row.number ?? row.lineNumber}`}
              onClick={() => setChosen({ changeName, directory: reading.path, where, own, row })}
            >
              <span className="openspec-tasks-page-check" aria-hidden="true">{row.done ? "[x]" : "[ ]"}</span>
              {row.number !== undefined ? <strong>{`${row.number} `}</strong> : null}
              {renderInlineMarkdown(row.text)}
            </button>
            <span className="openspec-shell-note">{row.word}</span>
            {row.body !== undefined ? <div className="openspec-md-preview">{renderMarkdown(row.body)}</div> : null}
          </li>
        ))}
      </ol>
      {chosen !== undefined ? (
        <TaskPanel
          selection={chosen.row === undefined ? chosen : { ...chosen, row: rows.find((row) => row.lineNumber === chosen.row?.lineNumber) ?? chosen.row }}
          {...(pageActions !== undefined ? { actions: pageActions } : {})}
          {...(copyText !== undefined ? { copyText } : {})}
          onClose={() => setChosen(undefined)}
          onChanged={() => void read()}
        />
      ) : null}
    </div>
  );
}
