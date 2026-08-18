## 1. Extension: Repository Setup tree node

- [x] 1.1 `changes-tree.ts`: `RepoBootstrapRootTreeItem` (collapsible,
  contextValue `openspec-ui.repoBootstrapRoot`), `RepoBootstrapActionTreeItem`
  (leaf, contextValue `openspec-ui.repoBootstrapAction`, `.command` set
  to the existing command id), `getRepoBootstrapActions()` factory (fresh
  instances per call, matching how every other tree node is constructed
  here — no shared mutable state).
- [x] 1.2 `ChangesTreeProvider.getChildren`: pushes a
  `RepoBootstrapRootTreeItem` right after "OpenSpec Configuration" at
  root level; expanding it returns `getRepoBootstrapActions()`. No
  changes to `ArchiveTreeProvider` — it has its own independent root
  logic and was never touched.
- [x] 1.3 No `commands.ts` or `package.json` changes — the three commands
  already existed (`repo-bootstrap-snippets`) and are invoked unchanged
  via `TreeItem.command`, same mechanism already used by `EmptyTreeItem`'s
  "Initialize OpenSpec".
- [x] 1.4 `changes-tree.test.ts`: root children now include the
  Repository Setup node (index shifted, existing tests updated); new
  test expands it and asserts the three commands and contextValue. 6/6
  passing.

## 2. Verification, versioning, and smoke test

- [x] 2.1 `npm run typecheck && npm run lint && npm run test` passes for
  `packages/extension`. Re-run `npm run verify` after `git add`/commit of
  all new files.
- [x] 2.2 Bump `package.json` version (minor — new visible tree surface,
  no contract break) for `openspec-ui-vscode` (0.12.1 → 0.13.0). Added a
  `packages/extension/CHANGELOG.md` entry and updated the Features list
  in both READMEs.
- [x] 2.3 Manual smoke test: real Extension Host run via
  `npm run test:integration`, 6/6 passing (activation + command
  registration verified against a real VS Code instance). Tree logic
  itself (`ChangesTreeProvider.getChildren` returning the new node and
  its children) is covered by real unit-test assertions against the
  actual class, not a hand-simulated double — no desktop-UI automation
  tool is available in this environment to click-drive the tree, per the
  same limitation noted in prior changes this session
  (`tasks-tree-expand/smoke-test-notes.md`).
- [x] 2.4 `openspec change validate --strict repo-bootstrap-tree-ui`
  passes.
