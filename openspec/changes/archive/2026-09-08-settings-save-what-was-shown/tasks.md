Measured 2026-09-08 by reading both save paths: the global save sends 2
of the 8 accepted top-level keys, the per-change save 3. Both writers
replace the file. So `timeout`, `maxStageAttempts`, `budget`,
`checkpoints` and `gitStageAllowlist` are deleted by pressing Save.

## 1. Stop deleting

- [x] 1.1 Keep the loaded configuration in the view and lay the form's
  fields over it at save time, rather than building the payload from the
  fields alone.
  Done. Consequence recorded in design.md: `resolveGlobal` returns a
  resolved configuration, so the global save now writes defaults
  explicitly. Smaller harm than deleting a ceiling, and stated rather
  than hidden.
- [x] 1.2 Do the same for a per-change override, which loads its file
  already and then discards everything it did not display.
- [x] 1.3 Do not merge in the writer. A merging writer cannot express
  deletion, and it would hide this rather than fix it — the view would
  still not know what it holds.
- [x] 1.4 Add no new form fields. Not destroying a ceiling and letting
  someone edit it are different questions, and only the first is asked
  here.

## 2. The guard

- [x] 2.1 A test that builds a configuration carrying every key in
  `TOP_LEVEL_CONFIG_KEYS`, loads it into the view, changes a displayed
  field, saves, and asserts the written configuration still carries all
  of them.
- [x] 2.2 It iterates the key list rather than naming fields, so the
  ninth key added to the schema and forgotten here fails immediately.
  Naming fields is what let this pass for as long as it did.
- [x] 2.3 Both scopes, because the two save paths are separate code and
  drop different subsets.
- [x] 2.4 Show it can fail: revert one save path, confirm the test fails
  naming the keys it lost, and restore it. Record what it said.
  Done 2026-09-08. Removed the layering from the global save only:
  `expected [ 'reviewGate', 'checkpoints', ...(4) ] to deeply equal []`
  — six of the eight keys gone in one save. Three older tests failed
  alongside it, which is the same finding from the other direction: they
  asserted the exact payload, and the exact payload was the defect.
  Restored.

## 3. Overnight becomes reachable

- [x] 3.1 Mount the template picker in the per-change section with
  `scope="change"`. The component is already scope-aware and
  `templatesForScope` already returns all three there; only the second
  mounting is missing.
- [x] 3.2 Applying one fills the change form, shows the same sentence,
  and — with task 1 done — actually saves the ceilings it promised.
- [x] 3.3 A test that applying "overnight" per-change and saving writes
  its `timeout` and `maxStageAttempts`, not merely its agents. This is
  the assertion the previous change was missing.

## 4. Verification

- [x] 4.1 `openspec change validate --strict settings-save-what-was-shown`.
  Run 2026-09-08: valid.
- [x] 4.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
  Run 2026-09-08 on an idle machine: typecheck clean; lint clean apart
  from one warning that predates this change (`killTimer` unused in
  `packages/core/src/agents/shared.ts:210`); tests 48 cli, 679 core,
  285 extension, 62 server, 276 webui — webui up 5.
- [x] 4.3 Version bump via `npx changeset` for `webui`.
  Done: `.changeset/settings-save-what-was-shown.md`.
- [x] 4.4 **Human-only**: with this merged, redo `settings-templates`
  task 4.5 — apply each of the three templates, save, and read the
  resulting file. The point of that task was to confirm the configuration
  reads as the sentence promised, and until now no template's ceilings
  reached the file at all.
  Confirmed live in the standalone UI on 2026-09-08 using a disposable
  workspace. Careful and Thrifty saved their autonomy, budgets, timeouts,
  attempts and checkpoint behavior; Overnight saved autonomous mode, its
  ceilings and budgets, and `checkpoints.requireConfirmationBetweenSteps:
  false`, matching its "No checkpoints between stages" promise.
