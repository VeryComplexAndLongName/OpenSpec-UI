# A check that passes checked something

## Why

Found by the code review of 2026-09-10. Six places where a green result
does not mean what its name says, or where a failure is shown as
nothing.

**The changeset lint reads only double-quoted names.**
`scripts/check-changesets.mjs:53` matches `"name": bump`. A changeset
written `openspec-ui-vscode: patch` — valid YAML, accepted by `changeset
version` — is invisible to it, as is a single-quoted name. A misspelled
unquoted name passes the lint and fails on `main`, which is the failure
the script was written to catch.

**The chart test never asserts a count.** `packages/server/e2e/
change-charts.spec.ts:65` is named "charts what the history says" and
checks that one date appears in the table and that the basis mentions a
commit. Its fixture comment spells out the expected shape — two, one,
zero, one — and a chart drawing every bar as zero passes.

**The fixture inherits the developer's git configuration.**
`create-dated-workspace.ts:36` overrides author and committer through the
environment, not `commit.gpgsign` or `core.hooksPath`; on a machine with
either set globally the fixture fails to commit.

**The folder-name test exercises the commit path.**
`change-timeline.test.ts:383` is named for the folder-name fallback and
commits the archive at exactly the folder's date, so the assertion is
satisfied by the commit source and the fallback is never reached. This
is carried here from `a-date-is-one-day-in-every-source` because it is a
test-honesty defect, and that change fixes the reading itself.

**An inbox that could not be read looks like one not loaded.**
`standalone-entry.tsx:402-406` sets the inbox to `null` on failure, which
removes the block. "Could not read the task files" and "not loaded yet"
render the same, which is the distinction the inbox exists to make.

**A bridge request that never gets a reply pins the form.**
`bridge-request.ts:86-92` has no timeout. The host replies on every path
it knows, so only a request posted before its listener attaches, or a
host crash between receive and reply, is unanswered — and then the
settings view stays on "Working…" with the save button disabled and no
message.

## Capabilities

### Modified

- The changeset lint reads every name form a changeset can carry.
- The chart test asserts the shape its fixture describes.
- The dated-workspace fixture commits regardless of the developer's git
  configuration.
- The inbox says when it could not be read.
- A bridge request that gets no reply fails with a message, after a
  stated time.

## Out of scope

The `/api/custom-agents` response carrying the server user's home path.
Noted in the review as fine for a localhost operator; a change would
only be warranted if the server were bound to a non-loopback host, which
the documentation does not offer.
