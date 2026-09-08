Measured 2026-09-08 by opening the dialog: it shows a path picker. The
recommendation is absent in one host and truncated into a hint in the
other, no template can be applied, and a configuration with nothing wrong
renders nothing at all.

## 1. The standalone shell can advise

- [x] 1.1 Read the change's open task count through
  `/api/change-timeline`, which already returns every task with its
  `done` state. No new route: the reason recorded for omitting the
  recommendation here said this shell cannot read the task list, and that
  was not checked.
- [x] 1.2 Pass it as `recommendationInput` with no history. The
  recommendation is built for exactly this — it says "no previous run to
  go on" in the same breath as its answer.
- [x] 1.3 A timeline that cannot be read leaves the recommendation out
  rather than guessing a count. Absent is honest; zero is a claim.

## 2. Shown where it can be read

- [x] 2.1 The editor's quick-pick carries the recommendation as its own
  item, not in `placeHolder`. A hint that truncates is not a surface.
- [x] 2.2 The standalone dialog already has room; it shows the
  recommendation and every ground beneath it.
- [x] 2.3 A configuration with no findings says every ceiling can act,
  rather than rendering nothing. Silence makes "examined and fine"
  identical to "not examined".
- [x] 2.4 Nothing is put in the quick-pick field that truncates first,
  and text that will not fit is shortened deliberately rather than cut by
  the control mid-word.
  **Added from a screenshot of the running editor**, which is the only
  way this was visible: the placeholder ended "every c…", a
  recommendation's grounds ended "reads as short …", and every template's
  intent was cut mid-sentence. The content was all present and none of it
  readable — the same defect this change fixes, reappearing in the
  surface fixing it.
  Recorded rather than quietly patched, and with its limit stated: a
  quick-pick gives one line per field. This keeps it from lying about
  what it cut; it does not make it a surface that can hold a paragraph.
  That is the standalone dialog, and in the editor it wants a webview —
  left for its own change.

## 3. A recommendation that can be acted on

- [x] 3.1 The named configurations are offered in the dialog, with what
  each is for and when it is the wrong choice — the sentences that make
  the choice possible.
- [x] 3.2 Applying one writes the change's configuration. This is not the
  path override, which deliberately writes nothing: applying a template
  is a configuration change a person asks for, and the run that follows
  should be the one the file describes.
- [x] 3.3 After applying, the dialog reflects what the configuration now
  resolves to, rather than showing what it read before the write.
- [x] 3.4 Only the templates that may be written to a change are offered
  — `templatesForScope("change")`, the same function the settings view
  uses.

## 4. Tests

- [x] 4.1 The standalone dispatch carries a recommendation when the
  timeline is readable, with grounds naming the open task count.
- [x] 4.2 It carries none when the timeline cannot be read, rather than a
  recommendation drawn from a guessed zero.
- [x] 4.3 The editor's quick-pick lists the recommendation as an item.
- [x] 4.4 A clean configuration produces the "every ceiling can act"
  statement in both hosts.
- [x] 4.5 Applying a template from the dialog writes the change override
  — asserted on the writer — and the path override still writes nothing.
- [x] 4.6 Only change-scoped templates are offered.
- [x] 4.7 Grounds too long for a quick-pick line are shortened here, and
  no template carries a sentence in the field that truncates first.

## 5. Verification

- [x] 5.1 `openspec change validate --strict run-dialog-actually-advises`.
  Run 2026-09-08: valid.
- [x] 5.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
  Run 2026-09-08 on an idle machine: typecheck clean; lint clean apart
  from one warning that predates this change (`killTimer` unused in
  `packages/core/src/agents/shared.ts:210`); tests 48 cli, 702 core,
  299 extension, 62 server, 293 webui — extension up 3, webui up 8.
  Re-run after the quick-pick fix: extension 301.

  The spec-delta drift check caught a real mistake first: this change's
  MODIFIED block dropped two scenarios the requirement already had,
  because they were rewritten rather than added to. A modified block
  carries the whole requirement; restored both and kept the new one
  beside them.
- [x] 5.3 Version bump via `npx changeset` for `webui` and the extension.
  Done: `.changeset/run-dialog-actually-advises.md`, minor for both.
- [x] 5.4 Recapture `run-dialog.png` via `npm run test:browser` — the
  committed one shows the dialog this change replaces, and an article
  in this repository cites it. Build first; `npx playwright test` alone
  serves the previously built client.
  Recaptured. The dialog now shows the recommendation and the named
  configurations, and the standalone one advises at all — which the
  picture is the proof of, since that host had no advice to show before.
- [x] 5.5 `HARNESS.md`'s "One way in" section describes what the dialog
  shows. Correct it.
  Done, and the article and teaser committed hours earlier with it: both
  described the dialog this change replaces, and the article's figure is
  the one recaptured above.
- [ ] 5.6 **Human-only**: open it on a real change and say whether it now
  answers "which configuration suits this, and why" — the question it was
  built for and did not answer.
