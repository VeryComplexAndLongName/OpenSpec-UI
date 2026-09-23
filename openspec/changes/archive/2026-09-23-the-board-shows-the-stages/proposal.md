## Why

ADR 0037 decision 7, the fourth change of its series. Every change now has
a stage and keeps every stay in it (`a-change-knows-its-stage`), but only
the CLI can say so. The owner asked for a board by the stages of a change,
from planning to the merge and the archive, in the product itself.

The Pipeline already draws every change as a card, in columns by what each
change waits for. Its own comment said the repository states an order, not
stages, and a heading that invented stage names would be inventing
something. The stages are no longer invented: they are derived from dated
facts.

## What Changes

- **A second arrangement of the same cards.** `layoutChangesByStage` puts
  each card in the column of the stage it is in. Every stage keeps a
  column, even an empty one, so the board does not change shape as
  changes move. There are no edges on the board: a stage says where a
  change is, not what it waits for.
- **The Pipeline offers both.** A toggle, **By step** and **By stage**,
  kept with the zoom and the open cards for the next visit. It is offered
  only where a host reads the stages.
- **Every card says where its change is** and who holds it, in either
  arrangement: "In review for 4h, ada owns it, bob implements it", in
  core's words.
- **Both hosts read it.** The standalone gets `POST /api/change-stages`;
  the editor's panel gets the `pipeline/stages` operation. Both answer a
  summary per change - stage, since when, roles and the time in each
  stage - and leave the visits behind, which only a change's own history
  view draws.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `shared-ui` - the Pipeline arranges by stage, and a card says where its
  change is.
- `standalone-app` - the reading behind the board.
- `vscode-extension` - the same, over the panel's request channel.

## Impact

- `packages/core/src/change-layout.ts` (`layoutChangesByStage`),
  `change-stage-facts.ts` (`ChangeStageSummary`, `stagesByName`,
  `describeStageLine`), `change-stages.ts` (`summariseStage`).
- `packages/webui/src/components/PipelineView.tsx`,
  `change-stages-client.ts` (new), `pipeline-entry.tsx`,
  `bridge-request.ts`, `shell-ui.ts`.
- `packages/server/src/rest.ts`, `server.ts`.
- `packages/extension/src/webview/pipeline-panel.ts`.
- Tests in core, webui, the server, the extension, and a browser test that
  captures `docs/images/standalone/pipeline-board.png`.
- `README.md`.
- A changeset: core, the server, the extension and the web UI, minor.

## Explicitly out of scope

- **Moving a card by hand.** A stage is derived; a card is moved by the
  work, or sent back with a reason through the history
  (`openspec-ui-cli send-back`). A drag that declared a stage would be a
  second truth.
- **Reports.** Time in each stage is on the card and in the CLI; the
  reports ADR 0037 mentions come with the paid plugin, if they come.
- **Archived changes on the board.** The Archived column is there and
  holds what this reading holds: the active changes whose archive has
  landed but whose directory this checkout still has.
