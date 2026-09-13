Readiness learns what the runs' records say, and a change with its own
worktree is drawn once (ADR 0029).

## 1. Readiness reads the runs' records

- [x] 1.1 `readChangeReadiness` in `packages/core/src/change-readiness.ts`
  reads the status records with `readAgentStatuses` from
  `agentStatusDirectory(root, mainPath)`.
  - `mainPath` is the `path` of the main entry in the
    `listChangeWorktrees` result that readiness already has.
  - `root` comes from `resolveWorktreeRoot(mainPath)`.

  No other git runs for this. A `statuses?: AgentStatusReport[]` option
  replaces the reading in tests. When the directory cannot be read,
  readiness is computed exactly as it is today.
- [x] 1.2 A record makes a change running when all of these hold:
  - the record is not `gone`;
  - its `changeName` equals the change's name;
  - its `workingDirectory`, compared with `pathKey`, is either the
    workspace root or the `path` of the worktree that
    `listChangeWorktrees` pairs with the change.

  `pathKey` moves out of `worktree-survey.ts` into a module both files
  import. A record that names the change from any other directory does
  not count; do not match on the change name alone.

  Done: `packages/core/src/path-key.ts`, imported by both.
- [x] 1.3 In `packages/core/src/change-readiness-facts.ts`, the running
  variant of `ChangeRunState` becomes
  `{ state: "running"; worktreePath: string; holder?: WorkspaceLeaseConflict; reportedBy?: { instanceId: string; workingDirectory: string } }`.
  - A lease holder sets `holder`, a record sets `reportedBy`, and both
    can be present.
  - Where only a record says the change is running, `worktreePath` is the
    record's `workingDirectory`.
- [x] 1.4 A running change is not ready:
  - it takes no part in any other change's `canJoin` or `blockedFrom`;
  - it gets no `needsWorktree`;
  - `buildHints` suggests nothing that starts it.
- [x] 1.5 Every reader of `run.holder` handles a missing holder. Once the
  field is optional, the type checker lists the readers. The local card
  detail in `packages/webui/src/components/PipelineView.tsx`, which writes
  the `git author` line, names no author when there is no holder. Record
  each reader that was fixed.

  Readers fixed, as the type checker listed them:
  - `packages/core/src/hints.ts`: the held-by-a-finished-run hint skips a
    change with no holder, since there is no lease to release;
  - `packages/cli/src/ready-command.ts`: pid and last active are printed
    only with a holder, else `in <directory> (its run reports it)`;
  - `packages/webui/src/components/PipelineView.tsx`: the card's
    `git author` line reads `run.holder?.author`.

## 2. `ready` in the terminal

- [x] 2.1 `openspec-ui-cli ready`, in `packages/cli/src/ready-command.ts`,
  reports a change that is running on a record's account as running. It
  names the change's directory and prints no author line. Where `ready`
  prints JSON, the running state carries `reportedBy` exactly as core
  returns it.

## 3. A change drawn once

- [x] 3.1 `packages/core/src/change-worktrees.ts` gets a pure function,
  `changeOfWorktree(worktree: GitWorktree, isMain: boolean): string | undefined`,
  that states the pairing rule `listChangeWorktrees` applies: the worktree
  is not the main working directory, and its branch is a valid change
  name. `listChangeWorktrees` calls it instead of applying the rule
  inline.
- [x] 3.2 `SurveyedDirectory` in `packages/core/src/worktree-survey-facts.ts`
  gains `belongsTo?: string`. `surveyWorktrees` sets it to the result of
  `changeOfWorktree` when that change is active in the main working
  directory's own queue.
- [x] 3.3 `OtherDirectories` in
  `packages/webui/src/components/PipelineView.tsx` does not draw the change
  that `belongsTo` names inside that directory. Under the directory's
  heading, it says the directory is the worktree of that change, which is
  drawn above. The directory's other changes, branch and runs are drawn as
  before.

## 4. Tests

- [x] 4.1 core `change-readiness.test.ts`, using the `statuses` seam:
  - a live record in the workspace root makes the change running, with
    `reportedBy` and no `holder`;
  - a live record in the change's own worktree, while that worktree's lease
    is held, makes the change running with both;
  - a `gone` record does not make it running;
  - a live record that names the change from an unrelated worktree does
    not make it running;
  - a status directory that cannot be read gives the same report as
    reading with no records.
- [x] 4.2 core `hints.test.ts`: a change that is running on a record's
  account gets no hint to start it, and appears in no other change's
  `canJoin`.

  The `canJoin` half is asserted where `canJoin` is computed, in
  `change-readiness.test.ts` ("leaves a running change out of every other
  change's pairing").
- [x] 4.3 core `change-worktrees.test.ts`: `changeOfWorktree` for the main
  directory, for a branch named after a change, for a branch that is not a
  valid change name, and for a detached head.
- [x] 4.4 core `worktree-survey.test.ts`:
  - `belongsTo` is set on a worktree whose branch is an active change;
  - it is absent for the main directory;
  - it is absent for a branch that is not a change;
  - it is absent for a change that has been archived in the main
    directory.
- [x] 4.5 cli `ready-command.test.ts`: a change that is running on a
  record's account prints as running, with its directory and no author.
- [x] 4.6 webui `PipelineView.test.tsx`:
  - a running change with no holder shows no author line;
  - a worktree that belongs to a change is drawn without that change and
    says whose it is;
  - another change in that worktree is still drawn.
- [x] 4.7 Browser suite, `e2e/pipeline.spec.ts`: a change that has its own
  worktree is shown once, and the tab passes axe at WCAG AA. If the fixture
  has no such worktree, add one on a branch named after one of its
  changes.
  Done: the fixture adds a worktree on branch `pipeline-unrelated`. Its
  section says whose it is, draws no `pipeline-unrelated` card and still
  draws `pipeline-first`. The other directories are found by their
  accessible names, since git lists worktrees in an order of its own.

## 5. Verification

- [x] 5.1 This change validates strictly. `check(validate-change)`
- [ ] 5.2 `npm run verify`, unpiped, after the last edit and with everything
  staged. Record the run and the test count for each package.
  Local run 2026-09-14, exit code 1. Typecheck and every lint passed.
  Tests: cli 143 passed; core 1297 passed, 1 failed; extension 351 passed;
  server 86 passed; webui 434 passed. The one failure is
  `keeps accepting this repository's real openspec/agent-harness.json`,
  which reads the working tree's file: an uncommitted local edit, not part
  of this change, sets its `autonomyLevel` to `semi-autonomous`. To be
  closed on CI's run of the same checks against the committed tree.
- [x] 5.3 A pending changeset exists: core minor, cli and webui patch.
  `check(changeset-present)`
- [x] 5.4 Run the whole browser suite, not a selected spec. Regenerate
  `docs/images/standalone/pipeline.png` and look at it.
  Done 2026-09-13: `npm run test:browser` in `packages/server`, 18 passed
  (3.6 min). In the retaken picture the `pipeline-unrelated` worktree reads
  "The worktree of pipeline-unrelated, which is drawn above." and holds
  only `pipeline-first` and `pipeline-second`; the change is one card, in
  this directory's picture. The pictures it retook of screens this change
  does not touch were left as they were.
- [ ] 5.5 **Delegated to claude-cli**: check readiness against a real run.

  Setup: a scratch git repository outside this one, with two active
  changes and no worktree. Put a stand-in `claude` first on `PATH` that
  prints one line and waits 60 seconds.

  Steps:
  1. Run `npm run build -w @openspec-ui/cli`.
  2. Start `openspec-ui-cli run` for one of the changes, in the
     repository's own directory.
  3. While the run waits, read `openspec-ui-cli ready` and the standalone
     server's `POST /api/change-readiness`.
  4. After the run ends, read both again.

  Evidence:
  - both readings taken during the wait, showing the change running in the
    repository's own directory with no author;
  - both readings taken after the run, showing the change ready;
  - the time of each reading;
  - the run's `started` audit line.

  The unit tests use a seam. Only a real run shows that the record and the
  reading meet.
