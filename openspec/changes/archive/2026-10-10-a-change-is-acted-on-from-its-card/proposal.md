## Why

The owner, on 2026-10-08: a change worked in its own worktree - since ADR
0043 the usual change - could have its own harness set nowhere but in the
file. The Changes tree drew such a change as one worked "elsewhere" and
gave it a shortened menu, and the Pipeline's card offered only Start, the
run's controls and Logs. Every control added to the tree and not to the
card, or the other way round, left one host or one kind of change poorer.
ADR 0044, accepted on 2026-10-08, decides that the card is where a change
is worked, that every action on a change comes from one list in core, and
that where a change lives decides where an action runs, never whether it
is offered. The owner asked for the actions as icons in the card's head,
grouped, coloured, dangerous ones confirmed, unavailable ones dimmed with
the reason, and for the tree and the card to offer the same - in both
hosts at once (2026-10-09).

## What Changes

- `change-actions.ts` in core: every action on a change - its command,
  title, group, icon, whether it writes and whether it is confirmed - and,
  from a change's facts, whether each can run now and why not.
- A change's card draws them as icons under its name, in two rows grouped
  and coloured by their verb's group, each with the icon its command has
  in VS Code (outlines read from the codicon font VS Code ships). A dimmed
  icon says why; a Danger action is confirmed on the card.
- An action runs where the change is worked: in the change's own worktree
  where it has one, in this checkout otherwise; refused only where that
  directory's records do not check out. This replaces the refusal of every
  write to a change worked elsewhere.
- VS Code: the Pipeline card runs the command a Changes row runs. The tree
  opens a change's menu with Show Actions... (also an icon on the row),
  then what runs, Inspect and Set Up as submenus, and the Danger actions
  last; a row of a change worked elsewhere offers everything. The
  change's harness panel reads and writes that worktree's `harness.json`.
- Standalone: one route, `/api/change-action`, runs each action where the
  change is worked and answers what to read, what was done, or the
  relations to pick from; a dialog over the Pipeline shows it, and asks
  first where an action asks. The harness routes read and write a change's
  file where it is worked.
- A test holds the tree's menus, titles and icons to core's list.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `shared-ui`: a card offers every action on its change; a board card of a
  change in its own worktree offers them, run there.
- `vscode-extension`: a row offers the actions its card does; a change
  worked elsewhere is acted on there, refused only where its directory's
  records do not check out.
- `standalone-app`: a card's actions run in the standalone app.
- `execution-core`: an action on a change runs where the change is worked.

## Impact

- `packages/core`: `change-actions.ts`, `change-action-root.ts`,
  `change-ownership.ts` (`workedElsewhere`, `refuseToWrite`),
  `pipeline-card.ts` (the actions' rows), `change-cost-report.ts`
  (`renderChangeCostReport`, moved from the extension), `change-graph.ts`
  (`changeAncestry`, moved from the extension), `action-vocabulary.ts`
  (the noun Actions).
- `packages/webui`: `CardActions.tsx`, `Codicon.tsx`,
  `codicons.generated.ts` and `scripts/extract-codicons.py`,
  `ChangeActionDialog.tsx`, `PipelineView.tsx`, `pipeline-entry.tsx`,
  `standalone-entry.tsx`, the card's styles.
- `packages/extension`: `commands.ts` (where each command acts, Show
  Actions...), `change-action-target.ts`, `pipeline-panel.ts`,
  `harness-settings-panel.ts`, the tree's icon, `package.json` menus.
- `packages/server`: `change-actions-rest.ts`, the harness routes.
- ADR 0045 amended: the noun Actions.
