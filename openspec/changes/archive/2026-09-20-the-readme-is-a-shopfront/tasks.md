Asked for by the article agent through the owner on 2026-09-20: a README
that answers what it is, what it looks like and how to install it, in
thirty seconds, under the product name OpenSpec Workbench.

## 1. The first screen answers the three questions

- [x] 1.1 `README.md` opens with the name **OpenSpec Workbench** and one
  sentence: it runs and supervises coding agents on OpenSpec changes.
- [x] 1.2 A picture follows immediately, from a capture that exists today.
- [x] 1.3 Installation follows the picture: the Marketplace link and
  `code --install-extension openspec-ui.openspec-ui-vscode` for the
  editor, and the commands that actually work for the standalone app.

  Three, not the two the campaign asked for: `npm run start` on the server
  does not build, and the bundle it serves is not committed. A README that
  said two would be wrong in exactly the way this change exists to fix.
- [x] 1.4 One line says the repository, the npm packages, the CLI, the
  extension id and the domain are still called OpenSpec-UI, so a reader
  can find them.

## 2. The installation path is true

- [x] 2.1 The `.vsix` from a GitHub Release is described as the offline
  path, below the Marketplace one, rather than as the way in.
- [x] 2.2 Nothing in the file tells a reader to install from a Release
  first.

## 3. It says how it differs from the other viewers

- [x] 3.1 A section beside `Why not just openspec view` and `How this
  differs from BMAD` describes `ToruAI/openspec-ui`, `jixoai/openspecui`
  and `coderj001/openspec-ui-vscode` in their own published words, each
  linked, with the date those words were read.

  Read 2026-09-20. Each is quoted from its own README: a kanban board over
  every OpenSpec repository, read-only and "never writes to your specs"; a
  web interface with live mode and static export; a visual workspace for
  browsing and reviewing changes in VS Code with line-level comments.
- [x] 3.2 The difference is stated as a fact about this product - it
  starts a run, says what the run is doing, and stops it on request - and
  not as a criticism of theirs.
- [x] 3.3 Where another project offers something this one does not, that
  is said too.

## 4. Checks

- [x] 4.1 `npm run lint` after `git add`, with `lint:english` among it.
- [x] 4.2 Every link in the new text resolves, and every picture it names
  exists.

  Checked 2026-09-20: `docs/adr/`, `docs/how-to/`,
  `docs/how-to/stop-a-run.md`, the linked article, and both pictures are
  in the tree. The three comparison links are the projects' own GitHub
  pages, read the same day.
- [x] 4.3 No changeset: nothing under `packages/` changes.
- [ ] 4.4 **Human-only.** Whether the first screen answers the three
  questions, and whether the comparison reads as fair to somebody who
  maintains one of those projects.
