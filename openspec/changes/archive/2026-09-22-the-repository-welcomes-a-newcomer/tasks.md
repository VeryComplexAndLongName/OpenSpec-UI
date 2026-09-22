Asked by the owner on 2026-09-22, as part of a growth push: fix what a
newcomer sees before a line of documentation.

## 1. Community files

- [x] 1.1 `CONTRIBUTING.md`: the runbook, the OpenSpec-change requirement,
  the checks in `verify`, and the AI-disclosure expectation.
- [x] 1.2 `.github/ISSUE_TEMPLATE/bug_report.md` and
  `feature_request.md`.
- [x] 1.3 `.github/PULL_REQUEST_TEMPLATE.md`.
- [x] 1.4 `CODE_OF_CONDUCT.md` (Contributor Covenant, unmodified).

  The enforcement contact is the maintainer's GitHub profile and a private
  security advisory on this repository - the template's own placeholder
  asks for a contact method, and no email address was published here
  without being asked first.

## 2. The Marketplace listing

- [x] 2.1 `packages/extension/package.json`: `categories` to
  `["Machine Learning", "Other"]`, `keywords` to `["openspec",
  "spec-driven-development", "ai-agents", "coding-agent", "workflow"]`.

  "AI" and "Chat" were considered and rejected: VS Code's own documented
  category list (code.visualstudio.com/api/references/extension-manifest,
  read 2026-09-22) does not include them, so this does not ship an
  unlisted value on a guess.
- [x] 2.2 A changeset: `openspec-ui-vscode`, patch.

## 3. Checks

- [x] 3.1 `npm run lint` after `git add`, and `npm run test` at the root,
  one suite at a time.

  Done 2026-09-22: `lint` green. `test` green at the root (1798 core tests,
  651 webui, 492 extension, 114 cli, 175 server, all passing) once run
  without another heavy process competing for the machine at the same
  time - a first pass, run alongside unrelated background work, flaked on
  a timing-sensitive core test that passed cleanly alone and on a clean
  re-run.
- [x] 3.2 `openspec validate the-repository-welcomes-a-newcomer --strict`.

  Done 2026-09-22: "Change 'the-repository-welcomes-a-newcomer' is valid".
