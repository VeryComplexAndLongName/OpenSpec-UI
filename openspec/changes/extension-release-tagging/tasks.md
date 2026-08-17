## 1. CI: tag and release the extension on version bumps

- [x] 1.1 `.github/workflows/quality.yml`: add `release-extension` job
  (`needs: [quality, extension-integration]`,
  `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`,
  `permissions: contents: write`) that reads
  `packages/extension/package.json`'s version, checks whether
  `openspec-ui-vscode@<version>` already exists (`git rev-parse
  --verify`), and if not: builds the VSIX (`npm run package --workspace
  openspec-ui-vscode`), creates and pushes an annotated tag, and runs
  `gh release create <tag> packages/extension/*.vsix --title "..."
  --generate-notes`.
- [x] 1.2 Confirm the job is a genuine no-op on a second run without a
  version change (verified by the tag-existence check's design, exercised
  for real once this lands on `main` and this session's own merge commit
  re-triggers the workflow without a version bump — see task 4).

## 2. Documentation

- [x] 2.1 `README.md`: note where release artifacts live (GitHub
  Releases, tag format `openspec-ui-vscode@<version>`) and that build
  artifacts are never committed into `packages/`.
  Added to the "Versioning" section, right after the release-version
  table.

## 3. Verification

- [x] 3.1 Local dry run of the tag-existence + packaging logic (the
  parts that don't require pushing to GitHub) to catch shell/syntax
  errors before relying on a real CI run to find them.
  Ran the version-read + tag-check shell logic directly (correctly
  reported no existing tag for `openspec-ui-vscode@0.9.0`) and parsed the
  full `quality.yml` with `js-yaml` to confirm the new job's structure is
  syntactically valid YAML.
- [x] 3.2 `openspec change validate --strict extension-release-tagging`
  passes.

## 4. Ship and observe the real trigger

- [ ] 4.1 Commit, push, PR, CI green, merge — same flow as
  `agent-detection`/`ci-cli`.
- [ ] 4.2 After merge, confirm for real: the `release-extension` job ran
  on the merge commit, created tag `openspec-ui-vscode@<version>` for the
  current `packages/extension` version, and published a GitHub Release
  with the `.vsix` attached. Record the actual tag/release URL in
  `smoke-test-notes.md`.
