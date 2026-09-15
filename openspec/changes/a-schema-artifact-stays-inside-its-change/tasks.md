Follows `a-change-lists-what-its-schema-declares` (ADR 0031), whose defects
DW, a user of the VS Code extension, reported. The points below come from an
external review of that change on 2026-09-15, each checked against
`intent-driven-dev/openspec-schemas`.

## 1. Real schemas as fixtures

- [x] 1.1 `packages/core/src/fixtures/openspec-schemas/` holds byte-for-byte
  copies of the following, with the repository's MIT `LICENSE` and a README
  recording the source, the commits and why each copy is there:
  - `spec-driven-with-adr`, `event-driven` and `minimalist` at `4bb6de2`;
  - `spec-driven-with-adr` at `f04aaa2`.

  Done on 2026-09-15.
  - **Where the files came from.** Downloaded with
    `gh api …/contents/openspec/schemas/<name>/schema.yaml` (raw), at `main`
    `4bb6de2` for the three current schemas and at `?ref=f04aaa2` for the
    old one.
  - **What the repository holds.** The schema list and the history of
    `spec-driven-with-adr` were read the same way: `f14d1d5` added it,
    `3fc8916` removed the ADR folder parameter, `f04aaa2` set
    `"../../../adr/*.md"`, and `b320db8` moved `adr.md` back inside the change.
  - **Proof they are unchanged.** Each committed blob hash equals the one
    GitHub reports for the source file:
    - `spec-driven-with-adr`: `5e65a43`, 11,537 bytes;
    - `event-driven`: `0e33355`, 3,655 bytes;
    - `minimalist`: `2884be4`, 493 bytes;
    - `spec-driven-with-adr` at `f04aaa2`: `13d8547`, 10,661 bytes;
    - `LICENSE`: `14fac91`, 1,056 bytes, MIT.

    A Windows checkout shows larger files, because `core.autocrlf` writes
    CRLF there. The repository holds the upstream bytes.
  - **Using them.** `src/test-support/openspec-schema-fixtures.ts`
    (`installSchemaFixture`) copies one into a temporary project's
    `openspec/schemas/<name>/`.

## 2. Files outside the change

- [x] 2.1 `discoverChangeArtifacts` lists no file outside the change's own
  directory: by path for `..`, and by real path for a link. A plain path
  reaching outside is not listed as missing either.

  Done in `change-schema.ts`, where every file is named, so `workbench.ts`,
  readiness and the agent prompt all get the same list.
  - **Plain paths.** `resolveGenerates` returns a plain path only when it
    stays inside the change, by path and, if the file exists, by real path.
  - **Globs.** Each glob match is checked the same way.
- [x] 2.2 `resolveGenerates` does not walk a literal prefix that leaves the
  change directory.

  Done: a glob whose fixed part resolves outside the change returns nothing
  without reading the directory.
- [x] 2.3 Tests:
  - `spec-driven-with-adr` at `f04aaa2`, with ADRs in the repository's
    `adr/`, lists nothing outside the change;
  - a junction inside a change pointing outside lists nothing from there.

  Done.
  - **`workbench.test.ts`.** The `f04aaa2` fixture, with two ADRs in the
    project's `adr/`, lists Proposal, Design and Tasks, and no path starting
    with `..`. A junction at `specs/borrowed` lists no delta spec.
  - **`change-schema.test.ts`.** `resolveGenerates` returns nothing for
    `../../../adr/*.md`, for `../../../adr/0001-first.md`, or for a spec
    reached through a junction, and still returns `proposal.md`.

## 3. Tests on the real schemas

- [x] 3.1 `spec-driven-with-adr` on DW's layout lists Proposal,
  `web/dashboard-foundation`, Design, ADR, Tasks.

  Done in `workbench.test.ts`. The change also holds `exploration.md`, and the
  test asserts it is not listed.
- [x] 3.2 `event-driven` lists its six artifacts in schema order, with
  today's labels pinned ("Asyncapi").

  Done: Event storming, Event modeling (missing), `orders`, Design (missing),
  Asyncapi, Tasks (missing).
- [x] 3.3 `minimalist` lists `specs/checkout/spec.md` as the delta spec
  `checkout`, and a flat `specs/landing-page.md` by its path, not as a
  delta spec.

  Done: `delta-spec:checkout`, then `specs:specs/landing-page.md` as a
  `schema-artifact` labelled `specs/landing-page.md`, then Tasks.
- [x] 3.4 The invented schema in `change-schema.test.ts`, `workbench.test.ts`
  and `security.test.ts` is replaced by the fixture copies.

  Done.
  - `change-schema.test.ts` now expects the real order: proposal, specs,
    design, adr, tasks.
  - The shadowing and caching tests install the fixture.
  - `security.test.ts` embeds `adr.md` and the nested delta under the real
    schema.

## 4. The archived change's documents

- [x] 4.1 In
  `openspec/changes/archive/2026-09-15-a-change-lists-what-its-schema-declares/`:
  - `design.md` no longer names exploration notes as a goal;
  - `proposal.md` no longer reads as though `exploration.md` would appear;
  - task 4.5's record notes that the probe's order was invented, and that the
    real order is proposal, specs, design, adr, tasks.

  Done: each correction names this change.

## 5. Checks

- [x] 5.1 `openspec validate a-schema-artifact-stays-inside-its-change --strict`
  passes.

  Done on 2026-09-15.
- [x] 5.2 `npm run verify` passes, run unpiped. Record each package's count.

  Done on 2026-09-15. `npm run verify` exited 0, with its output written to a
  file.
  - **The root's script tests** report `fail 0`.
  - **Workspace tests:**
    - `@openspec-ui/cli`: 16 files, 161 tests;
    - `@openspec-ui/core`: 104 files, 1,477 tests, then 2 files, 4 tests;
    - `openspec-ui-vscode`: 28 files, 378 tests;
    - `@openspec-ui/server`: 4 files, 100 tests;
    - `@openspec-ui/webui`: 55 files, 491 tests.
- [x] 5.3 A changeset: `@openspec-ui/core` patch, `openspec-ui-vscode` patch.

  Done: `.changeset/a-schema-artifact-stays-inside-its-change.md`.
- [x] 5.4 `lint:english` after `git add`, `lint:test-budgets` and
  `lint:source-text` pass.

  Done: `lint:english` and `lint:changesets` passed with the change staged,
  right before its commit. `lint:test-budgets` and `lint:source-text` passed
  earlier, and the copied schemas' non-ASCII arrows pass the source-text
  check.
