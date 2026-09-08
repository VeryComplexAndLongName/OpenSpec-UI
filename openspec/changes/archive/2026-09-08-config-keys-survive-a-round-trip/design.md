# Design

## Context

Read on 2026-09-08.

- `TOP_LEVEL_CONFIG_KEYS` (`harness-config.ts`) is the accepted set. A key
  outside it is refused by `assertNoUnknownTopLevelKeys`, with a message
  naming the key and the accepted list. Two tests pin that message.
- `readGlobalHarnessConfig` constructs its result field by field:
  `stepAgents`, `autonomyLevel`, `reviewGate`, `checkpoints`, `budget`,
  `timeout`, `maxStageAttempts`, `gitStageAllowlist`. A field missing from
  that list is dropped without a word.
- `readChangeHarnessConfig` returns the parsed object as-is, so it cannot
  drop anything.
- `mergeHarnessConfig` also names its fields one by one, and has the same
  exposure.

## Decision: the guard is a test, not a lint

The precedent is in this repository and is explicit: the relation graph's
own check is a test rather than a lint script, because "it runs from
source with nothing built" and so cannot be skipped by a build that did
not happen.

The same reasoning applies. This has to run on every pull request, in the
one job that always runs, and it has to read the real
`TOP_LEVEL_CONFIG_KEYS` rather than a copy.

## Decision: the sample table is checked against the key list

The test needs a representative value per key — something to write and
then look for. The obvious shape is a table from key to value.

A table like that rots in a specific way: someone adds a key to the
product, does not add a sample, and the loop quietly tests one key fewer.
The test still passes, and the guard is gone for exactly the key that was
just introduced — which is the key at risk.

So the table's own keys are asserted equal to `TOP_LEVEL_CONFIG_KEYS`
first. Adding a key to the product without a sample fails the test, and
the failure names the missing key.

This is the whole design. Without it the test is a list of the keys
someone remembered, which is what the reader already is.

## Decision: `mergeHarnessConfig` is covered by the same test

The resolved configuration a chain actually uses comes through
`resolveHarnessConfig`, which merges a per-change file over the global
one — and `mergeHarnessConfig` names its fields one by one too.

So the round trip is asserted twice per key: once through the global
reader, and once through a merge where the per-change file sets the key
and the global one does not. A field dropped by either is caught, and the
second is the one a chain reads.

## Rejected: spreading the parsed object in the reader

`return { ...DEFAULT_HARNESS_CONFIG, ...input }` would end this class of
defect outright, and it would also stop the reader normalising what it
returns: today every field in a resolved config has been past a
validator, and an unknown key cannot reach a consumer even in principle.

That property is worth keeping, and giving it up is a bigger argument
than this change is making. The test catches the regression under either
design, so it is the thing to build first.

## What this does not decide

Whether the same guard belongs on other configuration readers in this
repository. `openspec/config.yaml` is read by the upstream CLI, whose
schema silently drops unrecognised keys — a fact this project already
records as the reason harness settings live in their own file. Whether
anything can be done about that is a separate question with a different
owner.
