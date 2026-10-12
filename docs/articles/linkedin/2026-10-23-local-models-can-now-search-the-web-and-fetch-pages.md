# LinkedIn post: local-models-can-now-search-the-web-and-fetch-pages

Publish between 2026-10-23 and 2026-10-25: the site page is live from 2026-10-20,
and this goes out three to five days after it, not on the same day.
Attach: `docs/articles/site/local-models-can-now-search-the-web-and-fetch-pages/cover.jpg`.
Put the repository link in the first comment, not in the post.

## Post

A local model is only as useful as the information it can bring to bear.
Until this week, a local agent could reason about what was already in its
context window, but it could not look up a current fact or read a source page.

Two new shared core tools: `search_web` and `fetch_webpage`. They let
local-model agents consult a SearXNG endpoint and retrieve HTML pages as
Markdown-backed JSON artifacts - clean content, tables preserved, remote
content treated as untrusted data.

Both local-model adapters get the tools. Remote agents are unchanged.

Full write-up: https://openspec-ui.dev/articles/local-models-can-now-search-the-web-and-fetch-pages/

What is the one thing your local model cannot do that would make it actually useful?

## First comment

The code, the issues and the extension: https://github.com/VeryComplexAndLongName/OpenSpec-UI
(The product is OpenSpec Workbench. The repository and packages are still called OpenSpec-UI.)
