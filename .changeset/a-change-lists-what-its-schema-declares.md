---
"@openspec-ui/core": minor
"openspec-ui-vscode": minor
"@openspec-ui/server": patch
---

Changes now list the artifacts their OpenSpec schema declares.

- **Nested delta specs.** A delta spec kept in an area folder, such as
  `specs/web/dashboard-foundation/spec.md`, shows as
  "Spec: web/dashboard-foundation". It used to show as "Spec: web — missing".
- **Custom schemas.** A project schema's own artifacts appear in the order the
  schema lists them, for example an ADR added to proposal, specs, design and
  tasks.
- **Agent runs and the parallel-readiness report** use the same list, so an
  agent sees every file a change's schema declares.
- **A schema that cannot be found or read.** The change shows a warning row
  that says why, above the default spec-driven artifacts.
