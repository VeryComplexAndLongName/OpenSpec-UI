Where a change stands across the repository, in every view that lists
changes, and the reply every request to an agent leaves (ADR 0026 and ADR
0028, amendments of 2026-09-13).

## 1. Reading refs

- [ ] 1.1 `GitWrapper` in `packages/core/src/git.ts` gains:
  - `listTreeNames(ref, path)`: the entry names under `path` at `ref`;
  - `showFile(ref, path)`: the file's text at `ref`, or `undefined`;
  - `refExists(ref)`;
  - `fetch(remote)`: fetches without touching any working tree;
  - `lastFetchedAt()`: the modification time of `FETCH_HEAD` in the common
    git directory, or `undefined`.

  Each runs against the wrapper's own repository.
- [ ] 1.2 `packages/core/src/git.test.ts`, against a temporary repository
  with a bare remote:
  - a file and a directory are read from a branch that is not checked out;
  - a missing path reads as `undefined`, not as an error;
  - `lastFetchedAt` moves after `fetch`.

## 2. Pull requests

- [ ] 2.1 `listPullRequestsByBranch(options)` in
  `packages/core/src/gh-pr-gateway.ts` runs
  `gh pr list --state all --json number,state,headRefName --limit 200`
  once. It returns a map from branch to `{ number, state }`, or
  `{ unavailable: reason }` when `gh` is missing, not signed in, or fails.
- [ ] 2.2 Its test feeds recorded `gh` output and a failing `gh`.

## 3. The standing

- [ ] 3.1 New `packages/core/src/change-standing-facts.ts`, safe for the
  browser, defines the standing's facts: here, directories, main, branch,
  pull request, runs, sources.
- [ ] 3.1a New `packages/core/src/change-state.ts`, safe for the browser,
  defines the one closed set of state words of ADR 0029's amendment, in
  its precedence order, and `describeChangeState(facts)`.
  - It returns the word, the lines beneath it with their sources, and a
    colour role.
  - Facts not yet read, such as the last run, take no part.
  - It is the only code that picks a change's state word. The Changes
    tree, the standalone Changes list and `openspec-ui-cli ready` call it
    in this change; the Pipeline card calls it in
    `a-card-says-what-its-change-is-doing`.
- [ ] 3.1b `change-state.test.ts`: one scenario per word; a change both
  Ready here and further along elsewhere says "Further along", with
  "Ready" as a line; the same facts give the same word and lines whichever
  surface asks.
- [ ] 3.2 New `packages/core/src/change-standing.ts` exports
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
- [ ] 3.3 A change the merge base of the main ref and `HEAD` had, which the
  main ref has in neither place, is **Deleted on main**. A change the merge
  base did not have is not.
- [ ] 3.4 Export both files from `index.ts`, and the facts from
  `browser.ts`.
- [ ] 3.5 `packages/core/src/change-standing.test.ts`, against temporary
  repositories, one scenario per word, plus:
  - a failed fetch is stated in `sources` and the reading still answers;
  - `gh` unavailable leaves no pull request fact and says why;
  - "Further along" names the other copy and both counts.

## 4. The hosts

- [ ] 4.1 `packages/server`: `POST /api/change-standings` answers
  `readChangeStandings(cwd, { fetch: { ifOlderThan: STANDING_FETCH_INTERVAL_MS } })`,
  with the route checks every other route makes.
- [ ] 4.2 `packages/extension`: `changes/standings` over the bridge, with the
  same call.
- [ ] 4.3 Before a run dialog opens, both hosts read standings with
  `fetch: "now"`.
- [ ] 4.4 Refreshing fetches now. Every surface that shows a change's state
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
- [ ] 4.5 Tests: in each host, Refresh reads with `fetch: "now"`, and a
  second press during a fetch starts no second fetch.

## 5. The VS Code Changes tree

- [ ] 5.1 `ChangeTreeItem` gains a `resourceUri` in the scheme
  `openspec-ui-change`, naming the change. Its description carries the
  standing's word after its state.
- [ ] 5.2 A `FileDecorationProvider` for that scheme gives each change:
  - a colour from the theme's chart colours for its colour role;
  - a one-letter badge;
  - the word as its tooltip.
- [ ] 5.3 While the Changes view is visible, standings are read at most every
  `STANDING_FETCH_INTERVAL_MS`, and again on the `openspec/**` watcher's
  events.
- [ ] 5.4 `packages/extension/src/tree/changes-tree.test.ts`: the description
  and the decoration of an archived-on-main change, and of a change only
  here.

## 6. The standalone Changes list

- [ ] 6.1 `ChangesList` in `packages/webui` shows the word and a chip in its
  colour role for each change, and the sources line beneath the list: which
  ref was `main`, and when it was last fetched.
- [ ] 6.2 `ChangesList.test.tsx`: the word is present with and without the
  colour, and a failed fetch is said.

## 7. The run dialog

- [ ] 7.1 `RunDialog` leads with the standing. For Running, Archived on main,
  Merged, or Deleted on main, it disables every path until a checkbox,
  "Start it anyway", is checked.
- [ ] 7.2 `RunDialog.test.tsx`: an archived-on-main change cannot start
  until confirmed; a change only here starts as today.

## 8. A request and its reply

- [ ] 8.1 `AuditEntry` in `packages/core/src/security.ts` gains an optional
  `message`: `{ id, kind: "request" | "reply", inReplyTo?, from, to, at, body, outcome? }`.
  - `from` and `to` are `{ person: gitAuthor }` or
    `{ agent: agentId, instance? }`.
  - `outcome` is `closed`, `left-open`, `refused` or `failed`.
- [ ] 8.2 `runDelegatedItem` writes:
  - the request before the agent starts;
  - the reply when the run ends, whatever its outcome, with the last 4 000
    characters of the agent's reply text, or of its stdout for a raw
    adapter.

  The result it returns carries the reply's body.
- [ ] 8.3 `collectHumanOnlyInbox` attaches to each open delegated item the
  latest reply for that change and task. Both hosts show it beneath the
  item.
- [ ] 8.4 `buildDelegatedItemPrompt` gains the section "How to answer": wait
  for every command in the turn; nothing in the background; end the turn
  with what was done and, if the item is not closed, why.
- [ ] 8.5 Tests:
  - core `delegated-item-run.test.ts`: a run that leaves the item open
    writes a reply with its last message and `left-open`; a closed one
    writes `closed`; the prompt holds the new section;
  - core `human-only-inbox.test.ts`: the latest reply is attached;
  - server and webui: the reply reaches the inbox.

## 9. Measurement

- [ ] 9.1 Measure `readChangeStandings` over this repository with no fetch,
  five runs after a warm-up, and record it. If a reading takes more than a
  second, cache per-ref results by commit id, and measure again.

## 10. Verification

- [ ] 10.1 This change validates strictly. `check(validate-change)`
- [ ] 10.2 Run `npm run verify` unpiped, after the last edit and with
  everything staged. Record the run and the test count for each package.
- [ ] 10.3 A pending changeset exists: core, webui and the extension minor,
  server patch. `check(changeset-present)`
- [ ] 10.4 Run the whole browser suite, and record the run.
- [ ] 10.5 Run the extension integration suite with the inherited `VSCODE_*`
  and `ELECTRON_*` variables stripped, and record the run.
- [ ] 10.6 **Human-only**: with a change archived on `main`, another ticked
  further in a worktree, and a third running there, open the Changes tree
  and the standalone Changes list, and try to run the archived one. Say
  whether each view told you where the change really was, and whether
  anything shown was out of date.
