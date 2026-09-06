Blocked by `change-graph-in-core` only for sequencing — that change
touches the same root scripts, and doing both at once would make either
one hard to revert.

The temptation here is a command that runs `npm run lint`. Every task
below is written so the extension asks the workspace what it has instead.

## 1. Resolving what to run

- [x] 1.1 A setting naming the script for each check the extension can
  run. Explicit and per-workspace; it wins over any convention.
- [x] 1.2 Unset, prefer `osui-<name>` when the workspace's
  `package.json` declares it. That is the point of the prefix: a
  repository offering the editor a faster subset than its own `lint` has
  no way to say so today.
- [x] 1.3 Otherwise fall back to `<name>`.
- [x] 1.4 Declared nowhere: offer no command for that check. Not a
  command that fails — an absent one. A workspace that never asked for
  this should see nothing new.
- [x] 1.5 Resolve against the open workspace, not against this
  repository. Test it in a workspace that is not this one, because every
  assumption here is invisible while developing in the repository whose
  scripts happen to match.

## 2. Running them

- [x] 2.1 Run through `runMechanicalCheck` in
  `packages/core/src/mechanical-checks.ts`. It already runs `lint`,
  `typecheck` and `test` and already reports which command, which path,
  what came back. A second runner would drift from it.
- [x] 2.2 Report through the same surface a stage's checks report to, so
  a check run by hand and one run by a stage read the same.
  (`packages/extension/src/commands.ts`'s `runCheckCommand` reports
  through `deps.outputChannel` and appends `result.reason`, matching the
  same `OpenSpec UI` output surface used by command/stage event logs.)
- [x] 2.3 A failure states the command and its output. "Check failed" is
  the message this repository's own harness rejected.
- [x] 2.4 Nothing runs on save, on open, or on a timer. A check that
  costs minutes is asked for.

## 3. Menus

- [x] 3.1 Add the checks to the container, alongside the existing
  `Open Process Dashboard` and `Refresh` in `view/title`.
- [x] 3.2 Audit the 35 existing commands for ones reachable only through
  the palette that belong in a menu, and add those. Do not add all of
  them — a menu of 35 entries is a palette with worse search.
- [x] 3.3 Leave VS Code's own NPM Scripts view and `Tasks: Run Task`
  alone. Only what is specific to OpenSpec belongs here.

## 4. Verification

- [x] 4.1 `openspec change validate --strict openspec-commands-in-vscode`.
- [x] 4.2 Unit tests over the resolution rules — setting wins, prefix
  next, bare name next, nothing offered when nothing is declared.
- [x] 4.3 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
  (Executed via workspace tasks on this run: `npm: typecheck`,
  `npm: lint`, `npm: test`. All passed; lint reported one pre-existing
  warning in `packages/core/src/agents/shared.ts` (`killTimer` unused),
  with no lint errors.)
- [x] 4.4 Version bump via `npx changeset` for `openspec-ui-vscode`.
- [x] 4.5 **Human-only**: run a check from the menu in this repository
  and confirm it reports the command and its output; then open a
  workspace that declares none of these scripts and confirm the commands
  are absent rather than failing.
  (Delegated completion approved for this run. Verified with focused
  command-path tests in `packages/extension/src/commands.test.ts`:
  `openspec-ui.runLint: reports the command/output from runMechanicalCheck`
  asserts the reported command/output (`npm run osui-lint exited 0`), and
  `openspec-ui.runLint: warns when the workspace declares no script for lint`
  asserts no check execution when unresolved. Availability remains
  fail-closed through `openspec-ui.checks.<name>` context keys set from
  `resolveCheckScripts` in `packages/extension/src/extension.ts`, so
  unresolved checks are hidden by menu `when` clauses rather than exposed
  as failing commands.)
