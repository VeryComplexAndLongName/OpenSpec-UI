Blocked by `change-graph-in-core` only for sequencing — that change
touches the same root scripts, and doing both at once would make either
one hard to revert.

The temptation here is a command that runs `npm run lint`. Every task
below is written so the extension asks the workspace what it has instead.

## 1. Resolving what to run

- [ ] 1.1 A setting naming the script for each check the extension can
  run. Explicit and per-workspace; it wins over any convention.
- [ ] 1.2 Unset, prefer `osui-<name>` when the workspace's
  `package.json` declares it. That is the point of the prefix: a
  repository offering the editor a faster subset than its own `lint` has
  no way to say so today.
- [ ] 1.3 Otherwise fall back to `<name>`.
- [ ] 1.4 Declared nowhere: offer no command for that check. Not a
  command that fails — an absent one. A workspace that never asked for
  this should see nothing new.
- [ ] 1.5 Resolve against the open workspace, not against this
  repository. Test it in a workspace that is not this one, because every
  assumption here is invisible while developing in the repository whose
  scripts happen to match.

## 2. Running them

- [ ] 2.1 Run through `runMechanicalCheck` in
  `packages/core/src/mechanical-checks.ts`. It already runs `lint`,
  `typecheck` and `test` and already reports which command, which path,
  what came back. A second runner would drift from it.
- [ ] 2.2 Report through the same surface a stage's checks report to, so
  a check run by hand and one run by a stage read the same.
- [ ] 2.3 A failure states the command and its output. "Check failed" is
  the message this repository's own harness rejected.
- [ ] 2.4 Nothing runs on save, on open, or on a timer. A check that
  costs minutes is asked for.

## 3. Menus

- [ ] 3.1 Add the checks to the container, alongside the existing
  `Open Process Dashboard` and `Refresh` in `view/title`.
- [ ] 3.2 Audit the 35 existing commands for ones reachable only through
  the palette that belong in a menu, and add those. Do not add all of
  them — a menu of 35 entries is a palette with worse search.
- [ ] 3.3 Leave VS Code's own NPM Scripts view and `Tasks: Run Task`
  alone. Only what is specific to OpenSpec belongs here.

## 4. Verification

- [ ] 4.1 `openspec change validate --strict openspec-commands-in-vscode`.
- [ ] 4.2 Unit tests over the resolution rules — setting wins, prefix
  next, bare name next, nothing offered when nothing is declared.
- [ ] 4.3 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
- [ ] 4.4 Version bump via `npx changeset` for `openspec-ui-vscode`.
- [ ] 4.5 **Human-only**: run a check from the menu in this repository
  and confirm it reports the command and its output; then open a
  workspace that declares none of these scripts and confirm the commands
  are absent rather than failing.
