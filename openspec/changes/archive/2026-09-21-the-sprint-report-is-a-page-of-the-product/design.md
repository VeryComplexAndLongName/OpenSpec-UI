## Where the page is built

In `packages/webui`, not in `core`.

The invariant is that business logic lives in `core` and nowhere else. A
sprint report's figures are business logic and stay there:
`buildSprintReport` is untouched, and the page takes its output as data.
How that data looks is presentation, which is what `webui` is for - and
`webui` is where the stylesheet already lives. Building the page in `core`
would mean `core` importing `shellThemeCss`, which reverses the
dependency between the two packages.

The function is a plain string, not a React component. Nothing interacts
with this page: it is read and printed. A component would need a renderer
at both call sites - a server that renders no React today, and an
extension command that writes a file - to produce the same characters.

## The whole stylesheet, not a second one

The page inlines `metroCss`, `metroIconsCss` and `shellThemeCss`, the same
three the standalone and the webviews inline. Inlining all of it makes the
page bigger than the report; extracting "just the parts the report needs"
would make a fourth stylesheet that drifts from the other three the first
time a card's padding changes. The page is opened from disk with no
server, so it must carry its styles anyway.

`@media print` is the only CSS this change writes: white background,
no shadows, a page margin, and `break-inside: avoid` on each change's
card so a change is not split across a page break.

## Why a person presses Print

The obvious next step - render the PDF ourselves from the HTML - needs a
browser engine. That would put Puppeteer or Playwright where pdfkit used
to be, which is a larger dependency than the one being removed, for the
same one page.

Pressing Ctrl+P is one action, the browser's print dialogue already offers
"Save as PDF" on every platform this product runs on, and the person
printing chooses the paper size and the margins, which no default of ours
would get right for everybody.

## What each surface does

**Standalone.** `POST /api/sprint-report` returns the summary as JSON,
and the tab draws the page itself. The server runs from TypeScript and
cannot import another package's source across the package boundary, so a
server that rendered the page would need `webui` built first - and a REST
layer that sends a document rather than data is a thicker layer than this
one is meant to be. The tab opens a window from the click that asked for
it, writes the page into it, and the reader presses Print, which is why
the reader is told when a popup blocker stops that window.

**VS Code.** The command writes `sprint-report-<from>-<to>.html` through
the same save dialogue that used to write the PDF, then offers to open it
with `vscode.env.openExternal`. A webview would have been the closer fit
visually, but a webview cannot print and the editor has no print command,
so the file and the browser are the honest route.

## What goes, and what that costs

`sprint-report-pdf.ts`, its test, `pdfkit`, `@types/pdfkit`, the `alias`
entry in `packages/extension/scripts/build-options.mjs`, and `sendPdf` in the server go. The server
then sends no binary body anywhere, and the extension bundles no library
with an `import.meta.url` problem.

The cost is that `POST /api/sprint-report` changes its content type. It is
this product's own endpoint, called by this product's own tab, and the
version it ships in says so.

## Alternatives considered

**Keep pdfkit and restyle its output.** Colours and rules can be drawn in
pdfkit, but every one of them is a second implementation of a rule that
already exists in CSS, maintained by hand, and diverging the first time
the product's look changes.

**A Markdown report.** Smaller, and it prints badly: no page breaks, no
control over what a heading looks like, and the reader has to render it
themselves.

**Print from a webview in VS Code.** There is no API for it. A webview can
open a browser window with `window.open`, but only where the webview's
content security policy allows it, and the result is the same browser tab
this change opens directly.
