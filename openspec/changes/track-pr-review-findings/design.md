## Context

PR Review already has a change identity, current head, and a local last-reviewed
marker. Findings need a similar scope with a separate decision for each item.

## Non-Goals

Importing forge review threads, posting comments, assigning reviewers remotely,
and changing the existing merge gate are outside this MVP.

## Decisions

- Store findings locally by change in Git's common directory. Tracking them as
  code in every commit was rejected because recording review would change the
  commit the reviewer was looking at. The summary can be shared explicitly.
- Use fixed, verified, and dismissed as distinct decisions. Closing findings
  automatically when a commit changes was rejected because it would treat an
  edit as evidence of resolution.
- Check head and ledger revision when applying a decision. Optimistic updates
  without a revision check were rejected because linked worktrees can edit
  the same ledger.
- Add optional PR Review fields and read-only rendering by default. The
  execution command and event contracts keep their current shape.

## Risks / Trade-offs

The ledger is local and may include project details. The summary labels
verification for another commit as historical. Finding text is rendered as
data and is never passed as an execution instruction.
