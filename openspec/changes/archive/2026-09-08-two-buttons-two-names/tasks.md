Reported live by the owner on 2026-09-08: two buttons reading "Run with
Agentic Harness", one above the other, doing different things.

## 1. The name

- [x] 1.1 The chain panel's button becomes "Start chain" — what it does,
  and what its own `data-testid` has always called it.
- [x] 1.2 The dispatch entry keeps its name. It matches the VS Code
  command people already know, and it is the entry point; the inner
  button is the one whose name was inherited rather than chosen.
- [x] 1.3 Both hosts get it: the panel is shared, so this is one edit,
  not two.

## 2. Tests

- [x] 2.1 A test asserting the panel's button reads "Start chain",
  by its accessible name rather than its test id — the test id was
  already right while the label was wrong, so asserting on it would have
  passed throughout.

## 3. Verification

- [x] 3.1 `openspec change validate --strict two-buttons-two-names`.
  Run 2026-09-08: valid.
- [x] 3.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
  Run 2026-09-08 on an idle machine: typecheck clean; lint clean apart
  from one warning that predates this change (`killTimer` unused in
  `packages/core/src/agents/shared.ts:210`); tests 48 cli, 689 core,
  285 extension, 62 server, 277 webui — webui up 1.
- [x] 3.3 Version bump via `npx changeset` for `webui`.
  Done: `.changeset/two-buttons-two-names.md`.
- [x] 3.4 **Human-only**: open the standalone UI with a change whose
  configuration opens the chain panel, and confirm the two buttons now
  read differently.
  Confirmed live in the standalone UI on 2026-09-08 with an autonomous
  disposable change: the dispatch button read `Run with Agentic Harness`
  and the inner chain button read `Start chain` at the same time.
