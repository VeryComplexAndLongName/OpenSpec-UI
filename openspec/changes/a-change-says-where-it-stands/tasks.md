Where a change stands across the repository, in every view that lists
changes, and the reply every request to an agent leaves (ADR 0026 and ADR
0028, amendments of 2026-09-13).

## 1. Reading refs

- [x] 1.1 `GitWrapper` in `packages/core/src/git.ts` gains:
  - `listTreeNames(ref, path)`: the entry names under `path` at `ref`;
  - `showFile(ref, path)`: the file's text at `ref`, or `undefined`;
  - `refExists(ref)`;
  - `fetch(remote)`: fetches without touching any working tree;
  - `lastFetchedAt()`: the modification time of `FETCH_HEAD` in the common
    git directory, or `undefined`.

  Each runs against the wrapper's own repository.

  Done, with three more the reading needs: `listRefs(prefixes)`, which gives
  every ref and the commit it points at in one call; `resolveCommit(ref)`;
  and `mergeBase(left, right)`.
- [x] 1.2 `packages/core/src/git.test.ts`, against a temporary repository
  with a bare remote:
  - a file and a directory are read from a branch that is not checked out;
  - a missing path reads as `undefined`, not as an error;
  - `lastFetchedAt` moves after `fetch`.

  Done in `git-refs.test.ts`: 3 tests. `git.test.ts` mocks `simple-git` for
  the whole file, and these need a real repository.

## 2. Pull requests

- [x] 2.1 `listPullRequestsByBranch(options)` in
  `packages/core/src/gh-pr-gateway.ts` runs
  `gh pr list --state all --json number,state,headRefName --limit 200`
  once. It returns a map from branch to `{ number, state }`, or
  `{ unavailable: reason }` when `gh` is missing, not signed in, or fails.

  Done. Where a branch has had several pull requests, an open or merged one
  is kept over a closed one.
- [x] 2.2 Its test feeds recorded `gh` output and a failing `gh`.

  Done in `gh-pr-list.test.ts`: 4 tests. Besides the recorded output, they
  cover a missing `gh`, one not signed in, and output that is not JSON.

## 3. The standing

- [x] 3.1 New `packages/core/src/change-standing-facts.ts`, safe for the
  browser, defines the standing's facts: here, directories, main, branch,
  pull request, runs, sources.

  Done, with `countTaskCheckboxes` and `describeStandingSources`, the sources
  line every surface shows.
- [x] 3.1a New `packages/core/src/change-state.ts`, safe for the browser,
  defines the one closed set of state words of ADR 0029's amendment, in
  its precedence order, and `describeChangeState(facts)`.
  - It returns the word, the lines beneath it with their sources, and a
    colour role.
  - Facts not yet read, such as the last run, take no part.
  - It is the only code that picks a change's state word. The Changes
    tree, the standalone Changes list and `openspec-ui-cli ready` call it
    in this change; the Pipeline card calls it in
    `a-card-says-what-its-change-is-doing`.

  Done in a new leaf, `change-state-word.ts`, re-exported from
  `change-state.ts` for Node importers and from `browser.ts` for the
  browser. `change-state.ts` already existed and reads `tasks.md` with
  `node:fs`, so a value from it cannot reach the browser bundle. The colour
  roles are `now`, `settled`, `ahead`, `failed`, `deleted` and `none`, and
  a one-character badge comes with each word but Ready. A waiting run asks
  before a start, as a running one does. `ready` passes its readiness in
  with the standing.
- [x] 3.1b `change-state.test.ts`: one scenario per word; a change both
  Ready here and further along elsewhere says "Further along", with
  "Ready" as a line; the same facts give the same word and lines whichever
  surface asks.

  Done in `change-state-word.test.ts`: 13 tests.
- [x] 3.2 New `packages/core/src/change-standing.ts` exports
  `readChangeStandings(workspaceRoot, options)`. It reads:
  - this checkout's changes;
  - `surveyWorktrees`;
  - the main ref's `openspec/changes` and `openspec/changes/archive`;
  - each change's branch, local and remote;
  - the pull requests;
  - the sources' freshness.

  Its only git calls are the wrapper's, against this repository.
  Options: `fetch` (`never`, `ifOlderThan` with an interval, or
  `now`) and test seams for git and `gh`.

  Done. A fetch that fails is remembered, so a reading with an interval does
  not try it again every time. Pull requests are read again only by a
  reading that fetched.
- [x] 3.3 A change the merge base of the main ref and `HEAD` had, which the
  main ref has in neither place, is **Deleted on main**. A change the merge
  base did not have is not.
- [x] 3.4 Export both files from `index.ts`, and the facts from
  `browser.ts`.
- [x] 3.5 `packages/core/src/change-standing.test.ts`, against temporary
  repositories, one scenario per word, plus:
  - a failed fetch is stated in `sources` and the reading still answers;
  - `gh` unavailable leaves no pull request fact and says why;
  - "Further along" names the other copy and both counts.

  Done: 5 tests, one of them for the cache of 9.1. The fixture writes the
  remote's refs with `update-ref`, because a local push starts a shell that
  the msys runtime failed to start under load on Windows. The words that
  need a run or a last run are covered in `change-state-word.test.ts`.

## 4. The hosts

- [x] 4.1 `packages/server`: `POST /api/change-standings` answers
  `readChangeStandings(cwd, { fetch: { ifOlderThan: STANDING_FETCH_INTERVAL_MS } })`,
  with the route checks every other route makes.

  Done. `fetch: "now"` in the body fetches at once, and any other value
  is refused with 400. `server.test.ts` adds 2 tests.
- [x] 4.2 `packages/extension`: `changes/standings` over the bridge, with the
  same call.

  Done differently: no webview in the editor asks for standings itself. The
  host reads them in-process for the Changes tree, for the run dialog before
  it opens, and for the Pipeline's Refresh through the new
  `pipeline/refresh` operation. A bridge operation nothing sends was left
  out.
- [x] 4.3 Before a run dialog opens, both hosts read standings with
  `fetch: "now"`.
- [x] 4.4 Refreshing fetches now. Every surface that shows a change's state
  has a Refresh control that re-reads the files and reads standings with
  `fetch: "now"`, and then updates the line saying when refs were last
  fetched:
  - the VS Code Changes tree: `openspec-ui.refresh`, already in its title
    bar, gains the fetch;
  - the standalone Changes list: a new **Refresh** button;
  - the Pipeline, in both hosts: a **Refresh** button beside its read-at
    line.

  While a fetch is under way the control says so and is disabled. A failed
  fetch is said beside the control.
- [x] 4.5 Tests: in each host, Refresh reads with `fetch: "now"`, and a
  second press during a fetch starts no second fetch.

  Done:
  - `PipelineView.refresh.test.tsx`, 3 tests;
  - the Refresh case in `ChangesList.standing.test.tsx`;
  - the `pipeline/refresh` case in `pipeline-panel.test.ts`;
  - the fetch-now case in `changes-tree-standing.test.ts`, whose tree queues
    a reading asked for during one and never drops a fetch.

## 5. The VS Code Changes tree

- [x] 5.1 `ChangeTreeItem` gains a `resourceUri` in the scheme
  `openspec-ui-change`, naming the change. Its description carries the
  standing's word after its state.

  Done: `<state> — <word>`, with the word and its lines as the tooltip.
- [x] 5.2 A `FileDecorationProvider` for that scheme gives each change:
  - a colour from the theme's chart colours for its colour role;
  - a one-letter badge;
  - the word as its tooltip.

  Done in `change-standing-decorations.ts`: `charts.green`, `charts.yellow`,
  `charts.blue` and `charts.red`, `disabledForeground` for a change deleted
  on main, and no colour for one simply ready.
- [x] 5.3 While the Changes view is visible, standings are read at most every
  `STANDING_FETCH_INTERVAL_MS`, and again on the `openspec/**` watcher's
  events.

  Done. The tree draws at once with the words it holds, reads in the
  background, and draws again when a reading lands.
- [x] 5.4 `packages/extension/src/tree/changes-tree.test.ts`: the description
  and the decoration of an archived-on-main change, and of a change only
  here.

  Done in `changes-tree-standing.test.ts`: 2 tests, apart from the existing
  file, whose core mock would need every new name.

## 6. The standalone Changes list

- [x] 6.1 `ChangesList` in `packages/webui` shows the word and a chip in its
  colour role for each change, and the sources line beneath the list: which
  ref was `main`, and when it was last fetched.
- [x] 6.2 `ChangesList.test.tsx`: the word is present with and without the
  colour, and a failed fetch is said.

  Done in `ChangesList.standing.test.tsx`: 3 tests.

## 7. The run dialog

- [x] 7.1 `RunDialog` leads with the standing. For Running, Archived on main,
  Merged, or Deleted on main, it disables every path until a checkbox,
  "Start it anyway", is checked.

  Done. Scheduling is held too, and Waiting asks as Running does.
- [x] 7.2 `RunDialog.test.tsx`: an archived-on-main change cannot start
  until confirmed; a change only here starts as today.

  Done in `RunDialog.standing.test.tsx`: 2 tests.

## 8. A request and its reply

- [x] 8.1 `AuditEntry` in `packages/core/src/security.ts` gains an optional
  `message`: `{ id, kind: "request" | "reply", inReplyTo?, from, to, at, body, outcome? }`.
  - `from` and `to` are `{ person: gitAuthor }` or
    `{ agent: agentId, instance? }`.
  - `outcome` is `closed`, `left-open`, `refused` or `failed`.

  Done. The envelope lives in the leaf `audit-message.ts`, so the browser
  can show a reply. A message entry has the outcome `message`, and
  `isRunEntry` skips it, so run counts and cost rows are unchanged.
- [x] 8.2 `runDelegatedItem` writes:
  - the request before the agent starts;
  - the reply when the run ends, whatever its outcome, with the last 4 000
    characters of the agent's reply text, or of its stdout for a raw
    adapter.

  The result it returns carries the reply's body.

  Done. A run that says nothing leaves the end of stderr or the reason as
  the reply's body. Both hosts pass the audit log their runners write to.
- [x] 8.3 `collectHumanOnlyInbox` attaches to each open delegated item the
  latest reply for that change and task. Both hosts show it beneath the
  item.

  Done: `DelegatedReply` beneath the row in the standalone inbox, and the
  row's tooltip in the editor.
- [x] 8.4 `buildDelegatedItemPrompt` gains the section "How to answer": wait
  for every command in the turn; nothing in the background; end the turn
  with what was done and, if the item is not closed, why.
- [x] 8.5 Tests:
  - core `delegated-item-run.test.ts`: a run that leaves the item open
    writes a reply with its last message and `left-open`; a closed one
    writes `closed`; the prompt holds the new section;
  - core `human-only-inbox.test.ts`: the latest reply is attached;
  - server and webui: the reply reaches the inbox.

  Done in new files:
  - `delegated-item-reply.test.ts`, 3 tests;
  - `human-only-inbox-reply.test.ts`, 1 test;
  - the inbox reply case in `server.test.ts`;
  - `DelegatedReply.test.tsx`.

## 9. Measurement

- [x] 9.1 Measure `readChangeStandings` over this repository with no fetch,
  five runs after a warm-up, and record it. If a reading takes more than a
  second, cache per-ref results by commit id, and measure again.

  Measured 2026-09-14, over this repository's worktree with 11 standings,
  three working directories and `origin/main`:
  - **Before:** median 8859 ms (8035 to 12751). A tree, a file and a merge
    base were read by git for every change on every reading.
  - **With the cache by commit id:** median 4805 ms (3066 to 7021), taken
    while the standalone server was starting beside it.
  - **Profiled by part, on its own:** the worktree survey 2269 to 2521 ms;
    `listRefs` 122 to 151 ms; `resolveCommit("HEAD")` 137 to 162 ms;
    `lastFetchedAt` 105 to 111 ms. The whole reading was 2547 to 2746 ms
    once `gh` was held.

  A reading is still over a second. The ref reading itself is under half a
  second after the first. The rest is `surveyWorktrees`, the same reading
  the Pipeline takes on its own schedule. No surface waits on it: the tree
  draws at once, and both hosts read in the background.

## 10. Verification

- [x] 10.1 This change validates strictly. `check(validate-change)`

  Done: `openspec validate a-change-says-where-it-stands --strict` reports
  it valid, 2026-09-14.
- [x] 10.2 Run `npm run verify` unpiped, after the last edit and with
  everything staged. Record the run and the test count for each package.

  Local run 2026-09-14 at `5fca501`, exit code 1. Typecheck and every lint
  passed. Tests: cli 155 passed; core 1350 passed, 1 failed; extension 356
  passed; server 92 passed; webui 446 passed. The one failure is
  `keeps accepting this repository's real openspec/agent-harness.json`.
  It reads the working tree's file, and an uncommitted local edit that is
  not part of this change sets its `autonomyLevel` to `semi-autonomous`.
  Closed on CI: the "Typecheck, lint, test, and build" job ran
  `npm run verify` at the same commit against the committed tree, and
  passed,
  <https://github.com/VeryComplexAndLongName/OpenSpec-UI/actions/runs/34799591187/job/103839377234>.
- [x] 10.3 A pending changeset exists: core, webui and the extension minor,
  server patch. `check(changeset-present)`

  Done: `.changeset/a-change-says-where-it-stands.md`, with the CLI at patch
  for `ready`'s word.
- [x] 10.4 Run the whole browser suite, and record the run.

  Done 2026-09-14 at `5fca501`: `npm run test:browser -w @openspec-ui/server`
  exited 0, 18 passed (5.2 min). CI's "Standalone browser and
  accessibility" job passed at the same commit. The retaken pictures of
  screens this change touches were looked at and kept:
  - `pipeline.png` shows the Refresh button under the read-at line.
  - `run-dialog.png` shows the standing block, `Ready` with `Only here
    (every source read)`, above the configuration.
  - `view-summary.png` shows the fixture change's `Ready` chip and
    `Only here`, and beneath the list the sources line. The fixture is not
    a git repository, so that line says refs and pull requests could not be
    read, and why.

  `diff-preview.png`, `harness-settings.png` and `processes.png` were also
  retaken. They show screens this change does not touch, and were restored.
- [x] 10.5 Run the extension integration suite with the inherited `VSCODE_*`
  and `ELECTRON_*` variables stripped, and record the run.

  Done 2026-09-14 at `5fca501`: `npm run test:integration -w
  openspec-ui-vscode`, from a PowerShell with every `VSCODE_*` and
  `ELECTRON_*` variable removed, exited 0 with 18 passing. That includes
  "Changes tree keeps an implemented change as the parent of its tasks row
  after refresh". Its assertion was first written for the bare artifact
  state and failed on CI at `651e217`; it now expects the state word after
  that state. CI's "Extension integration and package" job passed at
  `5fca501`.
- [ ] 10.6 **Delegated to claude-cli**: with a change archived on `main`,
  another ticked further in a worktree, and a third running there, open the
  Changes tree and the standalone Changes list, and try to run the archived
  one. Say whether each view told you where the change really was, and
  whether anything shown was out of date.

  This was a human-only item. On 2026-09-14 the owner delegated human-only
  checks to claude-cli.

  Setup: a scratch repository outside this one, with a bare remote and a
  worktree. `main` has archived one change. The worktree has ticked a
  second change further than the checkout. A stand-in run's status record
  names a third change in the worktree. Build the CLI and the standalone
  server from `main` once this change is merged.

  Steps:
  1. Open the standalone shell with Playwright against the scratch
     repository and load the summary. Save a picture of the Changes list,
     then open the run dialog for the archived change and save a picture of
     it. Check that no path starts until "Start it anyway" is checked. Look
     at both pictures.
  2. Print the editor's Changes tree rows for the three changes: label,
     description and tooltip, and each row's decoration. Use
     `ChangesTreeProvider` and `ChangeStandingDecorations` against the
     scratch repository.
  3. Compare both with `git log --oneline --all`, the worktree's
     `tasks.md`, and `openspec-ui-cli ready`.

  Evidence: the picture paths and what they show, the printed rows and
  decorations, the `ready` output, and a judgement naming anything shown
  that was out of date.

  Take every step in foreground commands. Nothing may be left running in
  the background when a command returns.
