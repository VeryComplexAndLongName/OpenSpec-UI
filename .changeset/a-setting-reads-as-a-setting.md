---
"@openspec-ui/webui": minor
---

A setting reads as a setting.

The standalone shell takes an editor-native look (ADR 0023), and the
three reported faults are fixed: a field's name is bound to its own
control by proximity and told from prose by weight; a control is as wide
as the value it holds, so a one-word dropdown is a one-word dropdown;
and a button that commits a section is separated from it.

Every colour the shell draws now comes from a named token. 21 literals
in 29 places moved into the palette, the extension layer defines every
one of them, and two tests keep the two layers in step.
