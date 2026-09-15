## Why

`a-change-lists-what-its-schema-declares` (ADR 0031) fixed the two defects DW,
a user of the VS Code extension, reported. On 2026-09-15 an external review of
it found where that change was checked against a schema of its own invention
rather than the ones users install. The schemas come from
`intent-driven-dev/openspec-schemas` (MIT), where DW's `spec-driven-with-adr`
comes from.

- **Invented test schema.**
  - **The real order.** `spec-driven-with-adr` declares proposal, specs,
    design, adr, tasks.
  - **The tests' order.** Their copy put `adr` second, so they check an order
    DW never has.
  - **The code is not affected.** The tree follows whatever order the schema
    declares.
- **Files outside the change are listed.** From 2026-05-11 until commit
  `b320db8` on 2026-06-22, the schema declared `adr` as `"../../../adr/*.md"`.
  Anyone still on that version sees every ADR of the repository under every
  change, labelled `../../../adr/0001-….md`. The agent prompt already refuses
  such files (`security.ts`), but the Changes tree lists them.
- **Two sentences in the archived change are wrong.**
  - **`design.md`** names DW's exploration notes as a goal. DW's schema
    declares no exploration artifact, so it never appears.
  - **`proposal.md`** reads as though it would.

## What Changes

- **Real schemas as test fixtures.** `packages/core/src/fixtures/openspec-schemas/`
  holds unchanged copies of `spec-driven-with-adr`, `event-driven` and
  `minimalist`, and of the `spec-driven-with-adr` version with the outside
  glob, with the source's MIT licence. The tests that used an invented schema
  use these instead.
- **The Changes tree lists only files inside the change's own directory.** A
  `generates` path or glob that reaches outside, through `..` or through a
  link, lists nothing there, which is the same rule the agent prompt already
  applies.
- **The archived change's `design.md` and `proposal.md` are corrected,** and
  its live-check record notes that the probe's order was invented.
- **Not in this change.** The labels of a flat `specs/<name>.md`, shown as
  that path, and of a compound id such as `asyncapi`, shown as "Asyncapi".
  Those are a separate change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `openspec-workbench`: a change's artifact files are only the ones inside the
  change's own directory. A `generates` value reaching outside it, through
  `..` or a link, lists nothing.

## Impact

- **Core.**
  - `packages/core/src/workbench.ts` and `change-schema.ts`: containment of
    matched files.
  - `change-schema.test.ts`, `workbench.test.ts` and `security.test.ts`: the
    real schemas.
  - A new fixture folder.
- **The archived change.** `openspec/changes/archive/2026-09-15-a-change-lists-what-its-schema-declares/`:
  `design.md`, `proposal.md` and `tasks.md`.
