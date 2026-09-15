Both defects were found and reported by DW, a user of the VS Code extension,
on 2026-09-15. See ADR 0031.

## 1. The decision

- [x] 1.1 `docs/adr/0031-a-change-lists-what-its-schema-declares.md`:
  artifacts from the change's schema, read from disk in the CLI's order, with
  DW credited for both reports. The owner reviews it, and its status becomes
  Accepted.

  Done: the owner approved it on 2026-09-15, and its status is Accepted.
- [x] 1.2 `docs/adr/README.md` gains the 0031 row.

  Done: listed as Accepted.

## 2. Schema discovery in core

- [x] 2.1 `packages/core/src/change-schema.ts` resolves a change's schema name:
  the change's `.openspec.yaml`, then `openspec/config.yaml`, then
  `spec-driven`. Tests cover each step.

  Done: `schemaNameForChange`. Its test covers the three steps, and a
  `.openspec.yaml` that does not parse, which names no schema.
- [x] 2.2 It finds the schema file in the CLI's order.
  - The order is the project's `openspec/schemas/<name>/schema.yaml`, then
    the user directory (`$XDG_DATA_HOME`, `%LOCALAPPDATA%` on Windows, or
    `~/.local/share`, followed by `openspec/schemas`), then the built-in
    `spec-driven`, carried as data.
  - Tests cover each source, and a project schema shadowing a user one.

  Done.
  - **`userSchemasDir`** mirrors the CLI's `getGlobalDataDir`, read from
    OpenSpec 1.7.0's `dist/core/global-config.js`: `XDG_DATA_HOME` on any
    platform, then `LOCALAPPDATA`, then `~/AppData/Local` on Windows, or
    `~/.local/share` elsewhere. It is tested for all four.
  - **`BUILT_IN_SCHEMAS`** carries `spec-driven`'s four artifacts and their
    `generates` values, as the package declares them.
  - **Resolution tests** cover a project schema, a user schema, a project
    schema shadowing a user schema of the same name, and the built-in schema.
- [x] 2.3 It parses the file with `yaml`, refusing it as the CLI does: an
  artifact without `id` or `generates`, or a duplicate id. It falls back to
  `spec-driven` with the reason `not-found`, `unreadable` or `no-artifacts`.
  Tests cover each reason.

  Done: `parseSchemaArtifacts` and `resolveChangeSchema`, which never throws.
  - **Refusals tested:** a missing id, a missing `generates`, and a repeated
    id.
  - **Fallbacks tested:** a schema found nowhere, a file that does not parse,
    and an empty artifact list.
  - **Caching.** Parsed files are cached per discovery, and a test shows two
    changes under one schema reading its file once.
- [x] 2.4 It resolves `generates`: a plain path, or a glob with `*`, `?` and
  `**`, walking only below the literal prefix, files only, skipping dot
  names. A test compares its matches with `openspec status --json` output
  captured from a probe project with DW's layout.

  Done: `resolveGenerates` and `matchesGlob`.
  - **The probe.** On 2026-09-15, OpenSpec 1.7.0 ran in a temporary project
    with `specs/web/dashboard-foundation/spec.md` and a project schema
    `spec-driven-with-adr`. `openspec status --change dashboard-change --json`
    listed `existingOutputPaths` for `specs/**/*.md` as exactly that file.
  - **The test.** It rebuilds that layout, adds a dot folder, a
    non-markdown file and a directory named `empty.md`, and expects the
    CLI's answer plus a flat `specs/flat/spec.md`.
- [x] 2.5 `discoverChangeArtifacts` lists a change's artifacts from its schema,
  with the ids, kinds and labels of design decision 3, and the change's
  `schema`.
  - DW's layout gives present `web/dashboard-foundation` and ADR rows, and no
    `web` row.
  - A `spec-driven` change gives the same list as before.
  - Parsed schemas are cached per discovery.

  Done in `workbench.ts`.
  - **Kinds.** Kept: `proposal`, `design`, `tasks` and `delta-spec`. New:
    `schema-artifact`.
  - **`listChangeArtifacts(changeDir)`** serves callers that have only a
    directory.
  - **Tests in `workbench.test.ts`.**
    - **DW's layout:** Proposal, ADR, `web/dashboard-foundation`, Design
      (missing) and Tasks, in schema order, with no `web` row.
    - **A schema found nowhere:** the `spec-driven` list, with reason
      `not-found`.
  - **One visible change for a `spec-driven` change.** Delta specs now come
    second, where the schema declares them (proposal, specs, design, tasks),
    not last. The existing test states that order.
- [x] 2.6 `@openspec-ui/core` declares `yaml` as a runtime dependency.

  Done: `"yaml": "^2.9.0"`, the version already in the lockfile, recorded
  with `npm install --package-lock-only`.

## 3. The consumers

- [x] 3.1 `security.ts` embeds every existing file the discovery lists for the
  run's change, in schema order and labelled by relative path. A file whose
  real path lies outside `changeDir` is not embedded. Tests cover a nested
  delta, a schema artifact and a linked file pointing outside.

  Done.
  - **What went.** The module's own copy of the one-level rule
    (`STANDARD_ARTIFACTS` and its `readdir` of `specs/`).
  - **What replaced it.** It takes the file list from `listChangeArtifacts`,
    resolves each with `realpath`, and reads only what lies inside the real
    `changeDir`.
  - **New tests.**
    - DW's layout embeds `## adr.md` and
      `## specs/web/dashboard-foundation/spec.md`.
    - A junction at `specs/linked` into another directory is not embedded.
  - **The earlier tests pass unchanged,** labels included.
- [x] 3.2 `change-readiness.ts` names capabilities from `delta-spec` artifacts.
  A test has two changes writing `web/dashboard-foundation` collide.

  Done: `capabilitiesOf` reads `listChangeArtifacts`. The new test's two
  changes cannot join each other, the report names the capability
  `web/dashboard-foundation`, and it never names `web`.
- [x] 3.3 The extension's Changes and Archive trees:
  - label a nested delta "Spec: web/dashboard-foundation" and a schema
    artifact by its label;
  - show the "Schema: <name>" warning row first when the schema fell back.
  - Tests cover both.

  Done.
  - **`SchemaFallbackTreeItem`.**
    - **Id:** `schema-fallback:<active|archived>:<change>`, so two changes
      naming one missing schema never share one.
    - **Description:** the reason, and that `spec-driven` artifacts are
      shown.
    - **Tooltip:** the detail.
    - **Parent:** its change, through `getWorkbenchParent`.
  - **Both trees** pass `change.schema` to `ChangeTreeItem`.
  - **The new tree test** checks the row order ("Schema:
    nowhere-to-be-found", Proposal, "Spec: web/dashboard-foundation", ADR),
    the row's id and tooltip, and its parent.
- [x] 3.4 The Specs tree opens `openspec/specs/web/dashboard-foundation/spec.md`
  for the id `web/dashboard-foundation`; a test says so.

  Done: a test in `specs-tree.test.ts`. The tree needed no change, since
  `path.join` takes the CLI's id with its slash.
- [x] 3.5 The Timeline, the task checklist, the task templates, the spec-delta
  check and the chat participant still pass their tests unchanged, or are
  updated only where they listed artifacts by the fixed shape.

  Done: none of their files changed.
  - **Core:** all tests pass, 104 files and 1,472 tests (103 and 1,453
    before), and lint passes.
  - **The extension:** 28 files and 378 tests (376 before), and typecheck and
    lint pass.

## 4. Checks

- [x] 4.1 `openspec validate a-change-lists-what-its-schema-declares --strict`
  passes.

  Done on 2026-09-15: "Change 'a-change-lists-what-its-schema-declares' is
  valid", run right before the implementation commit.
- [x] 4.2 `npm run verify` passes, run unpiped. Record each package's count.

  Done on 2026-09-15. `npm run verify` exited 0, with its output written to a
  file.
  - **The root's script tests** report `fail 0`.
  - **Workspace tests:**
    - `@openspec-ui/cli`: 16 files, 161 tests;
    - `@openspec-ui/core`: 104 files, 1,472 tests, then 2 files, 4 tests;
    - `openspec-ui-vscode`: 28 files, 378 tests;
    - `@openspec-ui/server`: 4 files, 100 tests;
    - `@openspec-ui/webui`: 55 files, 491 tests.
- [x] 4.3 The whole standalone browser suite passes: the server reads the same
  discovery.

  Done on 2026-09-15: `npm run test:browser -w @openspec-ui/server`, run
  unpiped with the client rebuilt from this branch. 20 passed in 5.0 minutes.
- [x] 4.4 A changeset: `@openspec-ui/core` minor, `openspec-ui-vscode` minor,
  `@openspec-ui/server` patch.

  Done: `.changeset/a-change-lists-what-its-schema-declares.md`, with those
  three levels and a summary for the extension's changelog. `lint:changesets`
  passes.
- [x] 4.5 A live check in the Extension Development Host, on a workspace with
  DW's layout and schema, with a picture kept outside the repository. The
  change shows Proposal, ADR, Spec: web/dashboard-foundation, Design and
  Tasks in schema order, and nothing reads as missing that exists.

  Done on 2026-09-15, with VS Code 1.137.0 from `.vscode-test` and the
  extension built from this branch.
  - **How.** A one-off Playwright `_electron` spec, not committed, built a
    workspace with DW's layout:
    - a project schema `spec-driven-with-adr` (proposal, adr, specs, design,
      tasks);
    - the change `dashboard-declare-company-derivation`, with `adr.md`,
      `exploration.md` and `specs/web/dashboard-foundation/spec.md`;
    - a second change, `names-a-missing-schema`, whose `.openspec.yaml` names
      a schema that exists nowhere.

    It read each row under both changes from the Changes tree, and kept a
    picture outside the repository.
  - **DW's change:** Proposal, ADR, "Spec: web/dashboard-foundation", Design,
    Tasks, in schema order, none described as missing. `exploration.md` is
    not listed, since the schema does not declare it.
  - **The missing schema:** "Schema: nowhere-to-be-found — not found —
    showing spec-driven artifacts" first, then Proposal, and Design and Tasks
    as missing, which they are.
  - **A first run failed on the check itself, not on the extension.** A
    monaco tree draws only the rows in view, and with every pane expanded the
    Changes pane drew DW's Proposal and ADR and nothing below. The spec now
    collapses every other pane first, and the rerun passed.
