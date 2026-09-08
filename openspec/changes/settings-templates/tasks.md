The numbers come from this repository's own audit log, read through
`buildChangeCostReport` on 2026-09-08: 49 runs with a duration (median
7.7 min, p75 19.7, p90 34.9, longest 56.8) and 16 with a cost (median
$1.94, p90 $7.14, largest $8.67). Keep them measured. A ten-minute stage
ceiling — the round number a person reaches for — would have cut nearly a
third of those runs.

## 1. The templates

- [ ] 1.1 A named set in core: what it is for, when it is the wrong
  choice, where it may be applied, and the configuration it sets.
- [ ] 1.2 Three to start — careful, overnight, cheap. Enough to make the
  trade visible without turning the choice into another list to study.
- [ ] 1.3 Ceilings from the distribution, each saying which percentile it
  sits at. Where a value is judgement rather than measurement, say that
  instead of implying a number was derived.
- [ ] 1.4 Declare scope. `autonomyLevel: "autonomous"`,
  `reviewGate.mode: "agent-sufficient"` and
  `checkpoints.requireConfirmationBetweenSteps: false` are refused in a
  global file, so a template using any of them is per-change only.
- [ ] 1.5 Name only agents that report their usage, so every ceiling a
  template sets can act. Not because the others are worse — a person may
  still choose one and get the diagnostic's warning — but because a
  template speaks in the product's voice.

## 2. The check

- [ ] 2.1 A test asserting every template produces no findings from
  `findHarnessConfigLimits`. This is what separates a template from a
  suggestion.
- [ ] 2.2 The test iterates the template list rather than naming each
  one, so a template added without a check is impossible.
- [ ] 2.3 Show it can fail: alter one template to pair a cost ceiling
  with an agent that reports no cost, confirm the test fails naming that
  template, and restore it.

## 3. Applying one

- [ ] 3.1 Offer them in the harness settings view, with the "for" and
  "not for" sentences visible before applying — that is the choice being
  made.
- [ ] 3.2 Applying one fills the form rather than writing the file
  directly, so a person can adjust it and see the diagnostic update
  before saving.
- [ ] 3.3 A per-change-only template is not offered for the global file.

## 4. Verification

- [ ] 4.1 `openspec change validate --strict settings-templates`.
- [ ] 4.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
- [ ] 4.3 Version bump via `npx changeset` for `core` and `webui`.
- [ ] 4.4 Re-measure the audit log at implementation time and record
  what it said. If the numbers have moved materially from the ones above,
  the templates follow the new ones — the point is that they are measured,
  not that they are these particular figures.
- [ ] 4.5 **Human-only**: apply each template in the settings view and
  confirm the resulting configuration reads as the sentence promised —
  in particular that "overnight" does not quietly require confirmation
  between stages, which would make it not that.
