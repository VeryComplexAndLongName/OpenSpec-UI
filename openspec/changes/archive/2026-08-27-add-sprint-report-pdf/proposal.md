## Why

Following up on the 2026-08-26/27 product-direction discussion: the
user asked for a downloadable "sprint summary" PDF report — given a
start/end date, who did what (from git), when, task completion, plus
final aggregate statistics. This is the first (standalone-only) half;
`add-sprint-report-vscode-command` (next) adds the VS Code command.

## What Changes

- Add `getChangeAuthorship(cwd, changeDirPath)` to
  `packages/core/src/change-timeline.ts`: a new git primitive (`git log
  --format=%an\x1f%ae\x1f%aI`) returning the primary author (most
  recent commit touching the change's directory — this repository's own
  squash-merge convention makes this the most representative single
  answer to "who did this") and every distinct contributor. No existing
  code in this repository extracted author name/email before this —
  only commit timestamps (`author-time`/`%aI`).
- Add `packages/core/src/sprint-report.ts`
  (`buildSprintReport(workspaceRoot, entries, rangeStart, rangeEnd)`):
  aggregates `getChangeTimeline`/`getChangeAuthorship` per selected
  change into a `SprintReport` (per-change author/dates/task counts/a
  plain-text "Why" excerpt, plus totals and a per-author breakdown).
  The date range filters which *tasks* count toward the sprint's stats,
  not which *changes* appear — the user already chose those explicitly
  via the existing change picker.
- Add `packages/core/src/sprint-report-pdf.ts`
  (`renderSprintReportPdf(report)`, via the new `pdfkit` dependency): a
  plain, structured PDF — no tables/graphics/custom fonts, matching
  this project's existing "plain and functional over polished" bias.
- Add `POST /api/sprint-report` in `packages/server`, returning
  `application/pdf` with `content-disposition: attachment` — the first
  non-JSON response this server's REST layer has ever sent (mirrors
  `static.ts`'s existing raw-Buffer response pattern, not `sendJson`).
- Add a third "Sprint report" mode to the standalone Timeline tab
  (alongside "Single change"/"Compare changes"), reusing the same
  date-range + multi-select UI pattern already built for "Compare
  changes." A "Download PDF" button fetches the PDF as a `Blob` and
  triggers a browser download (`URL.createObjectURL` + a temporary
  `<a download>` — no existing precedent in this codebase, a standard
  browser pattern).

## Capabilities

### Modified Capabilities

- `execution-core`: adds a Requirement for sprint report generation
  (authorship, aggregation, PDF rendering).
- `standalone-app`: adds a Requirement for the Sprint report mode.

## Impact

- `packages/core/src/change-timeline.ts` (new `getChangeAuthorship`)
- `packages/core/src/sprint-report.ts` (new)
- `packages/core/src/sprint-report-pdf.ts` (new)
- `packages/core/package.json` (new dependency: `pdfkit`,
  `@types/pdfkit`)
- `packages/server/src/rest.ts`, `server.ts`
- `packages/webui/src/sprint-report-client.ts` (new)
- `packages/webui/src/standalone-entry.tsx`
- `.changeset/*.md` (new changeset file)
