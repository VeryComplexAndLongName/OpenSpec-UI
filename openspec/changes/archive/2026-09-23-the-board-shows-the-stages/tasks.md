ADR 0037 decision 7, the fourth change of its series, started with the
owner on 2026-09-22.

## 1. The board in the core

- [x] 1.1 `layoutChangesByStage`: a column per stage, every stage kept,
  each headed by its own word, no edges and no cycles. The stacking is
  shared with the arrangement by declared order.
- [x] 1.2 `ChangeStageSummary`, `stagesByName` and `describeStageLine` in
  the browser's leaf; `summariseStage` in the reader.

## 2. The Pipeline

- [x] 2.1 A toggle between the two arrangements, offered only where a host
  reads the stages, and kept with the zoom and the open cards.
- [x] 2.2 Each card says where its change is and who holds it, in either
  arrangement.
- [x] 2.3 The board's columns are headed by the stages; the picture draws
  no line there.

## 3. The hosts

- [x] 3.1 The standalone: `POST /api/change-stages` and its client.
- [x] 3.2 The editor: the `pipeline/stages` operation and its reader, read
  against the host's own workspace root.

## 4. Documentation

- [x] 4.1 `README.md`: the Pipeline's two arrangements, and the board in
  the `stages` section.

## 5. Checks

- [x] 5.1 Tests:
  - core, 3: the columns and their headings, no edges, the stacking and a
    change with no stage;
  - webui, 4: the toggle offered only with a reading, the headings and the
    dropped lines, the line on a card, and the arrangement kept;
  - the server, 2: the summary without visits, and a body with no `cwd`;
  - the extension, 1: the operation read against its own root;
  - the words on a card, 2: whoever holds it, and only the stage where
    nobody does. The board's first capture showed "nobody owns it, nobody
    implements it" filling the line, so the absence of a fact is no longer
    said.
- [x] 5.2 A browser test arranges the board, checks its headings and that
  no line is cut, and captures `docs/images/standalone/pipeline-board.png`.
  It first named a tab this shell does not have and timed out; the
  standalone's summary tab is "OpenSpec view summary".
- [x] 5.3 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped, exit code 0: cli 192, core 1835 and 53,
  extension 493, server 116, webui 655.
- [x] 5.4 The whole standalone browser suite: 29 of 29.
- [x] 5.5 The extension's integration suite: 19 passing.
- [x] 5.6 A changeset: core, the server, the web UI and the extension,
  minor.
- [x] 5.7 `openspec validate the-board-shows-the-stages --strict`: valid.
  The merge gate locally with `--base origin/main`: ok.
