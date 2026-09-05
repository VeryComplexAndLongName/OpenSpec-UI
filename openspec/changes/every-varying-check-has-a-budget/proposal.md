## Why

`suite-survives-a-loaded-machine` shipped in #231 and did its job: six
files were established to be slow rather than stalled, each was given a
budget sized from a recorded measurement, and the global `testTimeout`
was deliberately left alone. It also did the honest thing at the end —
it re-ran the whole suite under the same co-load and **named** what still
failed rather than declaring victory.

Then it was archived, and what it named lost its owner.

Three failures were named by its task 3.2, measured 2026-09-05 under
eight busy CPU workers:

| Where | Failure |
| --- | --- |
| `packages/server/src/static.test.ts` | hook timeout |
| `packages/server/src/server.test.ts` | two cases timing out at 5000 ms |
| `packages/webui` | `tinypool` worker crash — `RangeError: Maximum call stack size exceeded`, then a `TypeError` in `node_modules/tinypool/dist/index.js` |

Nothing in `openspec/changes/` mentions any of them. The next person to
run the suite on a busy machine rediscovers all three, which is the exact
outcome that task was written to prevent.

The third one is not a timeout at all. A worker that blows its call stack
and takes the pool down with it makes no progress, and the requirement
that same change added to `quality-gates` says what to do about that:
"Where a check makes no progress, the system SHALL treat that as a defect
to diagnose rather than a budget to widen." It needs a diagnosis, and it
must not be given a number.

Meanwhile that requirement is now normative for **every** check whose
cost varies with the machine, and most of them do not meet it. Eight test
files carry a measured budget. Sixteen more do real filesystem or `git`
work and still inherit vitest's 5000 ms default:

`git.push.test.ts`, `git.test.ts`, `workbench.test.ts`,
`harness-chain-runner.test.ts`, `workspace-lease.test.ts`,
`security.test.ts`, `repo-bootstrap.test.ts`, `change-state.test.ts`,
`change-editor-store.test.ts`, `changeset-reminder.test.ts`,
`mechanical-checks.test.ts`, `process-scheduler.test.ts`,
`task-checklist.test.ts`, `task-templates.test.ts`,
`release-manifest.test.ts`, `server.test.ts`.

`git.push.test.ts` is the sharpest of them. Task 4.2 of the very change
that skipped it says it "is intermittent here and has hidden a real
failure behind it twice".

And nothing enforces the requirement. It is a paragraph in a spec file
that no check reads, so the next test file to do filesystem work will
inherit the default in the ordinary course of being written, and the
requirement will decay the way an unenforced rule always does. This
repository already knows the shape of the fix: `scripts/check-english.mjs`
turned the language policy from a paragraph into a failing build.

## What Changes

- The three failures `suite-survives-a-loaded-machine` named get an
  owner: each is measured, told slow from stalled, and then either
  budgeted or diagnosed. The `tinypool` crash is diagnosed, never
  budgeted.
- The sixteen remaining cost-varying test files each get a measured
  budget, recorded beside it, on the pattern the previous change set.
- A new `lint` check reads the test files and fails when one whose cost
  varies carries no budget, with a baseline for the files that are
  genuinely fixed-cost despite matching.

## Capabilities

### Modified Capabilities

- `quality-gates`: the budget rule is enforced by a check rather than
  remembered, so a new cost-varying test cannot silently inherit the
  default.

## Impact

- Test files across `core`, `server`, `webui`, `extension` and `cli`;
  one new script under `scripts/` wired into `npm run lint`. No
  `packages/*/src` production source changes, nothing published, no
  changeset.

## Explicitly out of scope

- **Raising the global `testTimeout`.** Decided against twice already,
  most recently as task 2.8 of `suite-survives-a-loaded-machine`: budget
  the tests whose cost is known to vary, and leave the default protecting
  the ones that should be fast. Nothing here reopens that.
- **Making the tests faster.** Some of this work is real — capturing
  trees, spawning `git`. Reducing it is a different change needing its
  own evidence that the coverage survives.
- **Giving the `tinypool` crash a bigger number.** Stated separately from
  the point above because it is the tempting shortcut here, and because
  the archived requirement forbids it in as many words.
- **CI.** GitHub's runners pass today. This is about a developer machine
  under real use, and about the suite meaning something when it is run
  there.
