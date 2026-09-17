---
"@openspec-ui/core": patch
"@openspec-ui/webui": minor
"openspec-ui-vscode": minor
---

The Pipeline panel keeps answering while an Agentic Harness chain runs in
this editor, when the optional local server (`openspec-ui.transport.localServer.enabled`)
is on: the panel embeds the server's own Pipeline tab instead of reading over
the message bridge, so its cards are drawn from readings the server's own
process took, not the extension host's. Opening a change from a card still
opens it in the editor. With the local server off, the panel is unchanged.

A panel that embeds the server's page, the Pipeline or the AI panel, now
fills its tab and draws in the editor's light or dark theme; before, the page
sat in a small box in the tab's corner and followed the operating system's
theme. The Pipeline draws itself again when the editor's theme changes.

A Pipeline card no longer says Ready above its own "running apply" line: its
word now reads the same runs its lines do.
