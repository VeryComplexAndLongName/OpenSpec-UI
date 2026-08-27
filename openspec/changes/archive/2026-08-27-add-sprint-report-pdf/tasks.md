## 1. Core: authorship, aggregation, PDF rendering

- [x] 1.1 Add `getChangeAuthorship(cwd, changeDirPath)` to
  `change-timeline.ts` (`CommitAuthor`, `ChangeAuthorship` types) — a
  new `git log --format=%an\x1f%ae\x1f%aI` primitive, graceful
  degradation on failure (matching every other function in the file).
- [x] 1.2 Add tests against a real temp git repo fixture: primary
  author is the most recent commit's author, `contributors` lists
  every distinct author (by email) oldest to newest, empty authorship
  when git fails or the directory has no history.
- [x] 1.3 Add `pdfkit` + `@types/pdfkit` to `packages/core/package.json`.
- [x] 1.4 Add `packages/core/src/sprint-report.ts`
  (`buildSprintReport`) — reuses `getChangeTimeline`/
  `getChangeAuthorship` unchanged; date-range filters tasks/stats, not
  which changes appear (see design.md).
- [x] 1.5 Add tests: authorship/task-count aggregation, date-range
  task filtering, a change kept even when it started before the range,
  `changesByAuthor` ranked by count descending, empty report for no
  entries.
- [x] 1.6 Add `packages/core/src/sprint-report-pdf.ts`
  (`renderSprintReportPdf`) using `pdfkit`, buffered via the
  collect-chunks-on-`"end"` pattern.
- [x] 1.7 Add a test confirming a real PDF buffer (`%PDF-` magic bytes,
  `%%EOF` trailer) comes back, including for an empty report.
- [x] 1.8 Export both new modules from `index.ts` (Node-only — not
  `browser.ts`, since both use git/Node streams).

## 2. Server: REST endpoint

- [x] 2.1 Add `sendPdf(res, buffer, filename)` to `rest.ts`, mirroring
  `sendJson`'s shape (adds `content-disposition: attachment`).
- [x] 2.2 Add `handleSprintReportRequest` (body:
  `{cwd, entries, rangeStart, rangeEnd}`) calling `buildSprintReport`
  then `renderSprintReportPdf`.
- [x] 2.3 Wire `POST /api/sprint-report` in `server.ts`.
- [x] 2.4 Add tests: a real PDF comes back with the correct
  `content-type`/`content-disposition`; a request missing the date
  range is rejected with 400.

## 3. Webui: Sprint report mode

- [x] 3.1 Add `packages/webui/src/sprint-report-client.ts`
  (`fetchSprintReportPdf`, returns a `Blob`) and its test.
- [x] 3.2 Add a third "Sprint report" mode to the Timeline tab in
  `standalone-entry.tsx`, reusing the existing date-range/multi-select
  state from "Compare changes"; a "Download PDF" button triggers the
  browser download (`URL.createObjectURL` + a temporary `<a
  download>`).

## 4. Verification

- [x] 4.1 `npm run typecheck` and `npm run lint` (including
  `lint:english`) pass workspace-wide.
- [x] 4.2 `npm run test` passes workspace-wide, including all new test
  files.
- [x] 4.3 `npm audit --omit=dev --audit-level=high` (this repository's
  actual CI gate) still reports zero vulnerabilities with `pdfkit`
  installed.
- [x] 4.4 Manual smoke test: started the standalone server against
  this repository itself, requested a real sprint report for five of
  today's/yesterday's own real archived changes, confirmed a valid PDF
  (`file` reports "PDF document, version 1.3, 2 page(s)") with correct
  real data — actual proposal excerpts, dates, git author, and correct
  totals/per-author statistics.
- [x] 4.5 Propose a changeset (`npx changeset`) for `@openspec-ui/core`,
  `@openspec-ui/server`, and `@openspec-ui/webui` (all minor: new
  capability, no breaking change) instead of hand-editing `version`/
  `CHANGELOG.md`; apply it via `npx changeset version`.
- [x] 4.6 Run `openspec change validate --strict add-sprint-report-pdf`.
