## Why

The repository's own checks — `lint`, `typecheck`, `test` — are run from
a terminal, while the work they check is done in a tree beside them. The
extension already contributes 35 commands; none of them runs a check.

The machinery is not missing. `packages/core/src/mechanical-checks.ts`
already runs exactly these as declared checks, with the result the
harness needs: which command, which path, what came back. What is missing
is a way to ask for one without a stage running.

Hard-coding `npm run lint` would be the wrong way to add it. This
extension runs in other people's workspaces, where that script may not
exist, or may mean something else, or may take twenty minutes. The
extension must ask the workspace what it has rather than assume.

A prefix convention answers a different and better question than
uniqueness. A repository that wants the editor to run a *faster subset*
than its own `lint` has no way to say so today. Letting it expose
`osui-lint` gives it one, without forcing anyone to rename anything.

## What Changes

- Commands for the checks `mechanical-checks.ts` already knows, run
  against the open workspace and reported where the run is visible.
- A setting naming which scripts those are. Unset, the extension prefers
  `osui-<name>` when the workspace declares it and falls back to
  `<name>`; a workspace declaring neither is offered nothing rather than
  a command that fails.
- Menu entries for the OpenSpec operations that already exist as
  commands but are reachable only through the palette.

## Capabilities

### Modified Capabilities

- `vscode-extension`: a repository's own checks can be run from the
  editor, on terms the repository states rather than terms the extension
  assumes.

## Impact

- Commands, menus and one setting in `packages/extension`, over the
  existing `mechanical-checks.ts`. Changeset needed for
  `openspec-ui-vscode`.

## Explicitly out of scope

- **Reimplementing VS Code's npm-script surfaces.** It already has an
  NPM Scripts view and `Tasks: Run Task`. Duplicating them wholesale
  would add a maintenance surface and no capability; only what is
  specific to OpenSpec belongs here.
- **New check kinds.** `mechanical-checks.ts` owns which checks exist.
  This change surfaces them; extending the set is that module's business.
- **Running checks automatically.** Nothing here runs on save, on open,
  or on a timer. A check that costs minutes must be asked for.
