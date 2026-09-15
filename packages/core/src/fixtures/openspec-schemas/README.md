# OpenSpec schemas used as test fixtures

Unchanged copies of real OpenSpec custom schemas, so that the tests of
`change-schema.ts` and `workbench.ts` read what users actually install rather
than a schema invented for the test.

- **Source:** https://github.com/intent-driven-dev/openspec-schemas
- **Licence:** MIT; the repository's `LICENSE` is copied beside this file.
- **Taken:** 2026-09-15.

| Folder | Schema | Commit | Why it is here |
| --- | --- | --- | --- |
| `spec-driven-with-adr/` | `spec-driven-with-adr` | `4bb6de2` (main) | The schema DW's project uses. Artifact order: proposal, specs, design, adr, tasks. |
| `event-driven/` | `event-driven` | `4bb6de2` (main) | Artifacts beyond the standard ones, including `asyncapi.yaml`, which is not markdown. |
| `minimalist/` | `minimalist` | `4bb6de2` (main) | Only specs and tasks. Changes written under it in that repository keep flat `specs/<name>.md` files. |
| `spec-driven-with-adr-f04aaa2/` | `spec-driven-with-adr` | `f04aaa2` | The version in use from 2026-05-11 until `b320db8` on 2026-06-22. It declares `adr` as `"../../../adr/*.md"`, a glob that reaches outside the change. |

Do not edit these files to suit a test. To follow a newer version, copy it
again, and update the commit in this table.
