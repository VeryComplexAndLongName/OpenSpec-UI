---
"@openspec-ui/webui": minor
"openspec-ui-vscode": minor
---

The Pipeline panel keeps answering while an Agentic Harness chain runs in
this editor, when the optional local server (`openspec-ui.transport.localServer.enabled`)
is on: the panel embeds the server's own Pipeline tab instead of reading over
the message bridge, so its cards are drawn from readings the server's own
process took, not the extension host's. Opening a change from a card still
opens it in the editor. With the local server off, the panel is unchanged.
