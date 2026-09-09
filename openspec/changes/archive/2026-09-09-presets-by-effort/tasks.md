Effort vocabularies differ: `copilot` accepts seven values, `claude`
five, `codex` four, five agents none. A configuration storing `max` is
wrong for `codex` the moment it is applied.

## 1. The level

- [x] 1.1 A configuration declares a level — highest, high, medium,
  lowest — and not a value.
- [x] 1.2 Resolution against an agent's own list, by position. An agent
  with no effort resolves to none, which is a fact rather than a failure.
- [x] 1.3 Two levels landing on one value is reported. `codex-cli`
  accepts four, which is where it can happen.

## 2. The four

- [x] 2.1 Four configurations differing by level and by ceilings, from
  the widest to the tightest.
- [x] 2.2 None sets a model. Applying one would discard the model the
  workspace chose — the defect fixed one change ago for the merge, and
  reintroducing it at the source would be worse.
- [x] 2.3 Each says outright that the model is whatever is already
  configured, so a reader is not inferring it from an absence.
- [x] 2.4 Ceilings stay measured and keep saying which percentile they
  sit at. This changes the axis, not the numbers.

## 3. Tests

- [x] 3.1 The highest level resolves to `max` for `claude-cli` and to
  `high` for `codex-cli` — each agent's own highest, not a shared
  literal.
- [x] 3.2 An agent with no effort values resolves to none, and says so.
- [x] 3.3 A collision between two levels is reported.
- [x] 3.4 No configuration carries a model, asserted over the list rather
  than named per configuration.
- [x] 3.5 The existing guards still hold: every configuration produces no
  findings, and its text matches what it sets.

## 4. Everywhere the old names appear

- [x] 4.1 The recommendation's roomier-to-thriftier order.
- [x] 4.2 The dialog and the settings view, including test ids. The
  dialog also resolves each level against the agents this change would
  use, so what applying one would set is visible before it is applied.
- [x] 4.3 `HARNESS.md`.
- [x] 4.4 The article and the teaser, which name all three. Third time.

## 5. Verification

- [x] 5.1 `openspec change validate --strict presets-by-effort`.
- [x] 5.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine, after the last edit.
- [x] 5.3 Version bump via `npx changeset` for `core` and `webui`.
- [x] 5.4 Recapture `run-dialog.png`. Build first. `harness-settings.png`
  and `harness-change-override.png` came with it — the settings pickers
  now carry the level too.
- [x] 5.5 Resolve every configuration against every agent and record the
  table. A resolution that answers the same thing for all of them is not
  reading the vocabulary. Table in `design.md`; it found a collision on
  `codex-cli` and the spacing changed because of it.
