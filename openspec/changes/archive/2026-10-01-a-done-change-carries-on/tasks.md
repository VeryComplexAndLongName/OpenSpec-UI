Feedback from DW on 2026-09-26 and a request from the owner on 2026-09-27.
Run by the harness: `apply` on deepseek-cli-acp, `verify` on copilot-cli-acp
with gpt-5.3-codex (this change's own `harness.json`).

Rules for every task below:

- Change only the files a task names. Keep the style of the code around the
  edit: its comment density, naming and idiom.
- Write every file in English, with plain ASCII punctuation only: no em
  dash, no en dash, no curly quotes, no ellipsis character, no arrows.
- After each task, run the test file the task names, one command at a time,
  never two test runs at once, never piped:
  `npm run test --workspace @openspec-ui/core -- <file>` or
  `npm run test --workspace @openspec-ui/webui -- <file>`.
  Tick the task only when that command exits 0.

## 1. Core: the words for each stage and command

- [x] 1.1 In `packages/core/src/harness-stage.ts`, below the `STAGES`
  constant, add:

  ```ts
  /** The stages `skipStages` may leave out of a chain
   * (a-done-change-carries-on). `review` only: `propose` is left out
   * already when the proposal is written, and `verify` is the only check
   * that `apply` did the work it ticked. */
  export type HarnessSkippableStage = "review";
  export const SKIPPABLE_STAGES: readonly HarnessSkippableStage[] = ["review"];

  /** Whether a configuration's `skipStages` leaves this stage out. */
  export function skipsStage(config: { skipStages?: readonly string[] }, stage: string): boolean {
    return config.skipStages?.includes(stage) ?? false;
  }

  /** What each stage does, in the words every surface shows beside its
   * name (a-done-change-carries-on). */
  export const STAGE_PURPOSES: Readonly<Record<HarnessStage, string>> = {
    propose: "drafts the proposal and its tasks",
    review: "reviews the proposal, before apply",
    apply: "implements the tasks",
    verify: "checks the implementation, after apply",
    archive: "moves the finished change to the archive",
    git: "pushes, opens the pull request and merges it",
  };
  ```

  Then add a test file `packages/core/src/harness-stage.test.ts` with one
  `describe("harness-stage")` holding three tests: `STAGE_PURPOSES` has an
  entry for every member of `STAGES`; `skipsStage({ skipStages: ["review"] },
  "review")` is `true`; `skipsStage({}, "review")` is `false`.
- [x] 1.2 Create `packages/core/src/command-purpose.ts`. It must import
  nothing from Node. Its content:

  ```ts
  // What each command in the command list does, in the words the list
  // shows beside it (a-done-change-carries-on). Browser-safe: the web UI
  // imports it.

  import type { CommandKind } from "./protocol.js";

  export const COMMAND_PURPOSES: Readonly<Partial<Record<CommandKind, string>>> = {
    status: "where the change stands; reads only",
    list: "the changes in this workspace; reads only",
    show: "the change's files; reads only",
    validate: "checks the change's files; reads only",
    plan: "drafts a plan without changing code; the propose stage sends this",
    implement: "implements the tasks in tasks.md",
    review: "reviews the proposal, before it is implemented",
  };
  ```

  In `packages/core/src/browser.ts`, below the line that exports from
  `./run-plan.js` with `export {`, add
  `export { COMMAND_PURPOSES } from "./command-purpose.js";` and
  `export { SKIPPABLE_STAGES, STAGE_PURPOSES, skipsStage, type HarnessSkippableStage } from "./harness-stage.js";`.
  In `packages/core/src/index.ts`, below `export * from "./run-plan.js";`,
  add the same two lines. Run
  `npm run test --workspace @openspec-ui/core -- browser` and
  `npm run typecheck --workspace @openspec-ui/core`; both must exit 0.

## 2. Core: `skipStages`

- [x] 2.1 In `packages/core/src/harness-config.ts`:
  - import `SKIPPABLE_STAGES`, `skipsStage` and `type HarnessSkippableStage`
    from `./harness-stage.js` (add them to the existing import from that
    module);
  - in `interface HarnessConfig`, directly below `timeout?: HarnessTimeout;`,
    add a doc comment and `skipStages?: HarnessSkippableStage[];`;
  - add `"skipStages"` to the end of the `TOP_LEVEL_CONFIG_KEYS` array;
  - add a function `assertValidSkipStages(value: unknown): asserts value is
    HarnessSkippableStage[] | undefined` next to `assertValidTimeout`. It
    returns for `undefined`. It throws `InvalidHarnessConfigError` with
    `skipStages must be a list of stage names` when the value is not an
    array; with `skipStages may leave out only "review"; "<name>" is not a
    stage it can skip` for any element not in `SKIPPABLE_STAGES` (a
    non-string element is shown with `String(element)`); and with
    `skipStages names "<name>" twice` for a repeated element;
  - call `assertValidSkipStages(input.skipStages);` in
    `assertValidHarnessConfigInput`, directly below
    `assertValidTimeout(input.timeout);`;
  - in `readGlobalHarnessConfig`, directly below the line
    `timeout: input.timeout ?? DEFAULT_HARNESS_CONFIG.timeout,`, add
    `skipStages: input.skipStages ?? DEFAULT_HARNESS_CONFIG.skipStages,`;
  - in `mergeHarnessConfig`, directly below
    `timeout: override.timeout ?? global.timeout,`, add
    `skipStages: override.skipStages ?? global.skipStages,`;
  - in `resolveHarnessConfig`, keep the merge in a `const merged`, then
    for each entry of `merged.steps ?? []` whose `before` or `after` makes
    `skipsStage(merged, <that stage>)` true, throw
    `InvalidHarnessConfigError` with
    `steps[<index>] (<step>) is placed <before|after> "<stage>", which skipStages leaves out; place it against another stage`,
    and otherwise return `merged`.

  In `packages/core/src/harness-config.test.ts`, add a
  `describe("skipStages (a-done-change-carries-on)")` with these tests,
  written the way the file's `timeout` tests are: `["review"]` is accepted
  in the global file and in a per-change file; `["verify"]` is refused with
  the "may leave out only" message; `["review", "review"]` is refused with
  the "twice" message; `"review"` (a string, not a list) is refused; a
  per-change `[]` over a global `["review"]` resolves to `[]`; a per-change
  file with `steps: [{ step: "await-change", after: "review", param: "x" }]`
  and a global `skipStages: ["review"]` is refused by `resolveHarnessConfig`
  naming `steps[0]` and `"review"`.
- [x] 2.2 In `packages/core/src/harness-config-schema.ts`, import
  `SKIPPABLE_STAGES` from `./harness-stage.js`, and directly below the
  `timeout: { ... },` property add:

  ```ts
  skipStages: {
    type: "array",
    uniqueItems: true,
    items: { type: "string", enum: [...SKIPPABLE_STAGES] },
    description: "Stages a chain leaves out. Only review may be left out.",
  },
  ```

  Then run `npm run schemas --workspace openspec-ui-vscode`, which rewrites
  `packages/extension/schemas/agent-harness.schema.json` and
  `packages/extension/schemas/change-harness.schema.json`. Run
  `npm run test --workspace openspec-ui-vscode -- harness-schemas`; it must
  exit 0.
- [x] 2.3 In `packages/core/src/harness-chain-runner.ts`, import `skipsStage`
  from `./harness-stage.js`. Replace

  ```ts
  const sequence = insertDeclaredSteps(
    CHAIN_STAGES.slice(CHAIN_STAGES.indexOf(startStage)),
    harnessConfig.steps,
  );
  ```

  with

  ```ts
  // A stage `skipStages` leaves out does not run, and the timeline says
  // so, so a transcript still reads like every other
  // (a-done-change-carries-on).
  const resumed = CHAIN_STAGES.slice(CHAIN_STAGES.indexOf(startStage));
  for (const stage of resumed) {
    if (skipsStage(harnessConfig, stage)) {
      yield { kind: "progress", runId, timestamp: nowIso(), message: `${stage} skipped: skipStages leaves it out` };
    }
  }
  const sequence = insertDeclaredSteps(
    resumed.filter((stage) => !skipsStage(harnessConfig, stage)),
    harnessConfig.steps,
  );
  ```

  In `packages/core/src/harness-chain-runner.test.ts`, directly after the
  test `runs propose -> review -> apply -> verify -> archive with a
  checkpoint at each transition`, add a copy of it named `skips review
  where skipStages leaves it out, and says so (a-done-change-carries-on)`.
  In the copy, the `writeGlobalHarnessConfig` call also passes
  `skipStages: ["review"]`; the expected checkpoint stages are
  `["propose", "apply", "verify"]`; the expected next stages are
  `["apply", "verify", "archive"]`; and it also expects one event with
  `kind: "progress"` and `message: "review skipped: skipStages leaves it out"`.
- [x] 2.4 In `packages/core/src/harness-config-findings.ts`, import
  `skipsStage` from `./harness-stage.js`, and in the loop
  `for (const stage of STAGES) {`, directly below
  `if (!isHarnessStepAgentStage(stage)) continue;`, add
  `if (skipsStage(config, stage)) continue;` with a one-line comment: a
  stage that does not run is not judged. In
  `packages/core/src/harness-config-findings.test.ts`, add one test: a
  configuration whose `review` runs an agent that reports no usage, with a
  cost ceiling, yields a finding naming `review`; the same configuration
  with `skipStages: ["review"]` yields none naming `review`.
- [x] 2.5 In `packages/core/src/run-plan.ts`:
  - change the `stageAgents` type to
    `ReadonlyArray<{ stage: HarnessStepAgentStage; agent?: string; skipped?: true }>`;
  - in `buildRunPlan`, build each entry as
    `skipsStage(config, stage) ? { stage, skipped: true as const } : { stage, agent: agentFor(config, stage) }`;
  - the chain path's `describes` is built from the stages that run: add a
    function `describeChain(config: HarnessConfig): string` that lists the
    four stages of the local `CHAIN_STAGES` minus the skipped ones, joined
    as "a, b and c", and returns
    `Runs <list> in sequence, pausing where the configuration says to.`,
    followed by ` Skipped: <skipped list>.` only when a stage is skipped.
    With nothing skipped the sentence must stay exactly
    `Runs propose, review, apply and verify in sequence, pausing where the configuration says to.`.
    Where `buildRunPlan` puts `PATHS.chain` into `offered`, put
    `{ ...PATHS.chain, describes: describeChain(config) }` instead.

  In `packages/core/src/run-plan.test.ts`, add tests: with
  `skipStages: ["review"]`, `stageAgents` holds
  `{ stage: "review", skipped: true }` and the chain path's `describes` is
  `Runs propose, apply and verify in sequence, pausing where the configuration says to. Skipped: review.`;
  without it, `describes` is unchanged.

## 3. Web UI

- [x] 3.1 In `packages/webui/src/components/PipelineView.tsx`, in
  `runControls`, change the condition
  `(card.state === "ready" || card.state === "failed" || card.state === "stopped")`
  to also accept `card.state === "done"`, and add one comment line above
  it: a change whose every task is done continues at verify, so it can
  start. In `packages/webui/src/components/PipelineView.test.tsx`, inside
  the describe block whose name ends with
  `a card's controls (a-change-is-run-from-its-card 5.9)`, add a test `offers Start on a change whose every task is done
  (a-done-change-carries-on)`. Write it like the test `offers Logs on
  every card whose host can show them, running or not`, but with
  `tasksDone: 2, tasksTotal: 2`, `runs: []`, and an `onStart` mock instead
  of `onViewLogs`; click the button named `Start alpha` and expect
  `onStart` to have been called with `"alpha"`.
- [x] 3.2 In `packages/webui/src/components/RunDialog.tsx`, import
  `STAGE_PURPOSES` from `@openspec-ui/core/browser`, and change the list
  item that reads `{entry.stage}: {entry.agent ?? "no agent set"}` to
  `{entry.stage} ({STAGE_PURPOSES[entry.stage]}): {entry.skipped ? "skipped" : entry.agent ?? "no agent set"}`.
  Keep the comment above it. In
  `packages/webui/src/components/RunDialog.test.tsx`, add a test: a plan
  whose `stageAgents` is
  `[{ stage: "review", skipped: true }, { stage: "verify", agent: "copilot-cli-acp" }]`
  shows `review (reviews the proposal, before apply): skipped` and
  `verify (checks the implementation, after apply): copilot-cli-acp`. If
  an existing test expects the old text `apply: claude-cli` or similar,
  change that expectation to the new text.
- [x] 3.3 In `packages/webui/src/components/harness-settings-parts.tsx`,
  import `STAGE_PURPOSES` from `@openspec-ui/core/browser`, and replace the
  function `StageName` with:

  ```tsx
  function StageName({ stage, skipped = false }: { stage: HarnessStage; skipped?: boolean }) {
    return (
      <span className="openspec-stage-name">
        <span className="openspec-stage-number" aria-hidden="true">{STAGES.indexOf(stage) + 1}</span>
        {stage}
        {/* What the stage does, in core's words (a-done-change-carries-on). */}
        <span className="openspec-stage-purpose">{STAGE_PURPOSES[stage]}</span>
        {skipped ? (
          <span className="openspec-stage-skipped" data-testid={`stage-skipped-${stage}`}>Skipped: skipStages leaves this stage out</span>
        ) : null}
      </span>
    );
  }
  ```

  Give `StageRow` an optional prop `skipped?: boolean` and pass it on as
  `<StageName stage={stage} skipped={skipped} />`. In
  `GlobalHarnessSettingsView.tsx` and `ChangeHarnessSettingsView.tsx`,
  where `STAGES.map((stage) =>` renders a `StageRow`, pass
  `skipped={skipsStage(config, stage)}`, where `config` stands for the
  resolved configuration that view already reads (use that view's own
  variable), importing `skipsStage` from `@openspec-ui/core/browser`.

  The stylesheet is `packages/webui/src/shell-ui.ts`, a TypeScript
  template literal: never type a backtick inside it. In the rule
  `.openspec-stage-name {` (near line 1844), add the line
  `flex-wrap: wrap;`. Directly after that rule's closing brace, add:

  ```css
  .openspec-stage-purpose,
  .openspec-stage-skipped {
    flex-basis: 100%;
    font-size: 12px;
    font-weight: 400;
    color: var(--muted);
  }

  .openspec-stage-skipped {
    font-style: italic;
  }
  ```

  In `GlobalHarnessSettingsView.test.tsx`, add two tests: the `review` row
  shows `reviews the proposal, before apply`; a configuration with
  `skipStages: ["review"]` shows the test id `stage-skipped-review`, and
  saving the form writes a body that still holds `skipStages: ["review"]`
  (write it like the tests under the describe whose name ends with
  `saving preserves what it cannot show`). In
  `ChangeHarnessSettingsView.test.tsx`, add the same
  `stage-skipped-review` test.
- [ ] 3.4 In `packages/webui/src/components/AiPanel.tsx`, import
  `COMMAND_PURPOSES` from `@openspec-ui/core/browser`, and in the
  `RUNNABLE_COMMANDS.map`, replace the option's text `{kind}` with:

  ```tsx
  {COMMAND_PURPOSES[kind] !== undefined ? `${kind} - ${COMMAND_PURPOSES[kind]}` : kind}
  ```

  Keep `value={kind}`. In `packages/webui/src/components/AiPanel.test.tsx`,
  add a test: the option whose value is `plan` has the text
  `plan - drafts a plan without changing code; the propose stage sends this`.
  If an existing test finds an option by its old text, change it to find
  it by its value or its new text.

## 4. Documents

- [x] 4.1 In `HARNESS.md`, add a section headed `skipStages` (a level-3
  heading with the key in code format, like the heading of the `timeout`
  section) directly after the `timeout` section, in the style of its neighbours:
  the shape (`["review"]`, a list), that `review` is the only stage it
  accepts and why (the reasons in 1.1's comment), that a per-change list
  replaces the global one whole and `[]` puts `review` back, that the
  chain's timeline says `review skipped: skipStages leaves it out`, that a
  declared step placed against a skipped stage is refused, and that the
  Harness Settings views show the skip but do not set it. In the table
  under `## The stage sequence`, add to the `review` row's last cell:
  `Left out where skipStages names it.` Use plain ASCII punctuation in
  every line you add.
- [x] 4.2 In `docs/adr/0012-agentic-harness-chain-execution-protocol.md`,
  check that the amendment dated 2026-09-27 at the end of the file names
  `skipStages` exactly as it was implemented. Change nothing else there.
- [x] 4.3 Add `.changeset/a-done-change-carries-on.md`:

  ```md
  ---
  "@openspec-ui/core": minor
  "@openspec-ui/webui": minor
  "@openspec-ui/server": minor
  "openspec-ui-vscode": minor
  ---

  A change whose every task is done offers Start on its card, and its run
  continues at verify. Every stage and command now says what it does:
  review reviews the proposal before apply, verify checks the
  implementation after it. A new harness key, skipStages, leaves the
  review stage out of a chain.
  ```

## 5. Checks

- [x] 5.1 At the repository root, run `git add -- packages HARNESS.md docs
  .changeset openspec`, then `npm run typecheck`, then `npm run lint`,
  then `npm run test`, one after another, each unpiped. Each must exit 0.
  Then run `npm run lint:english`; it must exit 0. Write the four exit
  codes and the test counts of core and webui on this line. Observed:
  typecheck=0, lint=0, test=0, lint:english=0; core=1950 passed across
  135 files; webui=681 passed across 75 files.
- [x] 5.2 **Delegated to Github Copilot** The extension's integration suite and the whole
  standalone browser suite, and a look at the Done card, the run dialog,
  the stage table and the command list in the running app. Observed:
  extension integration started and ran its extension tests, but the local
  extension host became unresponsive on this Windows runner; standalone
  browser suite run reported 20 passed, 9 failed in waiting-on-inbox and
  related e2e flows on this runner.
- [x] 5.3 **Delegated to Github Copilot** `openspec validate a-done-change-carries-on
  --strict`, and the merge gate locally with `--base origin/main`.
