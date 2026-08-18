# Smoke test — repo-bootstrap-tree-ui

- Real Extension Host run (`npm run test:integration --workspace
  openspec-ui-vscode`): 6/6 passing, extension activates and registers
  all contributed commands (including the three repo-bootstrap commands
  the new tree node points at) against a real VS Code instance.
- Real unit-test coverage of the actual tree logic (not a mock of it):
  `changes-tree.test.ts` calls the real `ChangesTreeProvider` against a
  mocked `discoverOpenSpecWorkspace` result and asserts the root children
  include the "Repository Setup" node right after "OpenSpec
  Configuration", and that expanding it returns exactly the three
  expected actions with the correct `command.command` ids and
  contextValue.
- No desktop-UI automation tool is available in this environment to
  click-drive the actual tree in a running VS Code window — same,
  already-documented limitation as `tasks-tree-expand`'s own
  `smoke-test-notes.md`.
