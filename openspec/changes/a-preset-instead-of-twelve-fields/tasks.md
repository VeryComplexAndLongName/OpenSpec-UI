The unit a person configures is an intention. The unit the product
offers is a field, and there are more of them every month.

## 1. The presets

- [ ] 1.1 `packages/core/src/harness-presets.ts` exports
  `HARNESS_PRESETS: readonly HarnessPreset[]`, each
  `{ id, title, intention, scope, values }` where `values` is a partial
  `HarnessConfig` and `scope` is `"global" | "change" | "either"`.
- [ ] 1.2 Preset `watched`: `autonomyLevel: "assisted"`,
  `checkpoints.requireConfirmationBetweenSteps: true`,
  `reviewGate.mode: "human-required"`. Scope `either`.
- [ ] 1.3 Preset `unattended-careful`: `autonomyLevel:
  "semi-autonomous"`, `checkpoints.requireConfirmationBetweenSteps:
  false`, `reviewGate.mode: "human-required"`, a chain `budget`. Scope
  `change` — two of those three may not appear in a global file.
- [ ] 1.4 Preset `unattended-all-the-way`: `autonomyLevel:
  "autonomous"`, `checkpoints.requireConfirmationBetweenSteps: false`,
  `reviewGate.mode: "agent-sufficient"`, a chain `budget`. Scope
  `change`. State in the preset's `intention` that this is what lets the
  `git` stage push, open a pull request and merge.
- [ ] 1.5 No preset introduces a key that
  `packages/core/src/harness-config.ts` does not already accept. A
  preset needing a new key is reported as a finding in this file rather
  than added.
- [ ] 1.6 `packages/core/src/harness-presets.test.ts`: every preset's
  `values` passes the config validator for its declared scope, and a
  preset whose scope is `either` is accepted in a global file — the
  assertion that catches a preset written for the wrong file.

## 2. Applying one

- [ ] 2.1 `applyHarnessPreset({ workspaceRoot, changeName?, presetId })`
  in `packages/core/src/harness-presets.ts` merges `values` over the
  target file's existing object and writes the ordinary JSON. It writes
  no marker naming the preset: there is no preset layer to read back.
- [ ] 2.2 It returns the keys it would overwrite and their current
  values before writing, so a caller can show what changes. A caller
  that does not ask still gets the write; the summary is a return value,
  not a prompt inside core.
- [ ] 2.3 Applying a preset to a target whose scope forbids it fails
  with the same error class the config validator already raises for that
  key, not a new one.
- [ ] 2.4 `packages/core/src/harness-presets.test.ts` covers: applying
  to an empty file, applying over existing values (the overwritten keys
  are reported), applying a `change`-scoped preset to the global file
  (refused), and that the file after applying resolves through
  `resolveHarnessConfig` to exactly the configuration the preset
  documents.

## 3. Where they are offered

- [ ] 3.1 `packages/webui/src/components/HarnessSettingsView.tsx` shows
  the presets applicable to the section being edited, above the fields,
  each with its `title` and `intention`. The fields stay exactly where
  they are: a preset is a starting point, not a replacement.
- [ ] 3.2 Choosing one shows the keys it will overwrite and their
  current values, and writes only on confirmation.
- [ ] 3.3 A preset whose `scope` excludes the section is not shown —
  not shown disabled. `setup-offers-only-what-applies` decided this for
  the setup flow and it holds here.
- [ ] 3.4 `packages/webui/src/components/HarnessSettingsView.test.tsx`:
  the global section offers only `either`-scoped presets; the per-change
  section offers all three; confirming writes the merged object; the
  overwrite summary lists exactly the keys that had values.

## 4. From a terminal

- [ ] 4.1 `openspec-ui-cli harness preset <id> [--change <name>] [--cwd
  <path>]` in `packages/cli/src/harness-preset-command.ts`, wired in
  `packages/cli/src/main.ts` with its own `USAGE` entry.
- [ ] 4.2 It prints the keys it will overwrite and applies the preset;
  `--dry-run` prints them and writes nothing. Exit `0` applied, `2`
  refused (unknown preset, wrong scope, unwritable file).
- [ ] 4.3 `packages/cli/src/harness-preset-command.test.ts`: applying
  exits 0 and writes, `--dry-run` exits 0 and writes nothing, an unknown
  id exits 2 and names the ids that exist.

## 5. Documentation

- [ ] 5.1 `HARNESS.md` gains a presets section listing each preset's
  exact values and its scope, adjacent to the key reference rather than
  replacing any of it.
- [ ] 5.2 `docs/how-to/run-a-change-unattended.md`, if it exists by then,
  names the preset as its first step. Do not create that file here — it
  belongs to `two-steps-to-a-run`.

## 6. Verification

- [ ] 6.1 This change validates strictly. `check(validate-change)`
- [ ] 6.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts.
- [ ] 6.3 A changeset exists: `core`, `webui` and `cli` minor.
  `check(changeset-present)`
- [ ] 6.4 **Delegated to `claude-cli`**: apply `unattended-careful` to a
  scratch change from the terminal, quote the file before and after and
  the exit code, then run `openspec-ui-cli run` against that change far
  enough to show it does not pause for a confirmation. Evidence: both
  file contents and the run's first two stage lines.
- [ ] 6.5 **Human-only**: with the harness settings open on a repository
  that has never been configured, choosing a preset is visibly less work
  than filling the fields, and the person can still tell what was set.
  Whether the presets removed work or only moved it is a judgement.
