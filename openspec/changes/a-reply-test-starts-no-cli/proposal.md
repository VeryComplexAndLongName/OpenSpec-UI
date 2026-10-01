## Why

`delegated-item-reply.test.ts`, added by `a-change-says-where-it-stands`,
failed its two `runDelegatedItem` tests at the 20 s ceiling in three of five
full test runs on 2026-10-01, in two different working directories, and
passed every time it ran alone. Nothing those runs
changed touches it.

The cause, measured the same day: unlike `delegated-item-run.test.ts`,
which drives the same `runDelegatedItem` path, this file does not stand in
for `./openspec.js`. So each of its runs of an `implement` command starts a
real `openspec instructions` process for the rules lookup in
`prepareAgentContext`. Alone, its two tests took 4694 ms and 5647 ms; the
same path in `delegated-item-run.test.ts` takes about 500 ms. Under the
full suite's load, a process start of that size crosses 20 s. This is the
per-file cost `load-variance-not-per-file-cost` set apart from load
variance: a cost this file pays and its neighbour does not.

## What Changes

- `packages/core/src/delegated-item-reply.test.ts` stands in for
  `./openspec.js` exactly as `delegated-item-run.test.ts` does. The tests
  are about the request and its reply; the rules lookup is covered where
  it is tested.
- The ceiling stays at 20 s. A wider one would hide the next file that
  starts a process it does not need.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none: a test's setup, with no change to what any requirement says)

## Impact

- `packages/core/src/delegated-item-reply.test.ts` only. No package's
  behaviour changes, so no changeset.
