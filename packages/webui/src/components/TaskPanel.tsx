// One task, whole, with what a person may do to it — a-card-works-its-own-tasks,
// ADR 0026 amended 2026-10-05.
//
// Drawn over the board along the window's right side, as a run's logs are:
// a card's height is worked out in core from what it lists, so a task
// opened in place would run into the card below it. The panel has room for
// the whole text, what is written under it, and a note.
//
// This file renders and forwards. Whether a task may be ticked, where the
// change's own worktree is, and what is written are core's; the host turns a
// press into a request and says what came of it. A card read from anywhere
// but its change's own worktree is shown here read-only.

import { createContext, useEffect, useId, useRef, useState } from "react";
import type { TaskRow } from "@openspec-ui/core/browser";
import { renderInlineMarkdown, renderMarkdown } from "../markdown.js";

/** What a card's name and its panel can ask the host to open. */
export type OpenTarget = "tasks" | "proposal" | "design" | "specs" | "window" | "copyPath";

const OPEN_TARGET_WORDS: Readonly<Record<OpenTarget, string>> = {
  tasks: "Open tasks.md",
  proposal: "Open the proposal",
  design: "Open the design",
  specs: "Show the specs folder",
  window: "Open the worktree in a new window",
  copyPath: "Copy the worktree's path",
};

/** What came of a press, in the words to show. */
export interface TaskActionResult {
  ok: boolean;
  said: string;
}

/** What a host lets a card do in its change's own worktree. Absent, every
 * card is read-only, as before. */
export interface TaskActions {
  set(changeName: string, task: { lineNumber: number; text: string }, done: boolean, note?: string): Promise<TaskActionResult>;
  commit(changeName: string): Promise<TaskActionResult>;
  /** Runs the agent a delegated task names. Absent where the host runs
   * none. */
  run?(changeName: string, lineNumber: number): Promise<TaskActionResult>;
  /** Opens a change's file or folder. `line` with `tasks` opens it there. */
  open?(changeName: string, target: OpenTarget, line?: number): void;
  /** Which targets this host can open, in the order to offer them. */
  openTargets: readonly OpenTarget[];
}

/** A task, or a change's own list, chosen on a card. */
export interface TaskSelection {
  changeName: string;
  /** The directory the card was read from, and its label. */
  directory: string;
  where: string;
  /** Whether that directory is the change's own worktree, where a person
   * may act. */
  own: boolean;
  /** The task, or absent for the change's list as a whole. */
  row?: TaskRow;
}

/** What a card reads from the view it is drawn in, rather than through
 * every component between them. */
export interface TaskCardContextValue {
  hidesDone(directory: string, changeName: string): boolean;
  toggleHideDone(directory: string, changeName: string): void;
  /** Chooses a task, or a change's list. Absent, a row is not a control. */
  select?: (selection: TaskSelection) => void;
  /** Opens a change from a card read from its own worktree, wherever it is
   * drawn. */
  openOwn?: (changeName: string) => void;
}

export const TaskCardContext = createContext<TaskCardContextValue>({
  hidesDone: () => false,
  toggleHideDone: () => undefined,
});

/** A row's whole text: its number, its words, and what is written under it.
 * The hint on a row, and what a reader of the panel sees first. */
export function wholeTaskText(row: Pick<TaskRow, "number" | "text" | "body" | "word">): string {
  const head = `${row.number !== undefined ? `${row.number} ` : ""}${row.text}`;
  return [`${head} (${row.word})`, ...(row.body !== undefined ? [row.body] : [])].join("\n\n");
}

/** Whether ticking the task needs a note: the merge gate requires one under
 * a closed Human-only or delegated task. */
export function tickNeedsNote(row: Pick<TaskRow, "closedBy" | "done">): boolean {
  return !row.done && row.closedBy !== "agent";
}

export interface TaskPanelProps {
  selection: TaskSelection;
  actions?: TaskActions;
  /** Copies text, for a host that allows it: the worktree's path where the
   * host cannot open the target itself. */
  copyText?: (text: string) => Promise<void>;
  onClose: () => void;
  /** Called after a press changed something, so the board reads again. */
  onChanged?: () => void;
}

export function TaskPanel({ selection, actions, copyText, onClose, onChanged }: TaskPanelProps): JSX.Element {
  const { changeName, row, own } = selection;
  const panel = useRef<HTMLElement>(null);
  const noteId = useId();
  const [note, setNote] = useState("");
  const [said, setSaid] = useState<TaskActionResult | null>(null);
  const [busy, setBusy] = useState(false);

  // Takes the focus, and gives it back to what had it on closing: the row or
  // the card's control that was pressed.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  useEffect(() => {
    setNote("");
    setSaid(null);
  }, [changeName, row?.lineNumber]);

  const acting = own && actions !== undefined;
  const needsNote = row !== undefined && tickNeedsNote(row);

  async function press(work: () => Promise<TaskActionResult>): Promise<void> {
    setBusy(true);
    try {
      const result = await work();
      setSaid(result);
      if (result.ok) {
        setNote("");
        onChanged?.();
      }
    } catch (error) {
      setSaid({ ok: false, said: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  }

  const targets = (actions?.openTargets ?? []).filter((target) => own || target === "tasks");

  return (
    <section
      ref={panel}
      className="openspec-run-logs openspec-task-panel"
      role="dialog"
      aria-modal="true"
      aria-label={row !== undefined ? `Task ${row.number ?? ""} of ${changeName}` : `Tasks of ${changeName}`}
      data-testid="task-panel"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="openspec-run-logs-head">
        <h3>{row !== undefined ? `${row.number !== undefined ? `${row.number} · ` : ""}${changeName}` : changeName}</h3>
        <button type="button" className="button" data-testid="task-panel-close" onClick={onClose}>Close</button>
      </div>
      <p className="openspec-shell-note" data-testid="task-panel-where">
        {own
          ? `In ${selection.where}, ${changeName}'s own worktree.`
          : `Read from ${selection.where}. Nothing here acts on it: only a change's own worktree is worked from its card.`}
      </p>

      {row !== undefined ? (
        <div className="openspec-task-panel-task" data-testid="task-panel-task">
          <p className="openspec-task-panel-text">
            {row.number !== undefined ? <strong>{`${row.number} `}</strong> : null}
            {renderInlineMarkdown(row.text)}
          </p>
          <p className="openspec-shell-note">{row.word}</p>
          {row.body !== undefined ? <div className="openspec-md-preview" data-testid="task-panel-body">{renderMarkdown(row.body)}</div> : null}
        </div>
      ) : null}

      {acting && row !== undefined && row.lineNumber !== undefined ? (
        <form
          className="openspec-task-panel-form"
          data-testid="task-panel-form"
          onSubmit={(event) => {
            event.preventDefault();
            const lineNumber = row.lineNumber as number;
            const words = note.trim();
            if (needsNote && words.length === 0) {
              setSaid({ ok: false, said: `${row.closedBy === "person" ? "A Human-only" : "A delegated"} task is closed with a note saying what was checked.` });
              return;
            }
            void press(() => actions.set(changeName, { lineNumber, text: `${row.number !== undefined ? `${row.number} ` : ""}${row.text}` }, !row.done, words.length > 0 ? words : undefined));
          }}
        >
          <label htmlFor={noteId}>
            {row.done ? "Why it is reopened (optional)" : needsNote ? "What was checked (required)" : "A note (optional)"}
          </label>
          <textarea id={noteId} data-testid="task-panel-note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
          <div className="openspec-task-panel-buttons">
            <button type="submit" className="button primary" data-testid="task-panel-set" disabled={busy}>
              {row.done ? "Reopen the task" : "Close the task"}
            </button>
            {row.closedBy === "named-agent" && !row.done && actions.run !== undefined && row.agent !== undefined ? (
              <button
                type="button"
                className="button"
                data-testid="task-panel-run"
                disabled={busy}
                onClick={() => void press(() => (actions.run as NonNullable<TaskActions["run"]>)(changeName, row.lineNumber as number))}
              >
                {`Run on ${row.agent}`}
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      <div className="openspec-task-panel-buttons" data-testid="task-panel-actions">
        {row !== undefined && row.lineNumber !== undefined && actions?.open !== undefined && targets.includes("tasks") ? (
          <button type="button" className="button" data-testid="task-panel-goto" onClick={() => actions.open?.(changeName, "tasks", row.lineNumber)}>
            Go to line
          </button>
        ) : null}
        {acting ? (
          <button type="button" className="button" data-testid="task-panel-commit" disabled={busy} onClick={() => void press(() => actions.commit(changeName))}>
            Commit and push tasks.md
          </button>
        ) : null}
        {targets.filter((target) => target !== "tasks" || row === undefined).map((target) => (
          <button
            key={target}
            type="button"
            className="button"
            data-testid={`task-panel-open-${target}`}
            onClick={() => actions?.open?.(changeName, target)}
          >
            {OPEN_TARGET_WORDS[target]}
          </button>
        ))}
        {own && copyText !== undefined && !targets.includes("copyPath") ? (
          <button type="button" className="button" data-testid="task-panel-copy-path" onClick={() => void copyText(selection.directory)}>
            {OPEN_TARGET_WORDS.copyPath}
          </button>
        ) : null}
      </div>

      {said !== null ? (
        <p className={said.ok ? "openspec-shell-note" : "openspec-shell-error"} role="status" data-testid="task-panel-said">{said.said}</p>
      ) : null}
    </section>
  );
}
