Follows `a-schema-artifact-stays-inside-its-change`, which deferred these
labels, and ADR 0031. The two labels were raised by an external review on
2026-09-15.

## 1. Labels in core

- [x] 1.1 `labelForSchemaArtifact` writes a word of the id that is in the
  known-terms table as the table spells it. The whole-id rule for three
  letters or fewer comes first.

  Done in `workbench.ts` (`KNOWN_TERMS`).
- [x] 1.2 A glob-matched file that is not a delta spec is labelled
  `<artifact label>: <path under the glob's fixed folder>`. With no fixed
  folder, the whole relative path follows the colon.

  Done: `artifactLabel` and `pathUnderFixedFolder` in `workbench.ts`.
- [x] 1.3 `WorkbenchArtifact.notAppliedOnArchive` is `true` for a listed file
  under `specs/` that is not a delta spec, and absent otherwise.

  Done. The mark is set in each branch other than a delta spec, so a plain
  path under `specs/` is marked too.
- [x] 1.4 Tests in `workbench.test.ts`:
  - `labelForSchemaArtifact`: `adr`, `asyncapi`, `openapi-contract`,
    `event-storming`, `use-cases`;
  - `event-driven` lists AsyncAPI;
  - `minimalist` lists "Specs: landing-page.md", marked not applied, and the
    delta spec `checkout` unmarked;
  - `specs/spec.md` at the root and `specs/checkout/notes.md` are marked;
  - `spec-driven-with-adr` on DW's layout is unchanged.

  Done on 2026-09-15.
  - **`labelForSchemaArtifact`** reads `adr`, `asyncapi`, `openapi-contract`,
    `api_design`, `event-storming`, `use-cases` and `tech-notes` as ADR,
    AsyncAPI, "OpenAPI contract", "API design", "Event storming",
    "Use cases" and "Tech notes".
  - **`event-driven`** lists `asyncapi` as AsyncAPI.
  - **`minimalist`** has `specs/checkout/spec.md`, `specs/checkout/notes.md`,
    `specs/landing-page.md` and a root `specs/spec.md`. The three files other
    than the delta spec read "Specs: checkout/notes.md",
    "Specs: landing-page.md" and "Specs: spec.md", and each is marked; the
    delta spec `checkout` is not.
  - **DW's layout test** passes unchanged.
  - **Checks run.** Core typecheck and lint pass. `workbench`, `change-schema`,
    `security`, `change-readiness`, `change-timeline` and `spec-delta-check`
    pass: 124 tests in 6 files.

## 2. The Changes tree

- [x] 2.1 An artifact marked not applied on archive shows the description
  "not applied on archive", the `warning` icon, and a tooltip naming the rule.

  Done in `ArtifactTreeItem`, with a new last constructor parameter. "missing"
  still wins for a file that does not exist.
- [x] 2.2 A test in `changes-tree.test.ts` covers a marked row and an unmarked
  one.

  Done. The extension's typecheck and lint pass, and `changes-tree` and
  `specs-tree` pass: 19 tests in 2 files.

## 3. Checks

- [x] 3.1 `openspec validate an-artifact-label-says-what-it-is --strict`
  passes.

  Done on 2026-09-15.
- [x] 3.2 `npm run verify` passes, run unpiped. Record each package's count.

  Done on 2026-09-15. `npm run verify` exited 0, with its output written to a
  file.
  - **Root script tests** report `fail 0`.
  - **Workspace tests:**
    - `@openspec-ui/cli`: 16 files, 161 tests;
    - `@openspec-ui/core`: 104 files, 1,478 tests, then 2 files, 4 tests;
    - `openspec-ui-vscode`: 28 files, 379 tests;
    - `@openspec-ui/server`: 4 files, 100 tests;
    - `@openspec-ui/webui`: 55 files, 491 tests.
- [x] 3.3 A changeset: `@openspec-ui/core` minor (a new optional field),
  `openspec-ui-vscode` patch.

  Done: `.changeset/an-artifact-label-says-what-it-is.md`.
- [x] 3.4 `lint:english` after `git add`, `lint:changesets`,
  `lint:test-budgets` and `lint:source-text` pass.

  Done on 2026-09-15, with the change staged.
- [x] 3.5 Live check in the Extension Development Host. Use a workspace with an
  `event-driven` change and a `minimalist` change holding
  `specs/landing-page.md`. The Changes tree shows AsyncAPI, and
  "Specs: landing-page.md" with "not applied on archive". Record a screenshot
  path.

  Done on 2026-09-15.
  - **Setup.** VS Code 1.137.0 from `packages/extension/.vscode-test`, with the
    extension built from this branch and driven by Playwright `_electron`
    (a scratch spec, not committed). The schemas are the core fixture copies.
  - **Result.** It passed in 6.0 minutes.
    - `landing` lists "Spec: checkout", then "Specs: landing-page.md" described
      "not applied on archive" with the warning icon, then Tasks.
    - `order-events` lists Event storming, Event modeling (missing),
      "Spec: orders", Design (missing), AsyncAPI, Tasks (missing).
  - **Screenshot.** `labels-check/labels-check-changes-tree.png` in the
    session scratchpad. At the default side bar width the description is cut
    to "not applied o…"; the tooltip carries the full rule.
