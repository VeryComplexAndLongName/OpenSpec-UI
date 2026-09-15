## Why

An external review of `a-change-lists-what-its-schema-declares` (ADR 0031)
found two labels in the Changes tree that read badly. The previous change
deferred both.
- **A compound id.** `event-driven`'s `asyncapi` artifact reads "Asyncapi".
- **A spec file outside a capability folder.** `minimalist`'s `specs/**/*.md`
  matches `specs/landing-page.md`, which reads as the path.
  - **What archive does with it.** On 2026-09-15, `openspec validate --strict`
    passed such a change and `openspec archive` merged only
    `specs/checkout/spec.md`. The flat file was dropped without a word.

## What Changes

- **Known terms keep their usual spelling.** A schema artifact's label writes
  each word of its id that is a known term as that term is usually written:
  `asyncapi` reads AsyncAPI, `openapi-contract` reads "OpenAPI contract".
- **A file a glob matched names its artifact and itself.**
  - **The label.** A matched file that is not a delta spec reads as the
    artifact's label and the file's path under the glob's fixed folder, such as
    "Specs: landing-page.md".
- **A file archive will not apply says so.** A file under the change's
  `specs/` that is not `specs/<capability>/spec.md` is marked in core. The
  Changes tree shows it with a warning icon and "not applied on archive".

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `openspec-workbench`: how a schema artifact is labelled, and how a spec file
  that archive will not apply is shown.

## Impact

- **Core.** `packages/core/src/workbench.ts`: labels, and a new optional field
  on `WorkbenchArtifact`. `workbench.test.ts`.
- **Extension.** `packages/extension/src/tree/changes-tree.ts` and its test.
- **Unchanged.** Delta specs, readiness, the Timeline, the spec-delta check
  and the agent prompt keep their behaviour. Every one of them uses only delta
  specs or the label as a heading.
