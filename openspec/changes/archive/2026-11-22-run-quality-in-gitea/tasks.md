# Tasks

- [x] In .gitea/workflows/quality.yml, port the complete named gate inventory
  and the version-PR path; validate its parsed jobs, runtime and dependencies.
- [x] Remove .gitea/workflows/require-changeset.yml after moving its required
  changeset job into quality.yml, so each PR runs one changeset check.
- [x] In scripts/gitea-ci.mjs, reject missing or skipped expected jobs and
  malformed workflow policy; named offline gate refusal tests must pass.
- [x] In scripts/review-dependency-diff.mjs, detect high/critical advisories
  only on changed lockfile nodes and report unavailable audit data explicitly;
  named offline dependency review tests must pass.
- [x] In package.json, include the named policy tests/check in the existing
  quality scripts. No application package or public interface is changed.
- [x] In docs/adr/0060-gitea-quality-gates.md, record trusted-author runner
  limits and the bootstrap decision; strict OpenSpec validation must pass.
- [x] Run node --test scripts/gitea-ci.test.mjs
  scripts/review-dependency-diff.test.mjs, ESLint only these scripts and their
  implementations, YAML parsing and git diff --check; record actual results.

## Delivery evidence

- [x] In scripts/prepare-vscode-test.mjs, download the official editor through
  bounded range requests, verify Microsoft's SHA-256 and retain its real test-electron
  cache. Run its named metadata refusal tests and scoped ESLint. The native
  test suite must still execute in Gitea; a cached editor is not a test result.

- [x] In .gitea/runner/config.yaml and compose.yaml, provide a dedicated
  capacity-one OpenSpec runner scoped to the root owner. Pin both images,
  bound job CPU/memory, refuse arbitrary volumes/privilege and do not mount
  Docker's socket into jobs. Observed runner id 24 online; job 8857 in run 6701 uses it. Live Docker inspection confirms Binds=[], privileged=false, memory=6442450944 and NanoCpus=2000000000.

Full Gitea checks, required review, main merge and the separate archive remain
required. Record run links in evidence.md. This section does not claim them
complete based on local policy tests. Do not disable GitHub or remove this
worktree until its needed commits and archive are in authoritative main.
