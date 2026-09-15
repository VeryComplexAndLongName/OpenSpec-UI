---
"@openspec-ui/core": patch
"openspec-ui-vscode": patch
---

A change's artifact list now includes only files inside that change's own
folder. Some OpenSpec schemas point outside the change, for example
`spec-driven-with-adr` as published between May and June 2026, whose ADR
artifact covered the repository's whole `adr/` folder. With such a schema,
every ADR of the repository used to appear under every change. A link inside
a change that points elsewhere no longer brings files in either.
