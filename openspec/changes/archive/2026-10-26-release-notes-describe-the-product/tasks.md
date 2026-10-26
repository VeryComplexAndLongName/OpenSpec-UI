## 1. Policy and copy

- [x] 1.1 Record product-facing release-note decisions in docs/adr/0054-release-notes-belong-to-the-product.md.
- [x] 1.2 Update openspec/config.yaml so proposal, task and operation instructions require concise Changelog copy and affected public delivery changesets.
- [x] 1.3 Document note examples and the historical-copy correction boundary in .changeset/README.md.
- [x] 1.4 Add the release-note policy pointer to openspec/README.md.
- [x] 1.5 Correct Codex and usage notes in packages/extension/CHANGELOG.md without changing versions or references.
- [x] 1.6 Correct Codex and usage notes in packages/server/CHANGELOG.md without changing versions or references.
- [x] 1.7 Add the Codex announcement to packages/cli/CHANGELOG.md for its current source package version.
- [x] 1.8 Create a concise Changesets entry naming all three public deliveries for the next generated product notes.

## 2. Release pipeline

- [x] 2.1 Extend scripts/check-changesets.mjs to reject empty, placeholder and over-80-word named summaries while allowing intentional empty changesets.
- [x] 2.2 Update packages/cli/src/release-manifest.ts to preserve wrapped notes and expose version-matched authored Highlights.
- [x] 2.3 Add packages/cli/scripts/write-release-notes.ts to generate Highlights and validate the current notes of public products.
- [x] 2.4 Update .github/workflows/quality.yml to validate version-PR notes and generate release Highlights before creating a tag, retaining generated history.

## 3. Targeted verification and publication

- [x] 3.1 Run scripts/check-changesets.test.mjs including placeholder, empty and length-boundary regressions.
- [x] 3.2 Run packages/cli/src/release-manifest.test.ts including wrapped notes, product visibility and Highlights cases.
- [x] 3.3 Run scripts/release-notes.test.mjs for the real generator, public-note guard, and workflow ordering/arguments.
- [x] 3.4 Run scripts/check-openspec-config.test.mjs and inspect real proposal/tasks instructions for this change.
- [x] 3.5 Run the CLI TypeScript check and lint only changed source paths; scan authored files for English, control bytes and whitespace.
- [x] 3.6 Validate release-notes-describe-the-product strictly and exercise generation/check mode against the corrected product changelogs.
- [x] 3.7 Prepend prepared Codex/usage highlights to GitHub releases 0.106.3 and 0.106.4, preserving original bodies, tags and assets; record verified readback evidence.

## Verification evidence

- `node --test scripts/check-changesets.test.mjs scripts/release-notes.test.mjs scripts/check-openspec-config.test.mjs`
  passed 22 tests. The added 80-word boundary test passed separately, making
  15 changeset, four release-note and four config tests. Before the fix,
  four summary regressions and the wrapped-product-note regression failed.
- `vitest run src/release-manifest.test.ts` in packages/cli passed 24 tests,
  including complete public-product notes and Core remaining non-public.
- The selected `workflow as written` test in
  scripts/check-publish-workflow.test.mjs passed. Workflow tests confirm
  version-note validation and generation before tags, with notes-file plus
  generated history. The real note generator's --check mode passed for
  this checkout, and Highlights for 0.106.3/0.106.4 were generated from
  the corrected version sections.
- CLI TypeScript checking and ESLint on the six changed source/test paths
  passed. Real OpenSpec proposal/tasks instructions contained Changelog,
  product-scope and brevity rules. Strict change validation passed.
- Scoped English, control-byte and test-budget checks passed for all 22
  authored files; whitespace checks passed. Only targeted local checks ran.
- Historical changelog headings and original commit/dependency reference
  lines were compared to HEAD and are unchanged in all three files.
- On 2026-10-24, GitHub release readbacks verified the prepared Highlights
  in [0.106.3](https://github.com/VeryComplexAndLongName/OpenSpec-UI/releases/tag/openspec-ui-vscode%400.106.3)
  and [0.106.4](https://github.com/VeryComplexAndLongName/OpenSpec-UI/releases/tag/openspec-ui-vscode%400.106.4).
  Each original body remains its exact suffix; publication dates, tag
  objects, and asset ids/names/sizes/digests are unchanged. Prepared bodies,
  original release JSON/tag refs and verified metadata were saved under
  this worktree's ignored .openspec-ui/release-note-repair directory.

Full verification remains pending CI. No full local suite was run.
