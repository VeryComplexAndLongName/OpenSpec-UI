---
"@openspec-ui/webui": minor
"openspec-ui-vscode": minor
---

The Pipeline panel keeps answering while the Agentic Harness runs a chain.
With the optional local server enabled, the panel now shows the standalone
shell's Pipeline tab, so the cards are read by the server's process instead of
the editor's, which is busy running the chain. Opening a change from a card
still opens it in the editor, and Stop still goes through the same signed
route. With the server disabled, the panel works exactly as before.
