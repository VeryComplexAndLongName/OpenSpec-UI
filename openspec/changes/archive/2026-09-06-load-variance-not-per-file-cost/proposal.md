## Why

Three changes in a row have now treated the suite's behaviour on a busy
machine as a per-file cost problem, and the measurements taken to close
the third one say it is not one.

`suite-survives-a-loaded-machine` budgeted six files.
`every-varying-check-has-a-budget` budgeted the rest and added a check so
the rule could not decay. Both worked: under an eight-worker CPU co-load,
`packages/core` went from seven failures to one across two passes. But
the one that remained is the interesting one.

`workbench.test.ts`, "discovers config, change artifacts, archive, and
canonical specs", measured **0.6 s** under co-load, and then **16.2 s**
for the same test on an identical repeat of the same co-loaded run. That
is a factor of 27 between two observations of a fixed amount of work.

A ceiling sized from a measurement assumes the measurement is repeatable.
At 27x it is not, and the consequence is structural rather than
cosmetic: every budget in the repository is now sized against a tail
nobody has explained, which means either over-provisioning every file —
blunting the ceiling's ability to catch a real hang — or accepting an
occasional failure that says nothing about the code.

Two other observations belong to the same family, and are carried here
so they stop being rediscovered:

- **The `tinypool` worker crash.** `suite-survives-a-loaded-machine`
  recorded `RangeError: Maximum call stack size exceeded`, then a
  `TypeError` inside `node_modules/tinypool/dist/index.js`, in
  `packages/webui` under co-load. It has since failed to reproduce twice
  — once under `--no-file-parallelism`, and once across a full 263-test
  co-loaded run. A crash inside the worker pool that appears under load
  and not otherwise is the same phenomenon as a fixed amount of work
  costing 27x more on one run than another.
- **A budget the check cannot see.** `harness-chain-runner.test.ts` fails
  under load through `vi.waitFor`'s own ceiling, not `testTimeout`. When
  that expires the test reports an assertion mismatch — "expected
  { kind: 'started' } to match object { kind: 'completed' }" — which
  reads as a broken assertion and is not one. `check-test-budgets.mjs`
  cannot see an in-test waiting ceiling, and a reader cannot tell this
  failure from a real regression.

## What Changes

- Establish what makes the same work cost 27x more on one co-loaded run
  than the next: worker-pool scheduling, Windows filesystem contention
  under concurrent temp-directory churn, or something else. The answer
  decides whether the remedy is pool configuration, fixture design, or
  the budgets that are already in place.
- Carry the `tinypool` crash until it is either reproduced and diagnosed
  or shown to be the same phenomenon.
- Make an in-test waiting ceiling legible: findable by the check, or
  failing in a way that names itself.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none yet — this change measures before it prescribes. `.openspec.yaml`
sets `skip_specs: true`, matching `git-fixture-test-cost` and
`ci-job-timeouts`. A requirement is added only if the diagnosis produces
a rule worth holding the repository to.)

## Impact

- Test infrastructure and vitest pool configuration. No `packages/*/src`
  production source changes, nothing published, no changeset expected.

## Explicitly out of scope

- **Raising a budget to make the variance go away.** That is the third
  time this trap would have been walked into, and the two changes before
  this one both refused it in writing. If a file's cost is unpredictable,
  a wider ceiling hides the unpredictability rather than answering it.
- **Removing the budgets.** They are measured, they are recorded, and
  they took `packages/core` from seven co-loaded failures to one. This
  change explains what remains; it does not undo what worked.
- **CI.** GitHub's runners pass. This is about a developer machine under
  real use.
