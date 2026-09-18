---
"@openspec-ui/webui": minor
"openspec-ui-vscode": patch
---

The last five tabs are drawn from the shared components

Run a Command, Processes, Diff Preview, Change Editor and Templates were
left on the pre-redesign markup when ADR 0033 redrew the screens a mockup
covered. Each now has panels that name what they hold, one toolbar of the
shape every other tab uses, tables in the shared class, badges for a run's
state and a template's origin, and its own words when there is nothing to
show. The Change Editor's hand-rolled document strip is the shared
segmented control, Diff Preview lists the files it changed, and Templates
says what it offers before anything is loaded.

Nothing a person or a test reaches for moved: every test handle, label and
role is what it was. The editor's own colours follow the renamed classes,
which the mapping test gates.
