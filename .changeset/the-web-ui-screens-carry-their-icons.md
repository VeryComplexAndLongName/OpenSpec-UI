---
"@openspec-ui/webui": patch
"openspec-ui-vscode": patch
---

The icons the redesigned screens promised now show. The icon stylesheet was
generated but never carried into the page, so every icon rendered as an
empty, zero-width span — in the standalone shell and in every webview. Each
screen that draws Metro now carries it, and an icon keeps a small gap from
the word beside it.
