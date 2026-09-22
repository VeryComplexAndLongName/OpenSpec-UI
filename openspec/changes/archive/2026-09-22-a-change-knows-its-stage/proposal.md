## Why

ADR 0037 decisions 5 and 6, the third change of its series. A change can
now have an Owner, an Implementer and a history, but the product still
cannot say where a change is on its way to `main`, or how long it spent
at each step. The owner wants both, for the board and for the reports
that come after it. ADR 0025 said the repository knows order, not time.
For stages, that ends here.

## What Changes

- **Six stages, derived, never declared:** Proposed, Planned, In
  progress, In review, Landed, Archived. Each is proved by a dated fact:
  - the commit that adds `proposal.md`;
  - the commit that adds `tasks.md`;
  - a closed task line, dated by `git blame`, or a run in the audit log;
  - the pull request's creation, or a commit pushed to the change's branch
    while it is open;
  - the merge;
  - the archive.
- **`playStages`** plays the facts forward. A fact only moves a change on.
  A `sent-back` event of the change's history moves it back, and after it
  only newer facts move it on. So a change can visit a stage many times,
  and each visit is kept, with the fact that began it. `totalsOf` sums the
  time in each stage over every visit.
- **The forges give the times.** Every pull request now carries when it
  was opened and when it merged, where the forge says: GitHub through `gh`
  (`createdAt`, `mergedAt`) or its API, GitLab and Gitea (`created_at`,
  `merged_at`). They reach the standings unchanged.
- **The git wrapper reads commit times on a branch** (`commitTimesBetween`).
- **`readChangeStage` and `readChangeStages`** read the facts of one
  change, or of every active one, with the audit log read once.
- **The CLI:** `stages [<change>]`.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `execution-core` - a change's stages and its time in each.
- `ci-cli` - the `stages` command.

## Impact

- New `packages/core/src/change-stage-facts.ts` (also for the browser),
  `change-stages.ts` and their tests.
- `gh-pr-gateway.ts`, `http-forges.ts`, `change-standing-facts.ts` and
  `git.ts`.
- `packages/cli/src/stages-command.ts` (new), `main.ts` and tests.
- `README.md`.
- A changeset: core and the CLI, minor.

## Explicitly out of scope

- **The board.** The Pipeline arranged by stage, with the Owner and
  Implementer on each card, in both hosts, is the next change. It reads
  what this change derives.
- **Archived changes' visits.** Only active changes are read here. The
  reports that need an archived change's time in each stage come later,
  from the same reading.
