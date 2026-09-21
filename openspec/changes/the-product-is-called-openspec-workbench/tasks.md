Asked by the owner on 2026-09-21: the standalone still says "OpenSpec UI";
it should say "OpenSpec Workbench", and the extension should be checked
too.

## 1. The name

- [x] 1.1 Every "OpenSpec UI" a person reads becomes "OpenSpec Workbench":
  command titles in `packages/extension/package.json`, messages, panel and
  page titles, the standalone's headline and `<title>`, the server's
  startup line, the schema titles, and the docs that quote them. 280
  occurrences in 45 files, plus one split across a line in
  `docs/how-to/use-your-own-agent-definition.md`, and the sprint report's
  progress title, which landed with #659 after this branch was cut.
- [x] 1.2 No identifier changes: ids, settings, package names, the CLI and
  `.openspec-ui/` keep theirs.
- [x] 1.3 Left as they are: `CHANGELOG.md` files, `docs/adr/`,
  `docs/articles/`, the archive, and `packages/cli/README.md`'s name for
  the repository.

## 2. Pictures

- [x] 2.1 The standalone's pictures taken again by the browser suite: 20
  files under `docs/images/standalone/`; the app bar reads "OpenSpec
  Workbench".
- [x] 2.2 The editor's pictures taken again by `test:pictures`, 17 of 17:
  the window title, the panel tab and the view container read "OpenSpec
  Workbench".

## 3. Checks

- [x] 3.1 `npm run typecheck && npm run lint && npm run test` at the
  root, after `git add`, run unpiped. typecheck and lint pass. Tests:
  cli 175, core 1734 and 20, extension 474, server 112, webui 637 of
  638. The one failure is `packages/webui/scripts/build-metro-icons.test.mjs`,
  which fails on Windows for its line endings and fails the same way on
  untouched `main`.
- [x] 3.2 The whole standalone browser suite passes: 26 of 26.
- [x] 3.3 The extension's integration suite passes: 18 passing.
- [x] 3.4 A changeset: core, webui, server and the extension change.
- [x] 3.5 `openspec validate the-product-is-called-openspec-workbench --strict`.
- [x] 3.6 **Human-only.** The owner's editor, on a build with this, shows
  "OpenSpec Workbench" in the Command Palette and the panels. **Done by
  Claude on 2026-09-21 at the owner's request, for the owner to look at in
  turn:** in an Extension Development Host built from this branch, the
  pictures of 2.2 show the new name in the window title, the Harness
  Settings panel's tab and the view container. The owner's installed
  build shows it from the release that carries this change.
