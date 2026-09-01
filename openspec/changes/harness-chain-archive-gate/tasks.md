Mark each task `[x]` as soon as its own check passes — not in one batch
at the end, and never before the work is actually done.

Path this change must hold end to end: `tasks.md` checkboxes → the
chain's start-stage decision → the archive precondition → what the run
reports. The incident happened because the first link read artifact
presence instead of task completion, so check each junction, not only
the ends.

## 1. Stop fabricating progress

- [x] 1.1 `packages/core/src/openspec.ts`, `normalizeStatusResult`
  (line ~349): delete the artifact-derived fallback. When the CLI reports
  no `progress`, return the result with `progress` absent — do **not**
  substitute a value computed from `artifacts`.
- [x] 1.2 `packages/core/src/openspec.ts`: make `progress` optional on
  `OpenSpecStatusResult`, with a comment stating that an artifact's
  `"done"` means the file exists and is not a statement about tasks —
  the confusion that caused two changes to be archived unimplemented.
- [x] 1.3 Fix every consumer the optional type breaks. The known one is
  the Processes view's percent-complete; show no percentage rather than
  `0%` or `100%` when progress is absent. Do **not** reintroduce a
  fallback computed from artifacts anywhere.

## 2. Count tasks where the decision is made

- [x] 2.1 `packages/core/src/harness-chain-runner.ts`: add a helper that
  reads a change's `tasks.md` and returns the number of unchecked and
  total task lines, matching lines that begin (after optional
  whitespace) with `- [ ]` / `- [x]`. Return `undefined` when the file
  cannot be read.
- [x] 2.2 `packages/core/src/harness-chain-runner.ts`,
  `determineStartStage()` (line ~79): keep the existing `proposeDone`
  artifact check for choosing `propose`, but decide `apply` vs `archive`
  from the helper in 2.1 — `apply` when any task is unchecked.
- [x] 2.3 Same function: when the helper returns `undefined`, return
  `apply`, never `archive` — see design.md, "The chain counts tasks
  itself, and fails safe".
- [x] 2.4 Same function: do **not** read `status.progress` here any more.

## 3. Gate the archive stage

- [x] 3.1 `packages/core/src/harness-chain-runner.ts`, in the
  `stage === "archive"` branch (around line 318, immediately before the
  `archiveChange(...)` call): using the same helper, yield a `failed`
  event and return `"failed"` **without** calling `archiveChange` when
  any task is unchecked, or when the count cannot be determined.
- [x] 3.2 Same file: the failure `reason` must name the change and the
  count, and say what to do — e.g. `cannot archive "<change>": <n>
  task(s) still unchecked; complete or verify them, then archive`. Do not
  reuse the generic wording of the surrounding `catch`.
- [x] 3.3 Same file: do **not** touch the `apply` stage and do **not**
  compare task counts before and after it — design.md explains why that
  check produces false positives.

## 4. Tests

- [x] 4.1 `openspec.test.ts`: a CLI result without `progress` yields a
  result whose `progress` is absent — not a synthesized zero-remaining
  value.
- [x] 4.2 `openspec.test.ts`: a CLI result that does carry `progress`
  passes it through unchanged.
- [x] 4.3 `harness-chain-runner.test.ts`: **the incident, as a test** —
  a change whose artifacts all exist and whose `tasks.md` has every task
  unchecked starts at `apply`, not `archive`.
- [x] 4.4 `harness-chain-runner.test.ts`: a change with all tasks checked
  starts at `archive`, as before.
- [x] 4.5 `harness-chain-runner.test.ts`: an unreadable `tasks.md` starts
  at `apply`.
- [x] 4.6 `harness-chain-runner.test.ts`: reaching `archive` with
  unchecked tasks emits `failed`, and `archiveChange` is **not** called.
- [x] 4.7 `harness-chain-runner.test.ts`: reaching `archive` with every
  task checked archives as before.
- [x] 4.8 `harness-chain-runner.test.ts`: the failure reason contains the
  change name and the remaining count.

## 5. Verification

- [x] 5.1 `openspec change validate --strict harness-chain-archive-gate`.
- [x] 5.2 `npm run typecheck`/`lint`/`test` for `@openspec-ui/core` and
  every workspace the optional `progress` type touches — all green. Note:
  `sprint-report.test.ts` and `change-timeline.test.ts` have pre-existing
  Windows timeout flakes under load; do not attempt to fix them here.
- [x] 5.3 `openspec/specs/agentic-harness/spec.md` and
  `openspec/specs/execution-core/spec.md` deltas are already written in
  this change's `specs/` directory — confirm they match what was
  implemented; do not rewrite them.
- [x] 5.4 Version bump via `npx changeset` (`@openspec-ui/core`, patch —
  a bug fix; chains were archiving unimplemented changes).
- [ ] 5.5 **Human-only, cannot be completed by an implementing agent**:
  rebuild and reinstall (`npm run reinstall:local --workspace
  openspec-ui-vscode`), reload, and run an `autonomous` chain on a change
  with unchecked tasks. Confirm it runs `apply` (not `archive`), and that
  if tasks remain afterwards it stops with the new message and the change
  is still in `openspec/changes/`. Leave unchecked if you are an agent.
