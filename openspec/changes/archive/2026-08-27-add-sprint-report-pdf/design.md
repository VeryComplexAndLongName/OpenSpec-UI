## Context

Researched directly against this codebase before writing any code:
`change-timeline.ts`'s existing git primitives (`blameLineDates`,
`getFileCreatedDate`) capture timestamps only, never author identity;
no PDF library exists anywhere in this monorepo (`grep`-confirmed
across all 6 `package.json` files, not assumed); `rest.ts` is JSON-only
today, but `static.ts`'s `serveFile` already proves a raw-`Buffer`
response works cleanly in this server.

## Goals / Non-Goals

**Goals:**
- Reuse `getChangeTimeline`/`getChangeTimelines` unchanged for
  per-change data — this change adds authorship and PDF rendering
  only, not a second copy of the timeline data layer.
- A user-specified date range (the user explicitly asked to set sprint
  start/end dates), unlike the multi-change comparison view's
  auto-derived range.
- No heavy PDF pipeline (headless browser, HTML-to-PDF) — `pdfkit` is
  pure JS with no browser/native dependency.

**Non-Goals:**
- Not the VS Code command (`add-sprint-report-vscode-command`, next) —
  this change is standalone-only.
- Not visual polish (custom fonts, a logo, tables/charts) — a plain,
  readable structured document is enough for v1, consistent with this
  project's existing bias elsewhere (e.g. the multi-change timeline's
  plain-CSS-position choice over a charting library).
- Not perfect markdown fidelity in the "Why" excerpt — a regex-based
  strip of the most common syntax (code spans, bold, links), not a full
  AST parse. `renderMarkdown` (webui) was deliberately not reused here:
  it renders to React elements for a browser DOM, not plain text for a
  PDF library running in Node.

## Decisions

### Primary author = most recent commit touching the change's directory

Not "who created it" (the earliest commit, which `getFileCreatedDate`
already answers) — chosen because this repository's own squash-merge
convention means there is often exactly one commit per change anyway,
and for any repository with a longer history, the most recent commit
is the most representative single answer to "who shipped this."
`contributors` (every distinct author by email, oldest to newest)
covers the fuller picture without forcing a choice for callers that
want it.

### Date range filters tasks/stats, not which changes appear

The user already chose which changes belong in the report via the
existing multi-select picker (`ChangeTimelineRequestEntry[]`, reused
unchanged). Excluding a selected change from its own requested report
just because it started a day before the range would be a surprising,
unwanted behavior — the range instead determines which of a change's
completed tasks count toward `tasksCompletedInRange`/the sprint totals,
and is shown as the report's header.

### `pdfkit`, piped through a buffering `Promise`

`pdfkit` has no built-in promise/buffer API — `PDFDocument` is a
Node `Readable` stream. `renderSprintReportPdf` collects `"data"`
chunks into an array and resolves `Buffer.concat(chunks)` on `"end"`,
the standard pattern for this library (confirmed via its own type
definitions and documented usage, not guessed).

### The REST endpoint returns a raw PDF, not JSON-wrapped base64

Matches `static.ts`'s existing `res.writeHead(200, {"content-type":
...}); res.end(buffer)` shape rather than inventing a
JSON-with-base64-payload convention — a real `content-type:
application/pdf` response lets `response.blob()` work directly on the
client side, and is what any HTTP client (including a future CLI use)
would expect from a "download a PDF" endpoint.

## Risks / Trade-offs

- **[Risk]** `pdfkit` is a new supply-chain dependency (plus its
  `@types/pdfkit` companion). → **Mitigation**: it is a long-established,
  widely-used, pure-JS library with no native bindings or browser
  dependency — the lowest-risk category of new dependency for exactly
  this need, and `npm audit --omit=dev --audit-level=high` (this
  repository's actual CI gate) reports zero vulnerabilities with it
  installed.
- **[Risk]** The plain-text "Why" excerpt is a best-effort regex strip,
  not a real markdown parser — unusual markdown (nested formatting,
  tables inside the Why section) could render awkwardly. →
  **Mitigation**: accepted for v1; the excerpt is a summary aid, not
  the full proposal, and every proposal in this repository's own
  history uses simple prose in its Why section.
