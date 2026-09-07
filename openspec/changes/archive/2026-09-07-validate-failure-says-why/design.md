# Design

## Context

Read on 2026-09-07. Line numbers are from that read.

- The spawn wrapper in `packages/core/src/openspec.ts:20-41` collects
  both streams, resolves with `{ stdout, stderr }` on exit `0`, and on
  anything else rejects with `` `${binary} ${args} exited with code
  ${code}: ${stderr}` `` — `stdout` is not referenced in that branch.
- `runJson` (`:351-381`) awaits that wrapper and only then parses. When
  the wrapper rejects, `JSON.parse(stdout)` is never reached, so the
  report is discarded before anything looks at it.
- `validateChange` (`:402-413`) asks for `validate <id> --json --strict
  --type change`. That command exits `1` for an invalid change and
  prints `{ items: [ { valid: false, issues: [...] } ], summary }` on
  stdout. Exit `1` is its finding, not its failure.
- The other `runJson` callers — `listChanges`, `listSpecs`, `showChange`,
  `statusChange`, `createChange`, `archiveChange` — do not share that
  property uniformly, which is why this change is scoped to validation.

## The distinction that is currently inverted

`openspec/specs/ci-cli/spec.md` separates two outcomes deliberately:

- *At least one active change is invalid* — exit `1`, `ok: false`, every
  change's result present.
- *A single change cannot be validated* — that change carries
  `valid: false` and an `error`, the run completes, exit `1`.

They differ in what a reader is supposed to do next. The first says fix
the change; the second says something is wrong with the tooling or the
directory. Today every invalid change takes the second path, because
"exit code is not zero" is the only signal the wrapper looks at.

The observed run makes it concrete: the valid change reported
`totalItems: 1`, the invalid one reported `failedItems: 0, totalItems: 0`
and an `error`. A reader is told the count of failed items is zero for
the change that failed.

## Decision: a parseable report on stdout wins over the exit code

When `openspec validate` exits non-zero, the report is parsed first. If
it parses and matches the expected shape, it is the answer, and the exit
code adds nothing that the report does not already say.

The exit code is kept as the signal for everything else: a binary that is
missing, a crash before any output, output that is not the expected
report. That is what an exit code is good for — the case where there is
nothing better to go on.

This is deliberately narrower than "ignore exit codes". Exit `2` from the
merge gate still means the check itself could not run, and this change
does not touch when a `1` or a `2` is produced.

## Decision: scoped to validation, and the rest is named

`archive` has the identical shape. It refuses a stale spec delta with a
precise message naming the requirement header or the scenario that would
be dropped, and exits non-zero. That message reaches a caller through the
same wrapper and is lost the same way.

It is left out on purpose. `archive` mutates a workspace, its non-zero
exits mean several different things — refused, partially applied, failed
before starting — and treating stdout as authoritative there needs its
own reasoning about which of those a report can safely describe. Folding
it in would turn a fix that is a few lines into a review of every call
site.

Naming it in the proposal is the mechanism this repository already has
for residue that would otherwise lose its owner, and the check added by
`human-only-inbox` verifies a named successor exists. If it is written as
"Successor created: `<id>`", that check requires the successor to be
real.

## Decision: what a reported error has to contain

The regression here was not a missing string. It was a string that was
present, well-formed, and about something else.

So the test is not "an `error` field exists" — that passed throughout —
but that the reported reason names the change or the problem. A report
whose whole content is `ExperimentalWarning: Importing JSON modules` must
fail the test that covers this, or the defect ships again the next time
a runtime prints a banner.

Concretely: stdout is preferred when it carries a diagnosis, stderr is
the fallback, and a reason that matches neither is worth stating as
"no diagnosis reported" rather than passing off noise as an explanation.

## Rejected: parsing the human-readable text output

`--json` already returns `issues[].message` as data. Reading the table
form would mean maintaining a parser against a format meant for people,
which drifts silently, and the repository already has two changes about
drift caught late.

## Rejected: suppressing the Node warning at the call site

`ExperimentalWarning: Importing JSON modules` comes from the `openspec`
binary's own runtime. Silencing it with `NODE_NO_WARNINGS` would make the
symptom disappear from this one report while leaving the mechanism —
stdout discarded on non-zero exit — exactly as it is. The next command
that writes anything at all to stderr would reproduce the defect.

## What this does not decide

Whether the merge gate should print a change's issues in the `--format
text` table as well as in the JSON. Today the table prints one line per
change; a failing change's issues would make it several. That is a
question about the table's shape, it affects passing changes too, and it
should be argued where the table is specified.
