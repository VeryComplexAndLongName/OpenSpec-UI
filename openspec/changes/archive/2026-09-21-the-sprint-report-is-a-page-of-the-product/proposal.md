## Why

The sprint report is the one thing this product makes that leaves it. It
goes to whoever asked how the sprint went, and it is the only page of the
product they will ever see.

It does not look like the product. `sprint-report-pdf.ts` draws it with
pdfkit in Helvetica on white: no colour, no rules, no cards, none of the
words or shapes every other surface uses. That was a deliberate choice in
August ("plain and functional over polished"), taken when there was no
product look to be plain against. There is one now - `shell-ui.ts`, the
Metro shell every panel and both delivery targets are drawn with - and the
report is the only surface that opted out of it.

The library costs more than its output is worth:

- `pdfkit` and `@types/pdfkit` are dependencies of `core`, the package
  whose whole point is that it is the business logic.
- It cannot be bundled the ordinary way. `packages/extension/scripts/build-options.mjs` carries an
  `alias` entry redirecting this one import to pdfkit's CommonJS build,
  because its ESM build needs a real `import.meta.url` that the
  extension's esbuild bundle cannot give it. One dependency, one build
  special case, for one page.
- Every layout decision - margins, fonts, page breaks - is written by
  hand in imperative calls, and every change to the report is a change to
  that code.

A browser already renders HTML to PDF, honours `@media print`, paginates,
and does it better than a hand-written layout ever will.

## What Changes

- **The report becomes a page.** A new `renderSprintReportPage(report)` in
  `packages/webui` returns one complete HTML document, styled by
  `shellThemeCss` and the Metro sheet - the product's own look, not a
  second one - with a `@media print` block for the paper version.
- **The PDF comes from printing it.** The standalone opens the page and
  offers Print; the VS Code command writes the page and offers to open it
  in a browser, where Ctrl+P is the PDF. Nothing in this repository
  renders a PDF any more.
- **`sprint-report-pdf.ts` goes,** with `pdfkit`, `@types/pdfkit`, and the
  `alias` special case in `build-options.mjs` that existed only for it.
- `POST /api/sprint-report` returns the summary as JSON instead of
  `application/pdf`, and the browser draws the page. It was the only
  consumer of `sendPdf`, which goes with it, so the server now sends JSON
  and nothing else.
- What the report *says* does not change: `buildSprintReport` and every
  figure it produces are untouched.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `shared-ui` - the page, and the look it is drawn in.
- `standalone-app` - the endpoint serves it, and the Timeline tab opens
  and prints it.
- `vscode-extension` - the command writes a page and opens it.
- `execution-core` - core no longer renders PDFs, and no longer depends on
  a PDF library.

## Impact

- New: `packages/webui/src/sprint-report-page.ts` and its test.
- Removed: `packages/core/src/sprint-report-pdf.ts` and its test,
  `pdfkit` and `@types/pdfkit` from `packages/core/package.json`, the
  `pdfkit` alias in `packages/extension/scripts/build-options.mjs`, `sendPdf` in
  `packages/server`.
- Changed: `packages/server/src/rest.ts`, the standalone Timeline tab's
  sprint-report mode, `openspec-ui.generateSprintReport`.
- A changeset: core, webui, server and the extension all change.

## Explicitly out of scope

- **What the report says.** The figures, the date-range semantics and the
  "Why" excerpt are as they were. This changes how it is drawn and how it
  is turned into a file, and nothing else.
- **Printing from inside VS Code.** A webview cannot print, and the editor
  has no print command. The page is written to a file and opened in a
  browser, which is where printing lives.
- **A headless PDF of our own.** Driving a browser to produce the PDF
  without a person pressing Print would put Chromium where pdfkit used to
  be, which is the trade this change is undoing.
- **Charts.** The report gains the product's look, not new content.
