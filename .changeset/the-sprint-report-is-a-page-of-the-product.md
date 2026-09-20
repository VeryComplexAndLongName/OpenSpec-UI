---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"@openspec-ui/server": minor
"openspec-ui-vscode": minor
---

The sprint report is a page of the product

The sprint report is the one thing this product makes that leaves it, and
it was the only surface not drawn in the product's own look: a PDF library
drew it in Helvetica on white. It is now an HTML page styled by the same
stylesheets every other surface uses, and the PDF comes from the browser's
own print, which paginates better than a hand-written layout and lets the
reader choose the paper.

The standalone opens the report in a tab and prints it, instead of
downloading a file; `POST /api/sprint-report` returns `text/html`. The VS
Code command writes `sprint-report-<from>-<to>.html` and offers to open it
in a browser. What the report says is unchanged.

`pdfkit` and `@types/pdfkit` leave `@openspec-ui/core`, and with them the
esbuild alias the extension's bundle needed to load that library at all.
