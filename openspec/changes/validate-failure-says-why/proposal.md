## Why

The merge gate can say a change is invalid. It cannot say why.

On 2026-09-07 it failed on `linkedin-teaser-assets`. The whole reason it
reported was:

```
"error": "openspec validate linkedin-teaser-assets --json --strict
--type change exited with code 1: (node:2496) ExperimentalWarning:
Importing JSON modules is an experimental feature and might change at
any time"
```

An experimental-modules warning, and nothing else. The actual diagnosis
existed, was complete, and named the fix — "Change must have at least one
delta… If this change intentionally modifies no specs (pure refactor,
tooling, docs), set `skip_specs: true` in the change's `.openspec.yaml`" —
and it was thrown away, because `openspec` prints its report on stdout
and `runJson` keeps only stderr when the exit code is not zero
(`packages/core/src/openspec.ts:37`).

Diagnosing a one-line fix took a local re-run of the same command. That
is the whole cost of the defect, and it is paid by whoever is furthest
from the code — someone reading a red check on a pull request.

The second half is worse than the message.

`openspec validate --json --strict` exits `1` for an invalid change. That
is not an error; it is how the command reports its finding, and the
report is on stdout. Because `runJson` rejects on any non-zero exit, an
ordinary invalid change is routed to the "this change could not be
validated" path instead of the "this change is invalid" path. In the same
run, a valid change reported `totalItems: 1`, while the invalid one
reported `failedItems: 0, totalItems: 0` and an `error` string.

The `ci-cli` specification draws a careful distinction between a change
that fails validation and a change the tooling could not validate at all.
For the most common failure there is, that distinction is currently
inverted.

## What Changes

- A non-zero exit from `openspec validate` whose stdout parses as the
  expected report is a result, not a failure: the change is reported as
  invalid, with its issues, and `failedItems`/`totalItems` counted the
  way a passing change's are.
- Where a change genuinely cannot be validated, the reported `error`
  carries what the tool actually said — stdout when it holds a diagnosis,
  stderr otherwise — rather than whichever stream happened to be stderr.
- A warning on stderr is not a diagnosis. An `error` consisting only of
  runtime noise is the shape this defect took, and the check that would
  have caught it is that the reported reason names the change or its
  problem.

## Capabilities

### Modified Capabilities

- `ci-cli`: a failing merge gate states the reason the underlying tool
  gave, and an invalid change is reported as invalid rather than as one
  that could not be validated.

## Impact

- `packages/core/src/openspec.ts` (`runJson` and the spawn wrapper it
  uses), `packages/cli`'s validate reporting, tested in both. Changeset
  needed for `@openspec-ui/core` and `@openspec-ui/cli`.

## Explicitly out of scope

- **Changing the exit-code contract.** `0`/`1`/`2` keep their meanings.
  This changes what is printed alongside a `1`, not when a `1` happens.
- **The same treatment for every other `openspec` subcommand.**
  `archive` refusing a stale spec delta has the identical shape — a real
  diagnosis printed while the exit code says only "no" — and was hit
  twice in one day in a sister repository. It is a different command with
  a different contract, and folding it in here would widen a narrow fix
  into a rewrite of every call site. Worth its own change; named here so
  it does not lose its owner.
- **Suppressing the Node warning.** It is noise, but it is not the
  defect: a report that carried the real diagnosis alongside the warning
  would have been enough to fix the change without a local re-run.
