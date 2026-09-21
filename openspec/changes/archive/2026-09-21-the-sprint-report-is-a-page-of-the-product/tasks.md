Asked for by the owner: the sprint report should be a page of the
product, styled by `shell-ui.ts`, with the PDF coming from printing it.

## 1. The page

- [x] 1.1 `packages/webui/src/sprint-report-page.ts` renders one
  `SprintReport` as one complete HTML document.
- [x] 1.2 It inlines `metroCss`, `metroIconsCss` and `shellThemeCss`, so
  it looks like the product and needs no server to be opened.
- [x] 1.3 It draws every figure the PDF drew: the range, each change with
  its author, dates, task counts and "Why" excerpt, and the totals with
  the per-author breakdown. Each change's state is drawn as the product's
  own badge, under the classes that carry its hue: `badge` alone draws no
  block outside a row, which a first look at a real report showed.
- [x] 1.4 Everything that comes from the repository is escaped: a change
  name or a commit author is text, never markup.
- [x] 1.5 A `@media print` block gives it white paper, no shadows, a page
  margin, and no change split across a page break.
- [x] 1.6 A test asserts the figures are on the page, that a hostile
  change name cannot inject markup, and that the document stands alone.

## 2. The standalone serves and prints it

- [x] 2.1 `POST /api/sprint-report` returns the summary as JSON, and
  `sendPdf` goes with its last caller: the server sends JSON and nothing
  else.
- [x] 2.2 The Timeline tab's sprint-report mode draws the page, opens it
  in a new window from the click that asked for it, and says so when a
  popup blocker stops that window.
- [x] 2.3 The button says what it now does.

## 3. The editor writes and opens it

- [x] 3.1 `openspec-ui.generateSprintReport` writes
  `sprint-report-<from>-<to>.html` through the save dialogue.
- [x] 3.2 It then offers to open it, and opens it in a browser.

## 4. The library goes

- [x] 4.1 `packages/core/src/sprint-report-pdf.ts` and its test are
  deleted.
- [x] 4.2 `pdfkit` and `@types/pdfkit` leave `packages/core/package.json`,
  and `package-lock.json` with them.
- [x] 4.3 The `pdfkit` `alias` entry leaves `packages/extension/scripts/build-options.mjs`,
  and the comment that explains it leaves with it.
- [x] 4.4 Nothing in the repository imports pdfkit.

## 5. Checks

- [x] 5.1 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`.
- [x] 5.2 `npm run test:browser -w @openspec-ui/server` - the whole
  browser suite, not a selection: 26 passed.
- [x] 5.3 A changeset: core, webui, server and the extension all change.
- [x] 5.4 `openspec validate the-sprint-report-is-a-page-of-the-product
  --strict`.
- [x] 5.5 **Human-only.** Done by Claude on 2026-09-20 at the owner's
  request, for the owner to look at in turn. A report was generated over
  this repository's own changes, for 2026-09-14 to 2026-09-20, opened in
  Chromium and printed:

  - 11 changes, 160 tasks completed in the range, one author;
  - the page is drawn in the product's look: the Metro type, white cards
    on the grey ground, blue ACTIVE and grey ARCHIVED badges, and the
    muted fact line under each name;
  - under print the ground goes white, the Print button disappears, and
    each change's card carries `break-inside: avoid`;
  - printing produced a PDF of 57795 bytes.

  What this does not cover is a person's eye on the paper itself: the
  owner has the page, and pressing Ctrl+P is the whole of it.
