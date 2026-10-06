Reported by the owner on 2026-10-05: applying any named configuration to
a change under Act failed. Rule: configurations change freely by rules a
person can follow, and are refused only where truly needed.

## 1. Core

- [x] 1.1 `harness-config.ts`: `withoutActItCannotUse` (design.md
  decision 1). Tests in `harness-config.test.ts`: act with another level
  loses its mode and keeps fallback and allowances; act under autonomous
  unchanged; a `supervisor` left empty is removed; a hand-written file
  with act and another level is still refused.
  Placed in `harness-templates.ts`, beside the function that applies
  configurations, since `harness-config.ts` is not browser-safe; with
  `actTurnedOff` and `actTurnedOffNote` for the surfaces. Four cases in
  `harness-templates.test.ts`; the hand-written refusal in
  `harness-config.test.ts`. 266 passed across both.
- [x] 1.2 `harness-templates.ts`: `changeTemplateConfigToWrite` applies it.
  Test in `harness-templates.test.ts`: every change-scope configuration
  over a change under Act writes a file the validator accepts, with no
  mode and the fallback kept.
  Every change-scope configuration over a change under Act is written
  and accepted by `writeChangeHarnessConfig` (`harness-config.test.ts`),
  with no mode and the fallback kept (`harness-templates.test.ts`).
- [x] 1.3 Found in the owner's check of 4.3: a file written by hand with
  Act and another level did not open in its Harness Settings ("Load
  failed"), since the rule was part of reading it. `harness-config.ts`:
  `actWithoutAutonomousProblem`, checked on write and on resolve, not on
  read (design.md decision 4); the settings view offers Save on such a
  file with nothing else changed. Tests: `harness-config.test.ts` (read
  succeeds, resolve refuses and names the way out), 267 passed with
  `harness-templates`; `ChangeHarnessSettingsView.test.tsx`, 32 passed.

## 2. Surfaces

- [x] 2.1 `packages/webui`: `changeConfigToSave` applies it; the
  supervisor's note says Act turns off on saving; the applied message
  says so after a configuration. Tests in
  `ChangeHarnessSettingsView.test.tsx`.
  `changeConfigToSave` and the applied message; the standalone run
  dialog's applied note too (`applyTemplateToChange` returns whether Act
  went off). Two cases replace the old "will be refused" one; 31 passed
  in the file, webui 713.
- [x] 2.2 `packages/extension`: the applied note says Act was turned off.
  Test beside the command's existing tests.
  One case in `commands.test.ts`, 163 passed.

## 3. Documents

- [x] 3.1 `HARNESS.md`, `supervisor`, Act: what turns it off.
  "An edit that lowers the level turns Act off".
- [x] 3.2 A changeset: core, webui, server, extension, patch.
  `.changeset/applying-a-configuration-turns-act-off.md`.

## 4. Checks

- [x] 4.1 `npm run typecheck && npm run lint`, and every test project, each
  on its own where the root run would exceed a background limit.
  Typecheck clean; lint 0 errors (3 warnings in lines this change did
  not touch); seven script tests pass. Core 2101, core-git-subprocess 67,
  cli 201, webui 713, server 122, extension 503 passed. After 1.3: core
  2102, core-git-subprocess 67, cli 201, webui 714, server 122, extension
  503 passed; typecheck and lint as before.
- [x] 4.2 `openspec validate applying-a-configuration-turns-act-off
  --strict`, and the merge gate with the worktree's absolute path as
  `--cwd`.
  Valid; the gate with `--cwd C:/Prog/.worktrees/OpenSpec-UI/applying-a-configuration-turns-act-off`
  reports only 4.3 open (Human-only).
- [x] 4.3 **Human-only**: in the owner's workspace, apply a named
  configuration to a change under Act, and change its autonomy level in
  its Harness Settings; both apply, and say Act is off.
  Closed by the owner on 2026-10-06 in an Extension Development Host on a
  copy of their workspace's changes: a named configuration applied and an
  autonomy level changed over Act, both saved and said Act is off; Act
  came back with its fallbacks; the hand-written contradiction opened and
  was put right on Save. Ticked on the owner's word in chat: everything
  works, close it.
