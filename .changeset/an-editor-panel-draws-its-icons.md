---
"openspec-ui-vscode": patch
---

Icons draw in the editor's panels. The Harness Settings, Pipeline, Timeline and AI panels refused the icon font their stylesheet carries, because their Content Security Policy allowed no font source, so every icon — the gear beside "Global harness settings" among them — was an empty box. Each panel now allows `data:` fonts, and nothing else.
