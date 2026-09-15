Both defects were found and reported by DW, a user of the VS Code extension,
on 2026-09-15. See ADR 0031.

## 1. The decision

- [ ] 1.1 `docs/adr/0031-a-change-lists-what-its-schema-declares.md`:
  artifacts from the change's schema, read from disk in the CLI's order, with
  DW credited for both reports. The owner reviews it, and its status becomes
  Accepted.
- [ ] 1.2 `docs/adr/README.md` gains the 0031 row.

## 2. Schema discovery in core

- [ ] 2.1 `packages/core/src/change-schema.ts` resolves a change's schema name:
  the change's `.openspec.yaml`, then `openspec/config.yaml`, then
  `spec-driven`. Tests cover each step.
- [ ] 2.2 It finds the schema file in the CLI's order.
  - The order is the project's `openspec/schemas/<name>/schema.yaml`, then
    the user directory (`$XDG_DATA_HOME`, `%LOCALAPPDATA%` on Windows, or
    `~/.local/share`, followed by `openspec/schemas`), then the built-in
    `spec-driven`, carried as data.
  - Tests cover each source, and a project schema shadowing a user one.
- [ ] 2.3 It parses the file with `yaml`, refusing it as the CLI does: an
  artifact without `id` or `generates`, or a duplicate id. It falls back to
  `spec-driven` with the reason `not-found`, `unreadable` or `no-artifacts`.
  Tests cover each reason.
- [ ] 2.4 It resolves `generates`: a plain path, or a glob with `*`, `?` and
  `**`, walking only below the literal prefix, files only, skipping dot
  names. A test compares its matches with `openspec status --json` output
  captured from a probe project with DW's layout.
- [ ] 2.5 `discoverChangeArtifacts` lists a change's artifacts from its schema,
  with the ids, kinds and labels of design decision 3, and the change's
  `schema`.
  - DW's layout gives present `web/dashboard-foundation` and ADR rows, and no
    `web` row.
  - A `spec-driven` change gives the same list as before.
  - Parsed schemas are cached per discovery.
- [ ] 2.6 `@openspec-ui/core` declares `yaml` as a runtime dependency.

## 3. The consumers

- [ ] 3.1 `security.ts` embeds every existing file the discovery lists for the
  run's change, in schema order and labelled by relative path. A file whose
  real path lies outside `changeDir` is not embedded. Tests cover a nested
  delta, a schema artifact and a linked file pointing outside.
- [ ] 3.2 `change-readiness.ts` names capabilities from `delta-spec` artifacts.
  A test has two changes writing `web/dashboard-foundation` collide.
- [ ] 3.3 The extension's Changes and Archive trees:
  - label a nested delta "Spec: web/dashboard-foundation" and a schema
    artifact by its label;
  - show the "Schema: <name>" warning row first when the schema fell back.
  - Tests cover both.
- [ ] 3.4 The Specs tree opens `openspec/specs/web/dashboard-foundation/spec.md`
  for the id `web/dashboard-foundation`; a test says so.
- [ ] 3.5 The Timeline, the task checklist, the task templates, the spec-delta
  check and the chat participant still pass their tests unchanged, or are
  updated only where they listed artifacts by the fixed shape.

## 4. Checks

- [ ] 4.1 `openspec validate a-change-lists-what-its-schema-declares --strict`
  passes.
- [ ] 4.2 `npm run verify` passes, run unpiped. Record each package's count.
- [ ] 4.3 The whole standalone browser suite passes: the server reads the same
  discovery.
- [ ] 4.4 A changeset: `@openspec-ui/core` minor, `openspec-ui-vscode` minor,
  `@openspec-ui/server` patch.
- [ ] 4.5 A live check in the Extension Development Host, on a workspace with
  DW's layout and schema, with a picture kept outside the repository. The
  change shows Proposal, ADR, Spec: web/dashboard-foundation, Design and
  Tasks in schema order, and nothing reads as missing that exists.
