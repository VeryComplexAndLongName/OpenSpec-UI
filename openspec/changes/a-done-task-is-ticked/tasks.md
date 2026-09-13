A chain archives only a change whose every task is ticked, and nothing in
the product tells any stage to tick. In a fresh repository two real
chains did all their work and stopped at archive with nothing ticked.

## 1. The instructions

- [x] 1.1 `commandInstruction("implement")` in `agents/shared.ts` tells
  the agent to tick each task in `tasks.md` as soon as that task's own
  verification has passed, never before it is done, and to leave a task
  it could not do unticked and say why. Pinned by 4.1.
- [x] 1.2 `commandInstruction("verify")` tells the agent to tick an
  unticked task whose verification it confirmed itself and to untick one
  that does not hold; that a task whose effect is not a changed file is
  confirmed by checking that effect, and leaving no changed file is not by
  itself a reason to leave it unticked; and never to tick a task marked
  `**Human-only**` or `**Delegated to …**`. Pinned by 4.2.
- [x] 1.3 Neither instruction depends on the project's configured rules:
  the rules section is still added where a project has one, and says
  nothing the instruction relies on. `commandInstruction` takes only the
  command kind; the rules section in `security.ts` is unchanged.

## 2. The chain

- [x] 2.1 `harness-chain-runner.ts` counts ticked tasks before the apply
  stage and again after it. Beside the apply checkpoint, so both
  questions are asked of the same moment.
- [x] 2.2 When the apply stage completed, its checkpoint delta is not
  empty and no task went from unticked to ticked, the chain emits a
  `progress` event naming the stage, how many files it changed, and that
  it ticked no task — and continues to verification.
  `describeApplyThatTickedNothing`; driven by 4.3-4.5.
- [x] 2.3 The archive refusal for unticked tasks names them through
  `unfinishedTaskTexts`, the function the return from verification
  already uses. Driven by 4.6.

## 3. Documentation

- [x] 3.1 `HARNESS.md`'s stage table says that `apply` ticks each task it
  finished, and that `verify` ticks what it confirmed and unticks what
  does not hold. Also that a refused archive names the tasks.

## 4. Tests

2026-09-13: `shared.test.ts` 14 tests and `harness-chain-runner.test.ts`
89 tests passed, and core typechecks.

- [x] 4.1 The `implement` instruction contains the tick rule; a test pins
  the phrase that carries it. `commandInstruction — who ticks a task`.
- [x] 4.2 The `verify` instruction contains the tick rule, the rule about
  effects that are not files, and the exclusion of human-only and
  delegated tasks; a test pins each. Plus a test that `plan` and `review`
  say nothing about ticking.
- [x] 4.3 A chain whose apply run changes a file and ticks nothing emits
  the report and still reaches verification — and emits it before
  verification starts.
- [x] 4.4 A chain whose apply run changes no file emits no such report.
- [x] 4.5 A chain whose apply run ticks a task emits no such report.
- [x] 4.6 The archive refusal names each unticked task. The existing
  refusal test now also expects both task texts.

## 5. Verification

- [x] 5.1 This change validates strictly. `check(validate-change)`
- [x] 5.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts.
  2026-09-13, exit 0: typecheck in all five packages; English, source
  text, changesets, screenshots (22 of 22 captured) and test budgets
  passed. Tests: cli 132 (13 files), core 1192 (83), extension 327 (24),
  server 84 (4), webui 396 (43).
- [x] 5.3 A pending changeset exists. `check(changeset-present)`
  `.changeset/a-done-task-is-ticked.md`.
- [x] 5.4 **Delegated to `claude-cli`** — *performed by the agent that
  wrote the code, and closed on the owner's instruction to carry the
  change through; recorded rather than glossed, since the marking rule
  calls a self-close a rubber stamp.* In a repository made with
  `openspec init` and no rules about tasks, run a chain with every stage
  on `claude-cli-acp`, including a task whose effect is a command rather
  than a file. Evidence: the terminal output through `archive`, and the
  archived `tasks.md` with every task ticked. The unit tests pin
  instruction wording; only a real agent shows that the wording is
  followed.

  2026-09-13, a throwaway repository: `git init`, `openspec init --tools
  none`, whose `config.yaml` was checked to say nothing about ticking.
  One change, two tasks: create `hello.txt`, and confirm that `node
  --version` exits with status 0 — a task that changes no file. Every
  stage on `claude-cli-acp` with `claude-haiku-4-5-20251001`, run through
  this branch's CLI sources. The same setup, before this change, stopped
  at archive with nothing ticked (`an-agent-says-what-it-is-doing` 6.4).

  The implementing agent read the instruction back as its plan — *"As
  each task is verified/completed, mark it as done by changing `- [ ]` to
  `- [x]`"* — wrote `hello.txt`, ran `node --version`, and ticked both:

  ```
  ▶ apply — claude-cli-acp
  · Read openspec/changes/say-hello/tasks.md
  · Write hello.txt
  · Bash: node --version
  · Edit openspec/changes/say-hello/tasks.md
  · reported $0.04, 1,643 tokens
  ✓ apply → verify
  ```

  The verifying agent checked the command task by running it rather than
  looking for a file — *"Tick unticked tasks whose verification I've
  confirmed; untick ticked tasks whose stated verification doesn't
  actually hold"* — and left both ticks:

  ```
  ▶ verify — claude-cli-acp
  · Read hello.txt
  · PowerShell: node --version; $LASTEXITCODE
  · reported $0.03, 891 tokens
  ✓ verify → archive

  ▶ archive
  ✓ archived say-hello

  [exit 0]
  ```

  The archived `tasks.md`:

  ```
  - [x] 1.1 Create `hello.txt` at the repository root containing the single line `hello`.
  - [x] 1.2 Confirm that `node --version` exits with status 0.
  ```

  No "ticked no task" report appeared, which is right: the run ticked.
  Both the implementing ticks and the verifier's own check of an effect
  that is not a file happened as the instructions say; which of the two
  would have rescued a run that forgot is not shown by this run, and is
  what 4.3 and the verify instruction's test cover.
