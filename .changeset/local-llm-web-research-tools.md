---
"@openspec-ui/core": minor
---

Add bounded web-search and HTML-page retrieval tools to both local model agents. Pages come back as JSON artifacts with Markdown: every data table as a Markdown table (spans repeated, stacked headers joined, no HTML attributes), and a page larger than 1 MB read up to the bound and marked `truncated`.