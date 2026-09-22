Asked by the owner on 2026-09-22, as part of a growth push: fix what a
newcomer sees before a line of documentation.

## 1. Community files

- [ ] 1.1 `CONTRIBUTING.md`: the runbook, the OpenSpec-change requirement,
  the checks in `verify`, and the AI-disclosure expectation.
- [ ] 1.2 `.github/ISSUE_TEMPLATE/bug_report.md` and
  `feature_request.md`.
- [ ] 1.3 `.github/PULL_REQUEST_TEMPLATE.md`.
- [ ] 1.4 `CODE_OF_CONDUCT.md` (Contributor Covenant, unmodified).

## 2. The Marketplace listing

- [ ] 2.1 `packages/extension/package.json`: `categories` to
  `["Machine Learning", "Other"]`, `keywords` to `["openspec",
  "spec-driven-development", "ai-agents", "coding-agent", "workflow"]`.
- [ ] 2.2 A changeset: `openspec-ui-vscode`, patch.

## 3. Checks

- [ ] 3.1 `npm run lint` after `git add`, and `npm run test` at the root,
  one suite at a time.
- [ ] 3.2 `openspec validate the-repository-welcomes-a-newcomer --strict`.
