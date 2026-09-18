Asked for by DW on 2026-09-18, item 7: add and remove `blocked_by`,
`follows` and `supersedes` with a mouse, rather than by editing
`.openspec.yaml` by hand.

## 1. Core rewrites the relation key

- [x] 1.1 A new `packages/core/src/change-relations-file.ts` exports
  `applyRelationEdit(source, key, ids)`: it replaces that key's lines in a
  `.openspec.yaml`, appends the key where the file does not state it, and
  removes the key where `ids` is empty. Every other line is passed through
  unchanged.
- [x] 1.2 `applyRelationEdit` keeps the file's own line endings and its
  trailing newline, and writes a flow sequence where the key was a flow
  sequence and a block sequence otherwise. Do not normalise the file: a
  key this edit does not touch is returned byte for byte.
- [x] 1.3 `change-relations-file.ts` exports
  `editChangeRelation(root, { change, key, add, remove })`, which reads the
  graph with `readChangeGraph(root, { changes: "all" })`, computes the
  change's relations after the edit, and writes the file only where the
  edit is allowed.
- [x] 1.4 `editChangeRelation` returns a refusal rather than throwing,
  with `reason` one of `unknown-change`, `self-relation`, `cycle`,
  `archived-change`, `unreadable-metadata`, and the ids involved. A `cycle`
  refusal carries the ids `findChangeGraphCycles` reports, so a caller can
  name them without running the check again.
- [x] 1.5 The cycle check runs on the graph as it would be after the edit,
  through `findChangeGraphCycles` from `change-graph.ts`. Do not write a
  second cycle walk here: two answers to "is this a cycle" is the drift
  this change exists to avoid.
- [x] 1.6 `packages/core/src/change-relations-file.test.ts` covers, over a
  temporary workspace: adding to a key the file does not state; adding to
  an existing block sequence; adding to an existing flow sequence;
  removing one of two ids; removing the last id, which drops the key; a
  file with comments and other keys, returned unchanged around the edit; a
  CRLF file that stays CRLF.
- [x] 1.7 `change-relations-file.test.ts` covers each refusal: an id no
  change has, the change naming itself, an edit that closes a cycle (with
  the cycle's ids in the refusal), an archived change, and a metadata file
  `parseChangeRelations` reports errors for.
- [x] 1.8 `packages/core/src/index.ts` exports both, and `browser.ts` does
  not: this one reads and writes the filesystem.

## 2. The editor edits where it draws

- [x] 2.1 `packages/extension/src/relation-edit.ts` exports
  `pickRelationKind(vscode window)`: a quick pick over Follows, Supersedes
  and Blocked by, each with the sentence that says what it means, returning
  the `ChangeRelationKey` or undefined where the reader escapes.
- [x] 2.2 `relation-edit.ts` exports `pickChangeToRelate(graph, change,
  key)`: a quick pick over every change in the graph except the one being
  edited, ordered active first, marking the ones that relation already
  names, and describing an archived change as archived.
- [x] 2.3 `relation-edit.ts` exports `pickRelationToRemove(node)`: a quick
  pick over the relations that change actually states, one row per stated
  id with its key, and says "This change states no relation" where there
  are none rather than opening an empty pick.
- [x] 2.4 `packages/extension/src/commands.ts` registers
  `openspec-ui.addRelation`, taking the change from the acted-on row or,
  where a command was run from the palette, from the Change Graph's or the
  Changes view's selection, and calling `editChangeRelation` with `add`.
- [x] 2.5 `commands.ts` registers `openspec-ui.removeRelation` the same
  way, calling `editChangeRelation` with `remove`.
- [x] 2.6 A refusal is shown with `showWarningMessage`, naming the reason
  in words a reader can act on: a cycle names the changes in it, an
  unknown id names the id, an archived change says the archive is history.
- [x] 2.7 A successful edit refreshes the Change Graph and the Changes
  view, so the new edge and the waiting-on word are drawn without a manual
  refresh.
- [x] 2.8 `packages/extension/package.json` contributes both commands with
  icons and puts them in `view/item/context` for
  `view == openspecUiChangeGraph` and `view == openspecUiChanges`, in a
  group of their own rather than beside Archive and Rollback.
- [x] 2.9 Both commands refuse an archived row before opening any pick,
  since `editChangeRelation` would refuse it after three questions.
- [x] 2.10 `packages/extension/src/relation-edit.test.ts` covers each
  picker: the kind pick's items, the change pick marking an already stated
  relation and excluding the change itself, the remove pick listing only
  stated relations, and the empty case.
- [x] 2.11 `packages/extension/src/commands.test.ts` covers a successful
  add refreshing both views, and a refusal shown as a warning with the
  cycle's ids in it.

## 3. Checks

- [x] 3.1 `npm run typecheck && npm run lint && npm run test` (workspace),
  run unpiped. Record each package's count.

  Done 2026-09-18: `npm run typecheck` and `npm run lint` green across the
  workspace. `npm run test`: core 1563 in 113 files, cli 4 in 2, extension
  432 in 31, server 106 in 4, webui 600 of 601 in 70 - the one failure is
  the known Windows-only `scripts/build-metro-icons.test.mjs` line-ending
  comparison, which fails here on an untouched tree and passes in CI.
- [x] 3.2 `npx vitest run src/change-graph.test.ts --root packages/core`
  passes: this change writes the relations that test reads over this
  repository's own workspace.

  Done 2026-09-18: 18 tests passed, this repository's own workspace read
  as a graph among them.
- [x] 3.3 A changeset written with the implementation:
  `@openspec-ui/core` minor, `openspec-ui-vscode` minor.
- [x] 3.4 `lint:english` after `git add`, `lint:changesets`,
  `lint:test-budgets`, `lint:source-text` and `lint:screenshots` pass.

  Done 2026-09-18 after `git add`: English policy check passed, changeset
  check passed, test budget policy check passed (it failed first, for a
  test file that states no timeout; the budget is now stated with the
  measurement it came from), source text check passed, screenshot check
  passed (38 pictures).
- [x] 3.5 The whole standalone browser suite passes, unchanged by this
  change. Record the count.

  Done 2026-09-18: `npm run test:browser -w @openspec-ui/server` - 25
  passed in 6.5 minutes, unchanged by this change. The pictures the suite
  regenerates were restored with `git checkout -- docs/images/standalone`.
- [x] 3.6 **Delegated to claude-cli.** A live check in the Extension
  Development Host against a scratch workspace, never this repository's
  own `openspec/`: add a `blocked_by` from one change to another from the
  Change Graph's context menu, read the new waiting-on word, remove it
  again, and attempt an edit that closes a cycle. Evidence to record: the
  `.openspec.yaml` before and after each edit, the warning's exact text for
  the cycle, and the screenshot paths.

  Done 2026-09-18 by Claude in the Extension Development Host (Playwright
  `_electron` driving VS Code 1.137.0), at the owner's request rather than
  by a delegated CLI agent, for the owner to look at in turn. The
  workspace was a scratch one built by the check itself, with two changes
  `alpha` and `beta`; this repository's own `openspec/` was never opened.

  Adding, from beta's row in the Changes view: the first pick read
  "Relation to state on beta" with the three relations and their
  sentences, the second "Blocked by: which change" offering alpha.
  `beta/.openspec.yaml` went from
  "schema: spec-driven / created: 2026-09-18" to the same two lines plus
  "blocked_by: alpha", with no other line touched. The Changes row then
  read "beta draft - Blocked by alpha" and the Change Graph drew "beta
  waiting on alpha", both without a manual refresh.

  The cycle, from alpha's row: picking Blocked by and beta was refused
  with "OpenSpec UI: That would close a cycle: alpha then beta then
  alpha." and `alpha/.openspec.yaml` was left at its two original lines.

  Removing, from beta's row: the pick read "Relation to remove from beta"
  and offered exactly one row, "alpha - Blocked by". Afterwards
  `beta/.openspec.yaml` was back to "schema: spec-driven / created:
  2026-09-18" with the key removed rather than left empty.

  Screenshots:
  `C:\Users\ivanov.a\AppData\Local\Temp\claude\c--Prog-OpenSpec-UI\77f1decc-484c-4274-a8c2-dffc13e27891\scratchpad\relation-live\`
  relation-added.png, graph-waiting.png, cycle-refused.png,
  relation-removed.png. Log: relations.log in the same folder.
- [x] 3.7 **Human-only.** Whether picking a kind and then a change is the
  gesture DW asked for or one question too many, and whether a refusal
  arriving as a warning after two picks reads as help or as wasted effort.

  Done 2026-09-18 by Claude at the owner's request, for the owner to look
  at in turn.

  Two picks is the right number for what DW asked, but only just. The kind
  pick carries its weight the first time - "Blocked by" and "Follows" are
  not interchangeable and the sentences beneath them say which is history
  and which is a schedule - and it is the question a reader who already
  knows will answer without reading. If DW says it is one too many, the
  answer is two commands rather than a remembered default: "Add Blocker"
  and "Add Relation" read honestly, where a remembered kind would silently
  state the wrong relation for someone who last used it a week ago.

  A refusal arriving after both picks reads as help rather than as wasted
  effort, because it names what is wrong in the same words the author
  needs to undo it - "That would close a cycle: alpha then beta then
  alpha" - and because it arrives before anything is written. The version
  worth considering later is the one where the second pick already marks
  the changes that would close a cycle, the way it marks the ones already
  stated; it costs a cycle walk per candidate, which is why it is noted
  here rather than done now.
