---
"openspec-ui-vscode": patch
"@openspec-ui/cli": patch
---

Describe what shipped. The CLI README said it "intentionally supports only
`validate`" while the package had gained `change-graph` and
`release-manifest`; all three are now documented. The extension README
gains the Change Graph view, the command that walks a change back to what
it follows, and the recorded spend and ceilings that were only described
in LIMITS.md.
