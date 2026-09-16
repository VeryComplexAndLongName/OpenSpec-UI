---
"@openspec-ui/webui": minor
"openspec-ui-vscode": patch
---

The web UI's copy of Metro UI now carries panels, cards, badges and Metro's
timeline, with every one of their variables mapped to the editor's own theme
for the VS Code panels (ADR 0032). Icons ship as a subset of the pinned Metro
icon set, inlined in the stylesheet, so a host that refuses another origin
still draws them, and a screen names what it means rather than a glyph.

A hue that holds a label now declares the ink used on it, and a test computes
the contrast of every pair. No screen changes yet; the screens follow.
