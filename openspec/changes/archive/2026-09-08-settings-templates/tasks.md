The numbers come from this repository's own audit log, read through
`buildChangeCostReport` on 2026-09-08: 49 runs with a duration (median
7.7 min, p75 19.7, p90 34.9, longest 56.8) and 16 with a cost (median
$1.94, p90 $7.14, largest $8.67). Keep them measured. A ten-minute stage
ceiling — the round number a person reaches for — would have cut nearly a
third of those runs.

## 1. The templates

- [x] 1.1 A named set in core: what it is for, when it is the wrong
  choice, where it may be applied, and the configuration it sets.
- [x] 1.2 Three to start — careful, overnight, thrifty. Enough to make the
  trade visible without turning the choice into another list to study.
  Named "thrifty" rather than "cheap" as this task first said: the
  trade it makes is spending less, not being worse, and "cheap" reads as
  a judgement about the result.
- [x] 1.3 Ceilings from the distribution, each saying which percentile it
  sits at. Where a value is judgement rather than measurement, say that
  instead of implying a number was derived.
  Each `basis` line names its percentile, and says which figures are
  judgement instead — four hours and $25 are not in the data.
- [x] 1.4 Declare scope. `autonomyLevel: "autonomous"`,
  `reviewGate.mode: "agent-sufficient"` and
  `checkpoints.requireConfirmationBetweenSteps: false` are refused in a
  global file, so a template using any of them is per-change only.
- [x] 1.5 Name only agents that report their usage, so every ceiling a
  template sets can act. Not because the others are worse — a person may
  still choose one and get the diagnostic's warning — but because a
  template speaks in the product's voice.

## 2. The check

- [x] 2.1 A test asserting every template produces no findings from
  `findHarnessConfigLimits`. This is what separates a template from a
  suggestion.
- [x] 2.2 The test iterates the template list rather than naming each
  one, so a template added without a check is impossible.
- [x] 2.3 Show it can fail: alter one template to pair a cost ceiling
  with an agent that reports no cost, confirm the test fails naming that
  template, and restore it.
  Done 2026-09-08. Pointed the `propose` stage of two templates at
  `copilot-cli-acp`, which reports tokens and no cost, while they set a
  cost ceiling: exactly those two templates failed, each named in its own
  test — `"careful"` and `"overnight"` — and the rest passed. Restored.

## 3. Applying one

- [x] 3.1 Offer them in the harness settings view, with the "for" and
  "not for" sentences visible before applying — that is the choice being
  made.
- [x] 3.2 Applying one fills the form rather than writing the file
  directly, so a person can adjust it and see the diagnostic update
  before saving.
- [x] 3.3 A per-change-only template is not offered for the global file.

## 4. Verification

- [x] 4.1 `openspec change validate --strict settings-templates`.
  Run 2026-09-08: valid.
- [x] 4.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
  Run 2026-09-08 on an idle machine: typecheck clean; lint clean apart
  from one warning that predates this change (`killTimer` unused in
  `packages/core/src/agents/shared.ts:210`); tests 48 cli, 673 core,
  285 extension, 62 server, 271 webui — core up 11, webui up 3.
- [x] 4.3 Version bump via `npx changeset` for `core` and `webui`.
  Done: `.changeset/settings-templates.md`.
- [x] 4.4 Re-measure the audit log at implementation time and record
  what it said. If the numbers have moved materially from the ones above,
  the templates follow the new ones — the point is that they are measured,
  not that they are these particular figures.
  Measured 2026-09-08, and these are the figures the templates use:
  49 runs with a duration, median 7.7 min, p75 19.7, p90 34.9, longest
  56.8; 16 with a cost, median $1.94, p90 $7.14, largest $8.67, $44.82
  in total. Only 16 of 49 runs reported a cost at all, which is why the
  duration figures carry more of the weight.
- [x] 4.5 **Human-only**: apply each template in the settings view and
  confirm the resulting configuration reads as the sentence promised —
  in particular that "overnight" does not quietly require confirmation
  between stages, which would make it not that.
  Confirmed live in the standalone UI on 2026-09-08, on a fresh
  disposable workspace. Careful and Thrifty saved their timeout, budget,
  attempts and checkpoint behaviour. Overnight saved autonomous mode, its
  timeout, budget and attempts, and
  `checkpoints.requireConfirmationBetweenSteps: false`.

  This task failed twice before it passed, and both failures were real.
  The first time no template's ceilings reached the file at all: the
  settings view sent two of the eight accepted keys and the writer
  replaces the file, so everything a template exists to set was deleted
  on save (`settings-save-what-was-shown`). The second time Overnight
  alone was wrong — its own text promised "No checkpoints between stages"
  and its configuration never said so (`a-template-keeps-its-promises`).

  Neither could have been caught here. The first is a defect in a
  different surface, the second was invisible to every test because
  nothing compared a template's sentences to its configuration. What this
  task did was look at the file that came out, which is the one thing no
  automated check in this repository was doing.
