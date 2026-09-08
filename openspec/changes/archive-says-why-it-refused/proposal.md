## Why

`openspec archive` refuses precisely and this project reports the refusal
as noise.

The command knows exactly what is wrong. Asked to archive a change whose
spec delta no longer matches the specification, it says so by name:

```
view-analytics MODIFIED failed for header "### Requirement: Views are
recorded by the site itself" - current spec contains scenario(s) not
present in the modified block: "The same reader returns the next day".
Refresh the change spec before archiving to avoid dropping scenarios.
```

With `--json`, which is how this project calls it, that same refusal
arrives as structured data: `status[]` entries carrying a `severity`, a
`code` and that message, with `archive: null` and exit code 1.

It reaches a caller as an unread payload. `archiveChange` goes through
the wrapper that throws on a non-zero exit, and since
`validate-failure-says-why` that error prefers whichever stream carries a
diagnosis — which here is the entire JSON document. Measured by running
it: the thrown message is the report, braces and all, with the sentence
that matters somewhere inside it along with a `fix` field nothing reads.

So this is not "the reason is lost" — an earlier draft of this proposal
said that, and running the command disproved it. The reason arrives, in a
form nobody can act on at a glance.

The cost is measurable. On 2026-09-08 this cost two full reproductions in
a sister repository — running the command by hand, twice, to read a
message the tool had already produced — before the actual defect could
even be looked at.

This was named as owed work when `validate-failure-says-why` shipped:
that change fixed the same shape for `validate` and deliberately left
`archive` out, because `archive` mutates a workspace and its non-zero
exits mean several different things.

## What Changes

- A refusal from `archive` is reported with the reason the tool gave,
  named requirement and all.
- Where the report carries several problems, all of them are reported,
  not the first.
- Where no reason can be recovered, that is said, rather than a runtime
  banner being presented as the explanation.

## Capabilities

### Modified Capabilities

- `openspec-workbench`: a refused archive states which requirement or
  scenario is at fault, where the underlying tool stated it.

## Impact

- `packages/core/src/openspec.ts`'s `archiveChange`, and the two callers
  that report its failure — the harness chain's `archive` stage and the
  extension's archive command. Changeset for `@openspec-ui/core`.

## Explicitly out of scope

- **Changing what `archive` refuses.** The refusals are correct: the one
  quoted above was protecting three live scenarios from being deleted by
  a delta written before they existed. This changes what a person is
  told, not what the tool does.
- **Returning the report as data instead of throwing.** `validate` does
  that, because its caller wants a per-change result. Every caller here
  wants "did it work, and if not, why" — a throw carrying the reason
  suits them, and changing the contract would touch each one for nothing.
- **Repairing a drifted delta automatically.** The tool names the
  requirement and the scenario; deciding what the change should now say
  is the author's, and a guess would rewrite a specification nobody
  reviewed.
