---
"@openspec-ui/core": minor
"openspec-ui-vscode": patch
---

Artifact labels in the Changes tree read better with custom OpenSpec schemas.
An id that is a known term is written as that term, so `asyncapi` reads
AsyncAPI. A file a glob matched names its artifact and itself, such as
"Specs: landing-page.md".

A spec file outside a capability folder, such as `specs/landing-page.md`, is
now marked "not applied on archive". OpenSpec's archive merges only
`specs/<capability>/spec.md` and drops such a file without a warning.
