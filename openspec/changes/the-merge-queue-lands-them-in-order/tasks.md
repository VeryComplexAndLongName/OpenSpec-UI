Asked for by the owner on 2026-09-20, choosing a merge queue over
dropping the up-to-date rule and over rebasing by hand.

## 1. The workflow answers to the queue

- [x] 1.1 `quality.yml` gains the `merge_group` trigger.
- [x] 1.2 The five required checks - quality, the merge gate, the
  extension suite, the browser suite and the dependency audit - run on a
  queue entry as they run on a pull request.
- [x] 1.3 `version-pr` stays a pull request's job, and is skipped in a
  queue entry: a merge group has no head branch to recognise it by.
- [x] 1.4 Dependency review stays on pull requests only: it reads a pull
  request's own diff, and it is not a required check.
- [x] 1.5 A queue entry's run is never cancelled. The concurrency rule
  says so by the event, not by the ref.
- [x] 1.6 The "Which event runs what" comment says what a merge group
  runs, and what it costs.

## 2. The queue is turned on

- [ ] 2.1 **After 1 is on `main`**, the `main` ruleset gains a
  `merge_queue` rule with the settings design.md states. Waiting on this
  pull request: a queue turned on while the workflow answers only to
  `pull_request` holds every entry until it times out.
- [x] 2.2 The ruleset's required checks and its up-to-date policy are
  left as they are: the queue is what keeps them, not a replacement.
- [ ] 2.3 The settings actually applied are read back and recorded here.

## 3. The runbook says how a change lands

- [x] 3.1 `openspec/README.md` says a ready pull request joins the queue,
  that nobody updates a branch by hand any more, and that the owner still
  presses the button.

## 4. Checks

- [x] 4.1 `npm run lint` after `git add`, and `npm run test` at the root.
  The one failure is `packages/webui/scripts/build-metro-icons.test.mjs`,
  which fails on Windows for its line endings and fails the same way on
  untouched `main`.
- [x] 4.2 The workflow's YAML parses, and every job's condition is one of
  the two events. Read back from the parsed file: the triggers are
  `push`, `pull_request` and `merge_group`; the five required jobs answer
  to a pull request or a merge group; `version-pr` and dependency review
  answer to a pull request only; the three release jobs to a push.
- [x] 4.3 No changeset: nothing under `packages/` changes.
- [x] 4.4 `openspec validate the-merge-queue-lands-them-in-order
  --strict`.
- [ ] 4.5 **Human-only.** The first change to land through the queue: the
  entry appears, the checks run on it, and it merges without anybody
  updating a branch. Cannot be answered before 2.1.
