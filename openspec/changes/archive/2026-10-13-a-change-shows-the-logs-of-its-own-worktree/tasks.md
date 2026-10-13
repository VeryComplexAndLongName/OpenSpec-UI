From a bug found on 2026-10-12: Show Logs on a card said there were no logs
for a change whose runs had logged in its own worktree.

## 1. Core

- [x] 1.1 `packages/core/src/change-run-logs.ts`: `changeLogsRoot`,
  `listChangeRunLogs` and `readChangeRunLog` resolve a change's own worktree
  with `resolveOwnWorktree` and fall back to the host's root; none takes a
  path. Exported from `packages/core/src/index.ts`, and not from `browser.ts`.
- [x] 1.2 `packages/core/src/change-run-logs.test.ts`: the own worktree's
  logs are listed and read where the host's root kept none; the host's root is
  the fallback with no worktree and where the list cannot be read; a run id
  naming a path reads nothing. Verified to fail with the resolver returning
  the host's root.
- [x] 1.3 `packages/core/src/change-run-logs.git.test.ts` and
  `packages/core/vitest.workspace.ts`: the same over a real `git worktree
  add`, in the `core-git-subprocess` project.

## 2. Hosts

- [x] 2.1 `packages/server/src/rest.ts`: `handleRunLogsListRequest` lists
  through `listChangeRunLogs` where the body names a change, and
  `handleRunLogReadRequest` reads through `readChangeRunLog` where it names
  one, answering 400 for a change name that is not a non-empty string.
  `authorizeCwd` still checks the workspace root, never a path computed here.
- [x] 2.2 `packages/extension/src/webview/pipeline-panel.ts`:
  `pipeline/run-logs` lists through `listChangeRunLogs`, and `pipeline/run-log`
  reads through `readChangeRunLog` where `changeName` is given, refusing one
  that is not a non-empty string.
- [x] 2.3 Tests in `packages/server/src/server.test.ts` and
  `packages/extension/src/webview/pipeline-panel.test.ts` for a named change
  and for one that is not a name.

## 3. Web UI

- [x] 3.1 `packages/webui/src/run-logs-client.ts`,
  `packages/webui/src/standalone-entry.tsx` and
  `packages/webui/src/pipeline-entry.tsx`: reading one run sends the change
  name the view was opened for.
- [x] 3.2 `packages/webui/src/components/PipelineView.tsx`: `DirectoryCard`
  offers Show Logs on a card of a change's own worktree, with `onViewLogs`
  threaded from `controls` along the route `onStart` takes. Not on a card of a
  directory that is not the change's own.
- [x] 3.3 Test in `packages/webui/src/components/PipelineView.test.tsx`: the
  button is on `pipeline-directory-0-node-fresh` and calls `onViewLogs` with
  `fresh`, and is absent from another directory's card. Verified to fail with
  the `own` condition removed.

## 4. Documents

- [x] 4.1 A changeset: core, server, extension, webui - patch.

## 5. Checks

- [x] 5.1 `npm run typecheck && npm run lint`, and the affected tests of core,
  server, extension and webui.
  2026-10-12/13: typecheck clean; lint 0 errors; core 2303 passed, cli 285,
  extension 539, server 136, webui 769.
- [x] 5.2 `openspec validate a-change-shows-the-logs-of-its-own-worktree
  --strict`, and the merge gate with `--change` and the worktree's absolute
  path as `--cwd`.
  2026-10-13: "Change 'a-change-shows-the-logs-of-its-own-worktree' is
  valid".
- [x] 5.3 On the real data that showed the bug: `listChangeRunLogs` over the
  main checkout for `remaining-groups-move-into-the-register` lists its two
  runs and reads the newest.
  2026-10-12: listed 2 runs (3257e8cf, 4143b08e, both apply, cancelled) and
  read the newest's 494 records from its own worktree, where the old read
  over the host root found 0.
