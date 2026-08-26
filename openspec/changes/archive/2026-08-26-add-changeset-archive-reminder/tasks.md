## 1. Core: report Changesets adoption/pending state

- [x] 1.1 Add `checkChangesetReminder(cwd)` to
  `packages/core/src/changeset-reminder.ts`: `changesetsAdopted` (does
  `.changeset/config.json` exist), `pendingChangesetCount` (count of
  `.changeset/*.md` files, excluding `README.md`). Never throws.
- [x] 1.2 Export it from `packages/core/src/index.ts`.
- [x] 1.3 Add `packages/core/src/changeset-reminder.test.ts` covering:
  no `.changeset` directory, `.changeset` present without
  `config.json`, adopted with zero pending, adopted with pending
  changesets counted correctly (README.md excluded).

## 2. Extension: archive-time reminder

- [x] 2.1 Add `remindAboutPendingChangeset(workspaceRoot)` to
  `packages/extension/src/commands.ts`: calls `checkChangesetReminder`;
  if adopted and nothing pending, shows an information message with a
  "Run npx changeset" action that opens an integrated terminal
  (`vscode.window.createTerminal`) and sends `npx changeset`. Wrapped in
  try/catch with no surfaced error.
- [x] 2.2 Call it (fire-and-forget, not awaited) from
  `openspec-ui.archiveChange` after the archive succeeds and trees
  refresh, so it never delays or can fail the archive result itself.
- [x] 2.3 Add tests to `packages/extension/src/commands.test.ts`: the
  reminder appears and opens a terminal with `npx changeset` when
  adopted with nothing pending and the user picks the action; no
  terminal opens when a changeset is already pending.

## 3. Spec

- [x] 3.1 Add the `ADDED Requirements` delta to
  `openspec/specs/vscode-extension/spec.md` via
  `specs/vscode-extension/spec.md` in this change.

## 4. Verification

- [x] 4.1 `npm run typecheck` passes workspace-wide.
- [x] 4.2 `npm run lint` (including `lint:english`) passes workspace-wide.
- [x] 4.3 `npm run test` passes workspace-wide, including the new test
  files.
- [x] 4.4 Rebuild the VSIX (`npm run package --workspace
  openspec-ui-vscode`) and confirm it packages without error.
- [x] 4.5 Propose a changeset (`npx changeset`) for `openspec-ui-vscode`
  and `@openspec-ui/core` (both minor: new capability, no breaking
  change) instead of hand-editing `version`/`CHANGELOG.md`; apply it via
  `npx changeset version`.
- [x] 4.6 Run `openspec change validate --strict add-changeset-archive-reminder`.
