## Why

DW, a user of the VS Code extension, reported two defects on 2026-09-15, both
from one change in their project. ADR 0031
(`docs/adr/0031-a-change-lists-what-its-schema-declares.md`) records the
decision this change applies.

- **A nested delta spec reads as missing.**
  - **The file.** DW's change keeps its delta at
    `specs/web/dashboard-foundation/spec.md`. OpenSpec CLI 1.7.0 supports that
    layout: its parser, `validate` and `archive` accept it, and
    `openspec list --specs` names the capability `web/dashboard-foundation`.
  - **The display.** The Changes tree shows "Spec: web — missing".
  - **The cause.** Core looks for `spec.md` exactly one level under `specs/`.
  - **Two other places assume the same.** The artifact prompt of an agent run
    never embeds a nested delta. The readiness report cannot see two changes
    colliding on a nested capability.
- **A custom schema's artifacts are not shown.** DW's project uses its own
  schema, `spec-driven-with-adr`, which adds `adr.md`. The tree lists only a
  hard-coded Proposal, Design and Tasks, so the change's ADR never appears.
  The change also holds `exploration.md`, which the schema does not declare
  and which therefore stays unlisted. (Corrected by
  `a-schema-artifact-stays-inside-its-change`.)

## What Changes

- **Artifacts come from the change's schema.** Core resolves the schema as
  the CLI does:
  - **The name.** From the change's `.openspec.yaml`, then
    `openspec/config.yaml`, then `spec-driven`.
  - **The schema file.** From the project's `openspec/schemas/`, then the
    user's OpenSpec data directory, then the built-in `spec-driven`, which
    core carries as data.
  - **The artifacts.** In the order the schema declares them, each with the
    files its `generates` path or glob matches.
  - **No CLI process.** Discovery reads the disk only, because it is polled.
- **Delta specs are found at any depth** and named by their capability path
  under `specs/`, such as `web/dashboard-foundation`.
- **The agent prompt and readiness use the same discovery.**
  - An agent run embeds every existing file the change's schema declares,
    nested delta specs included.
  - Readiness names nested capabilities by their full path.
- **Existing ids are kept.** Proposal, design and tasks keep their ids, and
  delta specs their kind, so the Timeline, the task checklist, the task
  templates and the spec-delta check are unchanged. Any other artifact is
  listed under its schema id.
- **Core's own list of canonical specs is removed** (`workspace.specs`).
  Every screen already lists them through the CLI, which finds nested specs.
  The one-level copy in `workbench.ts` was read by nothing but its own test.
- **A schema that cannot be read falls back to `spec-driven`.** The change
  says why: not found, does not parse, or declares no artifacts.
- **Dependency.** Core gains `yaml` as a runtime dependency.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `openspec-workbench`: a change lists the artifacts its OpenSpec schema
  declares, with delta specs found at any depth and named by their capability
  path, and falls back to `spec-driven` with a reason when the schema cannot
  be read.
- `execution-core`: the prepared context of a run embeds every existing file
  the change's schema declares, including nested delta specs, instead of a
  fixed proposal, design, tasks and one-level delta list.

## Impact

- **Core.**
  - `packages/core/src/workbench.ts`: artifact discovery.
  - A new schema reader beside it.
  - `security.ts`: its own artifact copy is replaced by the shared discovery.
  - `change-readiness.ts`: capabilities.
  - `packages/core/package.json`: the `yaml` dependency.
- **The extension.**
  - `tree/changes-tree.ts`: labels for nested and schema-declared artifacts,
    and the fallback reason.
  - `chat-participant.ts`: reads the same artifact list.
- **Tests.** Workbench, security, readiness and tree tests, and a fixture
  with a nested delta spec and a custom schema.
- **Out of scope.** The Change Editor's own spec file
  (`change-editor-store.ts`, `specs/<change>/spec.md`) keeps its layout. It
  edits the spec it creates.
