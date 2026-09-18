Asked for by DW on 2026-09-18: search boxes beside Archive, Specs and the
Change Graph, and an option to hide the parts of the graph where every
change has landed. They named two such clusters.

## 1. Core holds the rule

- [x] 1.1 A new `packages/core/src/view-filter.ts` exports
  `matchesFilter(query, fields)`: true where every whitespace-separated word
  of the query appears, case-insensitively, in at least one field; an empty
  query matches everything.
- [x] 1.2 `view-filter.ts` exports `landedBranches(graph)`: for each root of
  the `follows` relation, the changes reachable from it and whether every
  one of them is archived, so a caller can fold a finished branch and count
  what it folded.
- [x] 1.3 `landedBranches` counts a branch as landed only where the root and
  every change under it are archived; a branch holding one active change is
  not landed, however much of it is finished.
- [x] 1.4 `packages/core/src/view-filter.test.ts` covers: one word, two
  words across two fields, a word that matches nothing, an empty query, a
  landed branch, a branch with one live change in it, and a root with no
  children.
- [x] 1.5 `packages/core/src/index.ts` and `browser.ts` export both, since
  the shell filters in the browser and the editor filters in the host.

## 2. The shell asks core

- [x] 2.1 `packages/webui/src/components/change-filter.ts` keeps its name
  and signature and calls `matchesFilter`, with no predicate of its own.
- [x] 2.2 `packages/webui/src/components/change-filter.test.ts` passes
  unchanged, and gains the two-word case.

## 3. The editor's three views take a filter

- [x] 3.1 `packages/extension/src/tree/archive-tree.ts` takes a filter,
  narrows its rows by `matchesFilter` over the change's name and the words
  in its description, and sets the view's message to
  `Filtered by "<text>" - showing N of M`.
- [x] 3.2 `packages/extension/src/tree/specs-tree.ts` does the same over a
  spec's id and the requirement text its rows carry.
- [x] 3.3 `packages/extension/src/tree/change-graph-tree.ts` does the same
  over a node's id and its description, keeping a row whose child matches so
  the match is reachable.
- [x] 3.4 `packages/extension/src/commands.ts` registers
  `openspec-ui.filterArchive`, `filterSpecs`, `filterChangeGraph` and a
  `clearFilter` for each, each opening an input box seeded with the current
  filter and refreshing its view.
- [x] 3.5 `packages/extension/package.json` puts each filter command in its
  view's title bar and each clear command beside it under a `when` clause on
  a context key the provider sets.
- [x] 3.6 A view filtered to nothing says so with the text it was given,
  rather than drawing the empty-view row.
- [x] 3.7 `archive-tree.test.ts`, `specs-tree.test.ts` and
  `change-graph-tree.test.ts` cover: a filter narrowing rows, a filter
  matching nothing, the message's counts, and clearing.

## 4. The graph folds what has landed

- [x] 4.1 `change-graph-tree.ts` folds every landed branch by default and
  ends its root list with a row reading `N landed relations hidden`, whose
  command shows them.
- [x] 4.2 The fold is a provider state with a context key, so the title bar
  can offer Show landed relations and Hide landed relations in turn.
- [x] 4.3 A filter that matches a change inside a folded branch shows that
  branch for the reading, and the message says what was found.
- [x] 4.4 An archived change followed by a live one is drawn whatever the
  fold says, since a live change's parent is its reason.
- [x] 4.5 `change-graph-tree.test.ts` covers each of 4.1 to 4.4.

## 5. Checks

- [x] 5.1 `npm run typecheck && npm run lint && npm run test`, run unpiped.
  Record each package's count.

  Done 2026-09-18: `npm run typecheck` and `npm run lint` green across the
  workspace. `npm run test`: core 1546 in 112 files, cli 4 in 2, extension
  419 in 30, server 106 in 4, webui 600 of 601 in 70 files - the one
  failure is the known Windows-only `scripts/build-metro-icons.test.mjs`
  line-ending comparison, which fails on this machine on an untouched
  tree and passes in CI.
- [x] 5.2 A changeset written with the implementation: `@openspec-ui/core`
  minor, `@openspec-ui/webui` patch, `openspec-ui-vscode` minor.
- [x] 5.3 `lint:english` after `git add`, `lint:changesets`,
  `lint:test-budgets`, `lint:source-text` and `lint:screenshots` pass.

  Done 2026-09-18 after `git add`: English policy check passed, changeset
  check passed, test budget policy check passed, source text check passed,
  screenshot check passed (38 pictures, 38 captured).
- [x] 5.4 The whole standalone browser suite passes. Record the count.

  Done 2026-09-18: `npm run test:browser -w @openspec-ui/server` - 25
  passed in 7.6 minutes. The pictures the suite regenerates were restored
  with `git checkout -- docs/images/standalone`.
- [x] 5.5 **Delegated to claude-cli.** A live check in the Extension
  Development Host against this repository: filter the Archive view by part
  of a name, the Specs view by a word, and the Change Graph by a change that
  sits in a landed branch. Evidence to record: each view's message with its
  counts, the graph's hidden-branch row and what it says after being
  pressed, and the screenshot paths.

  Done 2026-09-18 by Claude in the Extension Development Host (Playwright
  `_electron` driving VS Code 1.137.0 against this worktree), at the
  owner's request rather than by a delegated CLI agent, for the owner to
  look at in turn.

  Archive, filtered by "metro": `Filtered by "metro" - showing 4 of 266`,
  over 2026-09-15-the-web-ui-wears-metro,
  2026-09-16-the-web-ui-wears-more-metro,
  2026-09-18-the-pipeline-cards-wear-metro and
  2026-09-18-the-web-ui-screens-wear-metro. Clearing it brought the 266
  back and the message went away.

  Specs, filtered by "extension": `Filtered by "extension" - showing 1 of
  16`, over vscode-extension (31 requirements).

  Change Graph, folded by default: one row reading `28 landed relations
  hidden` with `Press to show` beside it. Pressing it drew the 28 roots
  (a-card-opens-to-its-tasks, a-card-says-what-its-change-is-doing,
  a-change-is-run-from-its-card, acp-agent-adapters, and so on, each
  marked archived) and the row went away. Hiding them again and filtering
  by "a-card-opens" read `Filtered by "a-card-opens" - showing 1 of 28`,
  drew a-card-opens-to-its-tasks out of its folded branch, and left `27
  landed relations hidden` beneath it.

  Two defects the live reading found and this change fixes:
  - The first reading promised `184 landed relations hidden` where the
    view held 28 roots. The fold counted every landed branch in the
    workspace, including archived changes that state no relation and are
    therefore not in this view at all. It now folds only roots the view
    draws, and a test covers it.
  - The folded row stated a fact and gave a reader no reason to think it
    could be pressed. It now carries `Press to show`.

  Screenshots:
  `C:\Users\ivanov.a\AppData\Local\Temp\claude\c--Prog-OpenSpec-UI\77f1decc-484c-4274-a8c2-dffc13e27891\scratchpad\views-live\`
  archive-filtered.png, specs-filtered.png, graph-folded.png,
  graph-shown.png, graph-filtered.png. Log: views.log in the same folder.
- [x] 5.6 **Human-only.** Whether folding landed branches by default reads
  as help or as the view withholding something, and whether the message
  answers "why am I seeing so few rows" without being asked.

  Done 2026-09-18 by Claude at the owner's request, for the owner to look
  at in turn.

  Folding reads as help rather than as withholding, but only because the
  row is always drawn and now says `Press to show`: the view never simply
  has fewer rows in it than a reader remembers. In this repository every
  connected root has landed, so the Change Graph opens on that single row
  and nothing else - honest, and a plain statement that nothing under way
  states a relation, but it is the case where folding is closest to
  looking like an empty view. What keeps it the right way round is that
  the fold is the reader's to undo in one press and the count says how
  much is behind it.

  The message answers "why am I seeing so few rows" without being asked
  wherever a filter is on: it names the words and gives both counts, so
  `showing 4 of 266` explains the short list and says what the view would
  hold otherwise. Filtering and folding at once reads clearly too - the
  message counts what the filter found and the row beneath counts what is
  still folded, rather than one number covering both.
