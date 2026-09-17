// What keeps the Changes tree's standings current while the view is looked
// at — the-changes-views-see-a-run-start.
//
// Two things, both only while the Changes view is visible:
//
// - the standing timer: standings are read again once per fetch interval,
//   which fetches refs when they have grown that old;
// - a watcher on the run status records. A run writes its record when it
//   starts, renews it every few seconds and removes it when it ends, in a
//   directory beside the repository rather than in it, so the `openspec/**`
//   watcher never sees a run start. Each burst of events reads the runs
//   again, from the records alone.

import * as vscode from "vscode";
import { createGitWrapper, resolveAgentStatusDirectory, STANDING_FETCH_INTERVAL_MS } from "@openspec-ui/core";

/** How long record events are gathered before the runs are read again: a
 * burst of renewals from several runs is one reading. */
export const CHANGES_RECORDS_EVENT_WINDOW_MS = 1_000;

export interface ChangesViewFollowerDeps {
  workspaceRoot: string;
  view: Pick<vscode.TreeView<unknown>, "visible" | "onDidChangeVisibility">;
  tree: { refresh(): void; refreshRuns(): void };
  /** Where the status records are. Test seam; production resolves it from
   * the repository's worktrees, as the Pipeline panel does. */
  statusDirectory?: (workspaceRoot: string) => Promise<string>;
}

function resolveStatusDirectory(workspaceRoot: string): Promise<string> {
  return resolveAgentStatusDirectory(createGitWrapper({ cwd: workspaceRoot }), workspaceRoot);
}

/** Follows the Changes view's visibility until disposed. */
export function followChangesView(deps: ChangesViewFollowerDeps): vscode.Disposable {
  const statusDirectory = deps.statusDirectory ?? resolveStatusDirectory;
  let timer: ReturnType<typeof setInterval> | undefined;
  let gathering: ReturnType<typeof setTimeout> | undefined;
  let watching: vscode.Disposable[] = [];
  /** Bumped on every switch, so a directory resolved for a view since
   * hidden makes no watcher. */
  let generation = 0;
  /** Resolved once: where the records are does not move while the editor
   * runs, and resolving lists git worktrees. */
  let directory: Promise<string> | undefined;

  const stop = () => {
    generation += 1;
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
    if (gathering !== undefined) clearTimeout(gathering);
    gathering = undefined;
    for (const disposable of watching) disposable.dispose();
    watching = [];
  };

  const onRecords = () => {
    // An event a disposed watcher still delivers on its way out is for a
    // view nobody is looking at.
    if (watching.length === 0 || gathering !== undefined) return;
    gathering = setTimeout(() => {
      gathering = undefined;
      deps.tree.refreshRuns();
    }, CHANGES_RECORDS_EVENT_WINDOW_MS);
  };

  const start = () => {
    stop();
    const current = generation;
    timer = setInterval(() => deps.tree.refresh(), STANDING_FETCH_INTERVAL_MS);
    directory ??= statusDirectory(deps.workspaceRoot);
    // Where the directory cannot be resolved there is no watcher, and the
    // tree keeps its other triggers.
    directory.then((resolved) => {
      if (current !== generation) return;
      const records = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.file(resolved), "*.json"));
      watching.push(records, records.onDidCreate(onRecords), records.onDidChange(onRecords), records.onDidDelete(onRecords));
    }, () => {
      directory = undefined;
    });
  };

  const follow = (visible: boolean) => (visible ? start() : stop());
  follow(deps.view.visible);
  const subscription = deps.view.onDidChangeVisibility((event) => follow(event.visible));
  return {
    dispose: () => {
      subscription.dispose();
      stop();
    },
  };
}
