Measured 2026-09-08 by opening the dialog: it shows a path picker. The
recommendation is absent in one host and truncated into a hint in the
other, no template can be applied, and a configuration with nothing wrong
renders nothing at all.

## 1. The standalone shell can advise

- [ ] 1.1 Read the change's open task count through
  `/api/change-timeline`, which already returns every task with its
  `done` state. No new route: the reason recorded for omitting the
  recommendation here said this shell cannot read the task list, and that
  was not checked.
- [ ] 1.2 Pass it as `recommendationInput` with no history. The
  recommendation is built for exactly this — it says "no previous run to
  go on" in the same breath as its answer.
- [ ] 1.3 A timeline that cannot be read leaves the recommendation out
  rather than guessing a count. Absent is honest; zero is a claim.

## 2. Shown where it can be read

- [ ] 2.1 The editor's quick-pick carries the recommendation as its own
  item, not in `placeHolder`. A hint that truncates is not a surface.
- [ ] 2.2 The standalone dialog already has room; it shows the
  recommendation and every ground beneath it.
- [ ] 2.3 A configuration with no findings says every ceiling can act,
  rather than rendering nothing. Silence makes "examined and fine"
  identical to "not examined".

## 3. A recommendation that can be acted on

- [ ] 3.1 The named configurations are offered in the dialog, with what
  each is for and when it is the wrong choice — the sentences that make
  the choice possible.
- [ ] 3.2 Applying one writes the change's configuration. This is not the
  path override, which deliberately writes nothing: applying a template
  is a configuration change a person asks for, and the run that follows
  should be the one the file describes.
- [ ] 3.3 After applying, the dialog reflects what the configuration now
  resolves to, rather than showing what it read before the write.
- [ ] 3.4 Only the templates that may be written to a change are offered
  — `templatesForScope("change")`, the same function the settings view
  uses.

## 4. Tests

- [ ] 4.1 The standalone dispatch carries a recommendation when the
  timeline is readable, with grounds naming the open task count.
- [ ] 4.2 It carries none when the timeline cannot be read, rather than a
  recommendation drawn from a guessed zero.
- [ ] 4.3 The editor's quick-pick lists the recommendation as an item.
- [ ] 4.4 A clean configuration produces the "every ceiling can act"
  statement in both hosts.
- [ ] 4.5 Applying a template from the dialog writes the change override
  — asserted on the writer — and the path override still writes nothing.
- [ ] 4.6 Only change-scoped templates are offered.

## 5. Verification

- [ ] 5.1 `openspec change validate --strict run-dialog-actually-advises`.
- [ ] 5.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
- [ ] 5.3 Version bump via `npx changeset` for `webui` and the extension.
- [ ] 5.4 Recapture `run-dialog.png` via `npm run test:browser` — the
  committed one shows the dialog this change replaces, and an article
  in this repository cites it. Build first; `npx playwright test` alone
  serves the previously built client.
- [ ] 5.5 `HARNESS.md`'s "One way in" section describes what the dialog
  shows. Correct it.
- [ ] 5.6 **Human-only**: open it on a real change and say whether it now
  answers "which configuration suits this, and why" — the question it was
  built for and did not answer.
