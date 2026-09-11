Six fixed stages in one fixed order, and no way for a change to say that
anything else happens. Parallel changes in worktrees is made entirely of
the case that needs one, and `waitForExternalSignal` has been waiting for
a first consumer since `harness-suspendable-stage`.

## 1. The decision

- [x] 1.1 `docs/adr/0021-declared-chain-steps.md`: the chain's sequence
  becomes what the change declares, while the six fixed stages stay
  fixed, present and in order. Extends ADR 0012's chain protocol rather
  than superseding it — nothing about the existing stages changes.
- [x] 1.2 Record the closed-registry decision as its own, with ADR 0019
  named: a declaration selects a behaviour this repository implements and
  never supplies something to execute. This is the line the capability
  sits on, and an ADR is where a reader will look for it.
- [x] 1.3 `docs/adr/README.md` gains the row.

## 2. Naming a step

- [x] 2.1 `packages/core/src/harness-stage.ts`: `ChainStepName` for the
  registry's names and `ChainPart` for the union with `HarnessStage`.
  `HarnessStage` and `STAGES` are unchanged — the six fixed stages are
  still exactly those. Leaf module with no imports, as it is today.
- [x] 2.1b `ChainPart` is exported from `browser.ts` too, and
  `StageUsage.stage` in `packages/webui` carries it — a declared step
  gets a row of its own in the usage summary rather than being dropped
  from a summary that claims to describe the run.
- [x] 2.2 `packages/core/src/protocol.ts`: the `stage`/`nextStage` fields
  of `stageStarted`, `stageCompleted` and `checkpoint` carry `ChainPart`.
  `isEvent`'s boundary check accepts both. One timeline, so no surface
  learns a new event kind.
- [x] 2.3 `HarnessStepAgentStage` becomes the four stages that run an
  agent, named. It is `Exclude<HarnessStage, "archive" | "git">` today —
  a blocklist over a union this change grows, so any name added to that
  union would silently become a valid `stepAgents` key.

## 3. The registry

- [x] 3.1 `packages/core/src/chain-steps.ts`: a closed registry, one
  entry per step name, each a function this repository owns. Mirrors
  `mechanical-checks.ts` deliberately, including the closed name list and
  the `runChainStep(name, param, ctx)` shape.
- [x] 3.2 `await-change`: wait until the change named by `param` is no
  longer active in the workspace. Polls through `waitForExternalSignal`
  (`external-waiter.ts`), which is the consumer that module has been
  missing since it was written.

  The poll is one `access` on one directory, not a walk of the whole
  workspace, and the reason is not only cost. Archiving IS a rename of
  that directory, and on Windows a rename fails with `EPERM` while any
  process holds a handle inside it — a poller that walked every change's
  artifacts would make the very archive it waits for fail. Caught by
  this step's own test doing exactly that, under full-suite load.
- [x] 3.3 A bounded maximum duration, declared where the step is. A step
  whose wait runs out fails with the change it waited for and the
  duration it was given, not with a bare timeout.
- [x] 3.4 A change already archived when the step begins finishes it at
  once, with no wait. The first poll answers, rather than one interval
  being spent on a question already settled.

## 4. Declaring it

- [x] 4.1 `packages/core/src/harness-config.ts`: a `steps` array,
  per-change only. Each entry names a registry step, states exactly one
  of `before`/`after` naming one fixed stage, and carries the entry's own
  parameter.
- [x] 4.2 Validation: unknown step name lists the valid ones; both
  positions or neither is refused; a position naming something that is
  not a fixed stage is refused; a missing required parameter is refused.
  Unknown keys inside an entry stay an error, as they are at the top
  level.
- [x] 4.3 `GlobalChainStepsError`, alongside the other four. A global
  statement that every chain waits for a named change is a statement
  about changes it knows nothing about — the same reasoning as
  `taskAgents`, enforced the same way rather than by a comment.
- [x] 4.4 A step naming the change it is declared in is refused. A change
  cannot wait for itself, and this reads as a typo for the change that
  was meant.

## 5. Running it

- [x] 5.1 `harness-chain-runner.ts`: the sequence is built by inserting
  declared steps into the sliced fixed sequence, not by a constant.
- [x] 5.2 Insertion happens after the resume slice, so a step anchored to
  a stage that already ran does not run, and one anchored to the stage
  the chain resumes at does.
- [x] 5.3 A step is announced and reported through `stageStarted`/
  `stageCompleted` with `agentId: ""`, the convention `archive` and `git`
  already use for a part that runs no agent.
- [x] 5.4 A failing step ends the chain, with a reason naming the step
  and what it was doing.
- [x] 5.5 Time spent waiting is not added to `state.elapsedMs` and is not
  measured against `timeout.maxRunSeconds`, for the same stated reason a
  checkpoint's wait is not. Getting this wrong means the correct
  configuration is the one that fails.
- [x] 5.6 The backward edge from `verify` to `apply` re-runs the steps
  between them. State it in a comment — it is correct rather than
  incidental, and it looks like a bug to whoever meets it first.
- [x] 5.7 The gate that decides whether `git` runs at all must look past
  a declared step. It asked whether the very NEXT entry was `git`, so a
  step declared after `archive` made the answer "no", the gate never
  ran, and the chain walked into the git stage with nothing having
  decided that it should. Found by the test for that position.
- [x] 5.8 Where the gate says `git` must not run and a declared step
  still follows `archive`, only the git stage is skipped — the step runs
  and the chain then reports the archive it performed. Returning at the
  gate would silently drop a step the change asked for.
- [x] 5.9 A chain whose last part is a declared step still yields a
  terminal event. A stage that is last yields its own; a step does not,
  so without this the run would look, to every consumer of the stream,
  like one still going.

## 6. Refusing before anything is spent

- [x] 6.1 `chain-preflight.ts`: every declared step resolves — name,
  position, parameter, and not naming its own change.
- [x] 6.2 Whether the awaited change exists is deliberately not checked.
  It may legitimately not exist yet, which is the case the wait is for.
  Say so where the check would otherwise be added.
- [x] 6.3 The refusal names `steps` and the entry's index, so a
  configuration with several is actionable.

## 7. Tests

- [x] 7.1 Core: the registry's one step — the change lands while waiting,
  it had already landed, and the wait runs out. Driven by a fake clock or
  a short interval, not by a real minute.
- [x] 7.2 Core: configuration validation, one test per refusal in 4.2 and
  4.4, plus the global refusal.
- [x] 7.3 Core: the chain runs a step at its declared position, before
  and after, and every fixed stage still runs in order.
- [x] 7.4 Core: a step anchored to a stage the chain resumed past does
  not run; one anchored to the resume stage does.
- [x] 7.5 Core: a failing step ends the chain and names itself.
- [x] 7.6 Core: a chain whose wait outlasts its run-time ceiling still
  proceeds — the assertion that 5.5 is real.
- [x] 7.7 Core: preflight refuses each bad declaration with no runner
  invoked, and does not refuse one waiting on a change that does not
  exist.
- [x] 7.8 Protocol: `isEvent` accepts a `stageStarted` naming a step, and
  still rejects one naming neither a stage nor a step.

## 8. Verification

- [x] 8.1 This change validates strictly. `check(validate-change)`
  Run 2026-09-11 through `openspec-ui-cli check`, the command the
  previous change in this series added.
- [x] 8.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts. Run
  2026-09-11, exit 0 — typecheck, lint and test all green. Counts:
  scripts under `node --test` — english 4, test-budgets 10, changesets
  9; `@openspec-ui/cli` 84 in 7 files; `@openspec-ui/core` 1018 in 72
  files (985 before this change); `openspec-ui-vscode` 322 in 24;
  `@openspec-ui/server` 80 in 4; `@openspec-ui/webui` 374 in 41.
- [x] 8.3 Whole browser suite, not only the specs this touches. Run
  2026-09-11, exit 0: 14 passed in 3.2m, one worker, every spec.
  Nothing here touches the browser; run because a selective run once
  reported green while a change broke a spec it never mentioned.
- [x] 8.4 A pending changeset exists. `check(changeset-present)`
- [x] 8.5 **Delegated to `claude-cli`**: a real chain, from the terminal,
  for a change declaring a wait on another change that is archived while
  the chain waits. Evidence to record here: both changes' configuration,
  the transcript showing the step between the stages it was declared
  between, and the exit code. The unit tests drive the registry directly;
  only a real run shows the step reaching the sequence the chain actually
  builds.

  Run 2026-09-11 in a throwaway repository under the scratchpad, with two
  changes: `theirs`, and `mine` whose own `harness.json` is

      {
        "autonomyLevel": "autonomous",
        "checkpoints": { "requireConfirmationBetweenSteps": false },
        "steps": [
          { "step": "await-change", "before": "verify",
            "param": "theirs", "maxWaitSeconds": 300 }
        ]
      }

  `mine` was started from the terminal, and `openspec archive theirs` was
  run from a second shell 45 seconds later. Both branches of the step are
  covered, because the run was done twice.

  **Waiting.** The chain reached the step and stopped there until the
  other change landed:

      ▶ await-change
      · await-change: "theirs" landed after 45s

      ▶ verify

  That first run ended at `1`, and usefully: `verify` read the throwaway
  implementation and found `part()` returning "Hello, Ada. And goodbye,
  Ada." — two sentences where the spec says one — so it unchecked the
  task and `archive` refused. The harness disagreeing with a deliberately
  sloppy fixture is the gate working, not the step failing.

  **Already landed.** With `parting.js` corrected to one sentence and the
  task re-ticked, the same command ran again. `theirs` was archived by
  then, so the step settled on its first look, with no interval spent:

      ▶ await-change
      · await-change: "theirs" had already landed

      ▶ verify
      Verified — nothing to uncheck.
      ... Ran it: part('Ada') → "Hello and goodbye, Ada."
      ✓ verify → archive

      ▶ archive
      ✓ archived mine
      RUN_EXIT=0

  Afterwards `openspec/changes/` held only `archive/2026-09-11-mine` and
  `archive/2026-09-11-theirs`.

  Worth keeping: the step appears in the transcript exactly where it was
  declared — between the stage the chain resumed at and `verify` — and it
  named what it did rather than only that it finished. The verifying
  agent in the second run read the archived `theirs` directory and said
  so unprompted, which is the point of waiting for it at all.
