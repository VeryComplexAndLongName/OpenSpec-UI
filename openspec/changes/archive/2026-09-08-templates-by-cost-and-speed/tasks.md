The configurations are unchanged; their ceilings were measured in
`settings-templates` and that measurement stands. This renames the axis
they are presented on and moves the figures to where the choice is made.

## 1. The axis

- [x] 1.1 `careful` becomes `balanced`, `overnight` becomes `fastest`,
  `thrifty` becomes `min-cost`. Ids as well as titles: nothing stores a
  template by id, so an alias would preserve a name no file refers to.
- [x] 1.2 Each title carries its ceilings — spend and time — so the axis
  is legible without opening anything.
- [x] 1.3 No configuration's values change. This is a presentation
  decision and dressing it as a tuning decision would hide it.

## 2. Fastest says what makes it fast

- [x] 2.1 Its `basis` states outright that nothing here makes an agent
  work faster, and names the two levers it actually uses: it does not
  wait for a person, and its ceilings are wide enough not to cut and
  restart a stage.
- [x] 2.2 A stage cut at a ceiling is retried from the start, so a tight
  ceiling makes a run longer. Say that, since it is the counter-intuitive
  half.
- [x] 2.3 The existing guard that a template's text matches its
  configuration still passes — `fastest` claims no checkpoints and must
  set them false, as `overnight` did.

## 3. Everywhere the names appear

- [x] 3.1 `harness-recommendation.ts`'s roomier-to-thriftier order.
- [x] 3.2 The settings view, the Run dialog, and the extension's
  quick-pick, including their test ids.
- [x] 3.3 `HARNESS.md`.
- [x] 3.4 The article and teaser, which name all three.
  Both updated. `HARNESS.md` needed no change: its "One way in" section
  describes what the dialog shows and never named a template.

## 4. Tests

- [x] 4.1 Every existing template test passes against the new ids, with
  no test asserting an old name.
- [x] 4.2 Each title contains a figure — asserted over the template list
  rather than named per template, so a fourth added without one fails.
  Three assertions, not one: the title carries a spend and a duration, the
  spend in the title is the one the configuration sets, and the list runs
  cheapest first. The second is the one that matters — a title is a claim,
  and one naming a figure the configuration does not set is the defect
  this repository already shipped once.
- [x] 4.3 The recommendation's escalation order still moves towards more
  room.

## 5. Verification

- [x] 5.1 `openspec change validate --strict templates-by-cost-and-speed`.
  Run 2026-09-08: valid.
- [x] 5.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
  Run 2026-09-08 on an idle machine: typecheck clean; lint clean with no
  warnings. Tests 48 cli, 710 core, 304 extension, 62 server, 296 webui
  — core up 7.

  One test caught a real slip: renaming the ids inside an ordered
  assertion left the expected order stale. The list now runs cheapest
  first, which is the axis, and the assertion says so.
- [x] 5.3 Recapture `run-dialog.png` via `npm run test:browser` — it
  shows all three by their old names, and an article in this repository
  cites it. Build first; `npx playwright test` alone serves the
  previously built client.
  Recaptured. The axis is legible in the buttons themselves — "Minimum
  cost · up to $3, 45 min", "Balanced · up to $5, 60 min", "Fastest · up
  to $25, 4 hours" — which is the whole point of the change.
- [x] 5.4 Version bump via `npx changeset` for `core` and `webui`.
  Done: `.changeset/templates-by-cost-and-speed.md`. Minor for core: the
  exported template ids change.
