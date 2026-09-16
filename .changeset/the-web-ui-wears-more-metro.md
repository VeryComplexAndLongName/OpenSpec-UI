---
"@openspec-ui/webui": minor
"openspec-ui-vscode": patch
---

The standalone shell uses more of Metro UI (ADR 0032). Settings sections are
panels with their name and an icon in the title, a change's history is Metro's
timeline, several changes read as one picture over a single axis of time, the
summary shows tiles with an icon, and a state word is a badge. Repeated
actions carry an icon before their label.

Icons ship as a subset of the pinned Metro icon set, inlined in the
stylesheet, so a host that refuses another origin still draws them. A hue that
holds a label now declares the ink used on it, and every pair meets WCAG AA.
Panels inside VS Code keep taking every colour from the editor's theme.
