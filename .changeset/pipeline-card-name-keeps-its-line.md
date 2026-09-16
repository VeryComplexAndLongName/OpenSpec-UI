---
"@openspec-ui/webui": patch
"openspec-ui-vscode": patch
---

A Pipeline card's name no longer runs over its state. Once the icon font
drew the icon beside a card's name, the icon took a line of its own and
pushed the name down over "RUNNING" or "FURTHER ALONG", since a card's height
does not grow. The icon and the name now share one line, and a long name
ends in an ellipsis.
