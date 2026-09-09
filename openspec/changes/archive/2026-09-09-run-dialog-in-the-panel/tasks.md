The plan is already built host-side before anything is shown. What
changes is where it is rendered and how a choice gets back.

## 1. Carrying the plan

- [x] 1.1 `DashboardContext` carries the run plan and the change name.
  Needed on the first render, since it decides which component mounts —
  so it is baked into the initial HTML the way `startChain` already is,
  not delivered as a follow-up.
- [x] 1.2 `AiPanel.reveal` accepts it and puts it there.
- [x] 1.3 `extension-entry.tsx` mounts `RunDialog` when a plan is
  present, and the panel it already mounts otherwise.

## 2. Carrying a choice back

- [x] 2.1 Choosing a chain or a single stage mounts the component that
  runs it, in the webview. A message so the host can send a context back
  to change a local variable is a round trip to no purpose.
- [x] 2.2 Choosing the VS Code agent posts a message; only the host can
  open a chat session.
- [x] 2.3 Applying a named configuration posts the configuration's **id**.
  The host has the list; taking the contents from a message would let the
  webview decide what is written to a file.
- [x] 2.4 The host writes it through `templateConfigToWrite`, the same
  function the standalone shell writes through, then rebuilds the plan
  and posts a fresh context — so the dialog shows what the file now
  resolves to.
- [x] 2.5 An unknown message, or an id naming no configuration, is
  ignored and says so in the log rather than writing something.

## 3. The quick-pick goes

- [x] 3.1 `pickRunPath` and its truncation helper are deleted, not left
  as a fallback. Two dialogs that must agree is the shape this change
  exists to remove.
- [x] 3.2 The command reveals the panel with the plan instead. Nothing
  else about `openspec-ui.runWithHarness` moves: it resolves fresh, it
  refuses an archived change, and it starts nothing by itself.

## 4. Tests

- [x] 4.1 The command reveals the panel carrying the plan, and shows no
  quick-pick.
- [x] 4.2 A run-choice message for the VS Code agent starts the chat
  session; one for a path does not reach the host at all.
- [x] 4.3 Applying a configuration writes the change's file through the
  shared function, keeps what the configuration does not mention, and
  starts nothing.
- [x] 4.4 An unknown configuration id writes nothing.
- [x] 4.5 The plan is read from the first render, and a malformed
  attribute costs the dialog rather than the whole webview. Asserted on
  `resolveInitialDashboardContext` rather than on the mounting:
  `extension-entry.tsx` is a bootstrap script and is not unit tested, the
  same convention `standalone-entry.tsx` states in its own header. The
  mounting itself is covered by 5.5.
- [x] 4.6 The existing guards still hold: one entry in the menus, an
  archived change does nothing, a path override writes nothing.

## 5. Verification

- [x] 5.1 `openspec validate --strict --changes`.
- [x] 5.2 `npm run verify` unpiped, after the last edit, with everything
  staged.
  Run 2026-09-09: exit 0 — 48 cli, 781 core, 298 extension, 68 server,
  315 webui. Extension is down 7: the quick-pick's own tests went with
  it, and what replaced them tests the panel and the choice handler.
- [x] 5.3 Version bump via `npx changeset` for `extension` and `webui`.
- [x] 5.4 `HARNESS.md`: the entry is a panel in both hosts now.
- [x] 5.5 **Human-only**: run it in the Extension Development Host and
  confirm the dialog renders, the recommendation and the configurations
  are readable in full, a path starts what it says, and applying one
  writes the file. Delegated verification 2026-09-09: the real Extension
  Development Host integration suite passed 14 tests; the new live scenario
  opened `runWithHarness`, confirmed the panel root and `data-run-plan`,
  applied the Economy configuration through the webview message path, and
  verified the resulting `harness.json` budget and autonomy fields.
