## Why

Asked by a user on 2026-09-24 and agreed with the owner on 2026-09-25: a
team wants the board in its own columns - fewer of them, or named its own
way - mapped onto ours, "and nothing else changes".

ADR 0037 decision 11 deferred "boards with columns of the team's own
choosing" until people outside this repository asked. Somebody has.

## What Changes

- **ADR 0037 is amended** (2026-09-26): a team names its columns in
  `openspec/board.json`; a column is a view of stages, never a stage;
  every stage in exactly one column, in the stages' order, never split; a
  file that breaks a rule is refused whole.
- **Core**: `board-columns-facts.ts` parses and checks the file and says
  why a refused one is refused; `board-columns.ts` reads it;
  `layoutChangesByStage` takes the columns and stands each card where its
  stage is, heading a column by its title and drawing it as its first stage.
- **Both hosts** read it from their own root: `POST /api/board-columns`
  in the standalone, the bridge operation `pipeline/board-columns` in the
  editor, polled with the board's other readings.
- **The board** draws the team's columns where the file is good, a column
  per stage and a line saying why where it is refused, and a column per
  stage where there is no file.
- **`docs/how-to/name-the-board-columns.md`**: the file, and the rules.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `shared-ui` - a team names the board's columns.

## Impact

- `docs/adr/0037-a-team-works-through-git.md`: an amendment.
- `packages/core`: `board-columns-facts.ts`, `board-columns.ts` (new),
  `change-layout.ts`, with tests.
- `packages/server/src/rest.ts` and `server.ts`: one route.
- `packages/extension/src/webview/pipeline-panel.ts`: one reader.
- `packages/webui`: `PipelineView.tsx`, `change-stages-client.ts`,
  `bridge-request.ts`, both entry points.
- `docs/how-to/name-the-board-columns.md` (new).

## Explicitly out of scope

- **Dragging cards.** A card moves when its facts move it (decision 5).
- **Columns by other facts, transition policies, sync to an outside
  board.** Still deferred, as decision 11 says.
- **A settings view for the file.** It is five lines of JSON, committed and
  reviewed like the harness's own.
