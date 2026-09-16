Three reports from the owner on 2026-09-16, taken together because they are
one complaint: a screen that does not say what it is doing, or shows
something that is not the person's own work.

## 1. The server can answer for a change's diff

- [ ] 1.1 `handleChangeDiffRequest` in `packages/server/src/rest.ts` takes
  `{ cwd, changeName }`, runs `createGitWrapper({ cwd }).diff` over
  `openspec/changes/<changeName>`, and answers
  `{ diff, files, truncated }`. It refuses a `changeName` that is not an
  active change of that workspace, and says so.
- [ ] 1.2 The same handler caps the diff it returns at 200 KB, sets
  `truncated: true` when it cut, and never returns a partial line.
- [ ] 1.3 The same handler answers `{ error }` with a sentence when the
  workspace is not a git repository, rather than an empty diff.
- [ ] 1.4 `packages/server/src/server.ts` routes
  `POST /api/change-diff` to it, inside the existing token gate.
- [ ] 1.5 `packages/server/src/rest.test.ts` covers: a change with an edited
  `tasks.md`, a change with nothing uncommitted, a name that is not active,
  and a workspace that is not a git repository.

## 2. Diff Preview shows a real diff

- [ ] 2.1 `packages/webui/src/change-diff-client.ts` posts to
  `/api/change-diff` and returns the payload, the way
  `change-readiness-client.ts` does.
- [ ] 2.2 `packages/webui/src/components/ChangeDiff.tsx` takes
  `unified: string` instead of `before`/`after`, and renders each line
  coloured by its first character. It keeps `data-testid="change-diff"`.
- [ ] 2.3 `packages/webui/src/components/ChangeDiff.test.tsx` covers an added
  line, a removed line, a context line, and an empty diff.
- [ ] 2.4 The Diff Preview tab in `packages/webui/src/standalone-entry.tsx`
  offers the active changes by name, loads the chosen one's diff, and shows
  it. The two hard-coded sample strings go.
- [ ] 2.5 The same tab says "This change has nothing uncommitted." for an
  empty diff, and shows the route's own sentence for an error.
- [ ] 2.6 The same tab says when a diff was truncated, and names the size it
  was cut to.

## 3. A tab says it is working

- [ ] 3.1 `packages/webui/src/components/PanelStatus.tsx` renders
  `<p role="status" className="openspec-shell-note">` with the sentence it is
  given, and nothing when it is given none.
- [ ] 3.2 `packages/webui/src/components/PanelStatus.test.tsx` asserts the
  node exists while a sentence is given and disappears when it is not.
- [ ] 3.3 The Diff Preview, Processes and Recovery, OpenSpec view summary,
  Change Editor, Templates and Timeline tabs in
  `packages/webui/src/standalone-entry.tsx` render `PanelStatus` from the
  moment the panel mounts until the first reading settles or fails.
- [ ] 3.4 A test in `packages/webui/src/standalone-entry.test.tsx` asserts
  that opening a tab whose first reading has not returned shows one
  `role="status"` node, and that it goes when the reading settles.

## 4. The theme control is a switch

- [ ] 4.1 `packages/webui/src/components/ThemeToggle.tsx` renders
  `role="switch"` with `aria-checked`, the visible text "Dark theme"
  unchanged, and an `<Icon>` whose meaning follows the state.
- [ ] 4.2 `shellThemeCss` in `packages/webui/src/shell-ui.ts` draws the
  switch — track, knob and focus ring — from the shell's own tokens, with no
  literal colour.
- [ ] 4.3 `packages/webui/src/components/ThemeToggle.test.tsx` asserts the
  accessible name stays "Dark theme" in both states, that `aria-checked`
  follows the theme, and that the icon changes.

## 5. Checks

- [ ] 5.1 `openspec validate a-screen-says-what-it-is-doing --strict` passes.
- [ ] 5.2 `npm run verify` passes, run unpiped. Record each package's count.
  Do not pipe it: a pipe reports the pipe's exit code.
- [ ] 5.3 A changeset: `@openspec-ui/webui` minor, `@openspec-ui/server`
  minor, `openspec-ui-vscode` patch.
- [ ] 5.4 `lint:english` after `git add`, `lint:changesets`,
  `lint:test-budgets` and `lint:source-text` pass.
- [ ] 5.5 The whole standalone browser suite passes, including the axe WCAG AA
  run in both themes. Record the spec count.
- [ ] 5.6 **Delegated to claude-cli.** A live check against a real server in a
  real repository: open Diff Preview for a change with an edited file, for a
  change with nothing uncommitted, and switch to a tab whose reading is slow.
  Evidence to record: the first three lines of the diff shown, the sentence
  shown for the empty change, the text of the `role="status"` node caught
  while a reading was outstanding, and the screenshot paths.
- [ ] 5.7 **Human-only.** Whether the theme switch reads as a switch, and
  whether the waiting sentence answers the question a person actually has
  while looking at a slow tab.
