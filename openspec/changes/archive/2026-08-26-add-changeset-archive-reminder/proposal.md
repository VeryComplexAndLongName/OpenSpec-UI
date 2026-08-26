## Why

Second and final piece of the narrower Changesets-integration scope the
user confirmed on 2026-08-26 (template + conditional archive-time
reminder, not a full Changesets visual panel baked into the product
core — see `2026-08-26-add-adopt-changesets-template` for the template
half). The product should not assume every project uses Changesets, so
this is a best-effort, silent-by-default nudge: only a project that has
already adopted Changesets (`.changeset/config.json` present) and has
just archived a change without a pending changeset sees anything at
all.

## What Changes

- Add `checkChangesetReminder(cwd)` to `@openspec-ui/core`: reports
  whether `.changeset/config.json` exists and, if so, how many pending
  `.changeset/*.md` files exist (excluding `README.md`). Pure
  filesystem read, no prompting — the host decides what to do with the
  result, per `docs/adr/0001-shared-core-two-delivery-targets.md`.
- Wire it into the VS Code extension's `openspec-ui.archiveChange`
  command: after a successful archive, if Changesets is adopted and
  nothing is pending, show an information message with a "Run npx
  changeset" action that opens an integrated terminal and runs it.
  Never blocks or delays the archive result itself; any failure in the
  check is swallowed silently.
- Scoped to the VS Code extension only, not `webui`/standalone: the
  reminder's action (an integrated terminal) has no equivalent in a
  browser-hosted or message-bridge iframe context.

## Capabilities

### Modified Capabilities

- `vscode-extension`: adds a new Requirement for the archive-time
  Changesets reminder.

## Impact

- `packages/core/src/changeset-reminder.ts` (new)
- `packages/core/src/index.ts`
- `packages/extension/src/commands.ts`
- `openspec/specs/vscode-extension/spec.md`
