## Standalone (real browser, real server, real filesystem)

Built and started the real server (`npm run build --workspace
@openspec-ui/server`, `npm run start --workspace @openspec-ui/server --
C:/Prog/OpenSpec-UI 4317 --allow-external-cwd`), opened it in the Browser
pane, pointed the workspace root at this repository itself, and drove the
Templates tab for real:

- **All 4 built-in templates listed correctly**: the seed
  `python-sqlalchemy-alembic` plus the three new ones
  (`flask-to-fastapi`, `flat-to-hexagonal-architecture`,
  `node-vitest-testing-baseline`), each with "Select"/"Customize", no
  "Delete" — confirms built-in items never offer delete, for real, not
  just by `when`-clause inspection.
- **The real leftover project template from earlier manual testing**
  (`openspec/templates/python-sqlalchemy-alembic/`, created via
  "Customize" before this change existed) showed a "Delete" button.
- **Confirmation gate is real, not decorative**: clicking "Delete" first
  triggered a native `window.confirm()`; the Browser tool's headless
  environment auto-dismisses native dialogs (returns `false`), and the
  directory was confirmed still present on disk afterward (`ls
  openspec/templates/` still showed it) — proving the code path actually
  respects a declined confirmation rather than deleting unconditionally.
- **Confirmed delete**: overrode `window.confirm` to return `true` (via
  the Browser tool's JS execution, not a code change) and clicked
  "Delete" again. The UI immediately showed "Deleted
  openspec/templates/python-sqlalchemy-alembic/." and the row disappeared
  from the table. Checked the actual filesystem afterward
  (`ls openspec/templates/`) — the directory is gone. This is the exact
  artifact the user asked about being unable to delete; it is now
  cleaned up for real, not just a mocked test.

## VS Code extension: unit-level only, not driven live

Could not drive the actual VS Code desktop UI from this environment (no
desktop-app automation tool available, only a web Browser). Coverage for
this side rests on: 27 passing `commands.test.ts` tests (including the
new delete command's modal-gate, success, decline, and unknown-id-warning
cases) plus the fact that the VS Code command calls the exact same
`deleteProjectTemplate()` core function just verified working end-to-end
above — same gap class noted in `agent-selection`'s own smoke-test-notes
("webview-level DOM interaction not separately driven").

## Original "pwsh" error report

Not reproduced or explained by this change — see the in-chat investigation:
`customizeTemplate`'s command handler and its core implementation are
confirmed pure `fs.mkdir`/`fs.writeFile`, with zero process/terminal/shell
involvement anywhere in the call path. Whatever the user saw was not
caused by this repository's own template-customize code.
