# Design

## Context

Observed on 2026-09-08 by running the command against this repository.

`openspec archive <unknown> --yes --json` exits `1` and prints on stdout:

```json
{
  "archive": null,
  "root": { "path": "...", "source": "nearest" },
  "status": [
    {
      "severity": "error",
      "code": "archive_change_not_found",
      "message": "Change 'nonexistent-change-xyz' not found. Available changes: ..."
    }
  ]
}
```

So the refusal is already structured: a `status[]` of entries with
`severity`, `code` and a human `message`, and `archive: null` to say
nothing was archived.

- `archiveChange` (`openspec.ts`) calls `runJson(["archive", name,
  "--yes", "--json"], …, "a JSON object", isObjectResult)`.
- `runJson` throws `failureMessage(...)` on a non-zero exit unless
  `acceptNonZeroExit` is set. Since `validate-failure-says-why`, that
  message prefers whichever stream carries a diagnosis — which here is
  the whole JSON blob, message buried inside it.
- Callers: the harness chain's `archive` stage, which yields a failed
  event carrying `error.message`, and the extension's archive command,
  which shows it.

## Decision: parse the refusal, keep throwing

`archiveChange` accepts a non-zero exit whose stdout parses, reads the
`status[]` entries of severity `error`, and throws an `Error` whose
message is those messages.

Keeping the throw is deliberate, and it is where this differs from
`validate`. That command's caller wanted the report **as data**, because
it reports a result per change and a failure of one change is an ordinary
outcome. Every caller of `archiveChange` wants one thing: did it work,
and if not, why. A throw carrying the reason answers exactly that, and
turning it into a returned report would rewrite each call site to ask a
question it does not have.

## Decision: every error, not the first

`status[]` is an array. A change can fail archiving for more than one
reason — two requirements drifted, or a missing delta and a stale one —
and reporting only the first sends someone round the loop again for the
second.

They are joined into one message, each on its own line. The messages are
already whole sentences naming their own subject, so they need no prefix
to be readable together.

## Decision: `archive: null` is not the signal

The obvious alternative is to treat `archive === null` as "refused". It
is true today and it is the wrong thing to key on: it says *that* nothing
was archived and never *why*, so a caller reading it still has to find
the reason somewhere. The `status[]` entries are the reason, and they are
what a person needs.

`archive: null` stays useful as a sanity check — a report claiming both a
successful archive and an error would be a contradiction worth noticing —
but the message comes from `status`.

## Decision: no diagnosis is said, not disguised

Where a non-zero exit carries nothing parseable, or a report with no
error entries, the thrown message says so. This mirrors what
`validate-failure-says-why` established: a report whose whole content is
a Node warning banner must not be presented as an explanation, because
that is precisely the failure that made this class of defect expensive.

## Rejected: reading the human-readable output instead

Without `--json` the command prints the same refusal as prose, and it is
easier to show a person directly. It is also a format meant for people,
which changes without notice; the repository already has two changes
about drift caught late. The structured form carries the same sentence
and states its own shape.

## What this does not decide

Whether a refused archive should offer to show the requirement it named —
open the specification at that heading, say. That is a surface question,
it differs between the two hosts, and it needs the reason to exist first.
