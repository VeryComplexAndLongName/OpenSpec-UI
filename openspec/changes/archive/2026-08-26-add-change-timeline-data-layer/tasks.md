## 1. Core: blame-based dates

- [x] 1.1 Add `packages/core/src/change-timeline.ts` with
  `blameLineDates(cwd, relativeFilePath): Promise<Map<number, string> | undefined>`
  parsing `git blame --line-porcelain` output (via
  `simpleGit(cwd).raw([...])`, mirroring `checkpoint.ts`'s
  `gitCheckpointPaths` try/catch-to-`undefined` pattern). Correctly
  handle the porcelain format's abbreviated repeat blocks (full
  metadata, including `author-time`, appears only the first time a
  given commit sha is seen; later lines from the same commit omit it —
  track `author-time` per sha, reuse for repeats).
- [x] 1.2 Add `getChangeCreatedDate(cwd, changeName, archived): Promise<string | null>`
  (git log, earliest commit adding `proposal.md`) and
  `getChangeArchivedDate(changeName, archived): string | null` (regex
  on the `YYYY-MM-DD-<name>` archive folder name, no git call).
- [x] 1.3 Add `getChangeTimeline(workspaceRoot, changeName, archived): Promise<ChangeTimeline>`:
  resolves proposal/design/tasks/spec paths itself (same active/archive
  join as `workbench.ts`, via the exported `assertValidChangeName`),
  reads them, merges `readTaskChecklist`'s output with
  `blameLineDates`, returns the full `ChangeTimeline` shape.
- [x] 1.4 Add `getChangeTimelines(workspaceRoot, entries): Promise<ChangeTimeline[]>`
  (`Promise.all` over 1.3).
- [x] 1.5 Export from `packages/core/src/index.ts` only (not
  `browser.ts`).

## 2. Server: REST routes

- [x] 2.1 Add `handleChangeTimelineRequest`/`handleChangeTimelinesRequest`
  to `packages/server/src/rest.ts`, following the existing
  `handleOverviewRequest`-style handler shape.
- [x] 2.2 Wire `POST /api/change-timeline` and `POST /api/change-timelines`
  in `packages/server/src/server.ts`'s literal-`if` routing (no router
  library, matching existing `/api/change-editor/*` routes).

## 3. Webui client

- [x] 3.1 Add `packages/webui/src/change-timeline-client.ts`, mirroring
  `change-editor-client.ts`'s injected-`fetch`-function shape:
  `loadChangeTimeline(request, cwd, changeName, archived)` and
  `loadChangeTimelines(request, cwd, entries)`.

## 4. Tests

- [x] 4.1 `change-timeline.test.ts`: a real temp git repo fixture
  (`mkdtemp` + real `git init`/`git commit`/directory-move-then-commit,
  mirroring `repo-bootstrap.test.ts`'s temp-dir pattern) — not a
  hand-typed porcelain string — covering: dates for tasks checked in
  separate commits, dates for tasks checked in one squash-style commit
  (same date for all), a task added but never checked (no date), and
  blame still resolving dates after an active-to-archive directory
  move.
- [x] 4.2 REST handler test(s) in `packages/server`.
- [x] 4.3 `change-timeline-client.test.ts` in `packages/webui`.

## 5. Verification

- [x] 5.1 `npm run typecheck` and `npm run lint` (including
  `lint:english`) pass workspace-wide.
- [x] 5.2 `npm run test` passes workspace-wide, including the new test
  files.
- [x] 5.3 Manual smoke test: start the standalone server against this
  repository itself and `curl -X POST localhost:<port>/api/change-timeline`
  for a real archived change (e.g. `add-cli-help-flag`) — confirm
  `createdDate`/`archivedDate`/per-task dates look plausible against
  this session's real git history.
- [x] 5.4 Propose a changeset (`npx changeset`) for `@openspec-ui/core`
  and `@openspec-ui/server` and `@openspec-ui/webui` (minor: new
  capability, no breaking change) instead of hand-editing `version`/
  `CHANGELOG.md`; apply it via `npx changeset version`.
- [x] 5.5 Run `openspec change validate --strict add-change-timeline-data-layer`.
