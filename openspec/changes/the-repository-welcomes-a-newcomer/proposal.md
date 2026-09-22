## Why

The owner asked on 2026-09-22, as part of a growth push, to fix what a
newcomer sees before they read a line of documentation. Two things checked
out plainly wrong:

- `repos/.../community/profile` reports 57% health: no `CONTRIBUTING.md`, no
  issue or pull request template, no `CODE_OF_CONDUCT.md`. A person who
  arrives from a Show HN thread or a Reddit link decides whether to open an
  issue or spend an evening on a pull request partly from this, and right
  now there is nothing to read.
- The VS Code Marketplace listing carries `categories: ["Other"]` and three
  generic keywords (`openspec`, `spec-driven`, `workflow`). "Other" is the
  Marketplace's own catch-all for an extension nobody could otherwise place,
  and it is what a person filtering the Extensions view by category never
  sees. The extension's own `description` field already names its agents
  correctly (updated by `deepseek-joins-as-an-acp-agent`); its `categories`
  and `keywords` were not touched in the same pass.

Repository-level fixes (description, topics, homepage, the social preview
image) were done directly through GitHub's own settings on 2026-09-22, since
none of those live in a tracked file; this change covers what does.

## What Changes

- **`CONTRIBUTING.md`**, pointing a contributor at the real process: read
  `openspec/README.md`'s runbook first, every change goes through
  `openspec/changes/<id>/`, the checks in `package.json`'s `verify` script,
  and that AI-assisted contributions are welcome if disclosed and tested -
  matching the standard this project already holds itself to.
- **`.github/ISSUE_TEMPLATE/bug_report.md`** and
  **`.github/ISSUE_TEMPLATE/feature_request.md`**, short enough that filing
  one costs less than staying silent.
- **`.github/PULL_REQUEST_TEMPLATE.md`**, asking for the change id and which
  checks were run - nothing this project's own reviewers would not already
  ask.
- **`CODE_OF_CONDUCT.md`**, the Contributor Covenant, unmodified, the
  version most newcomers already recognize.
- **`packages/extension/package.json`**: `categories` becomes
  `["Machine Learning", "Other"]` - confirmed against VS Code's documented
  category list, which does not include "AI" or "Chat" as of this writing,
  so this change does not guess an unlisted value. `keywords` becomes
  `["openspec", "spec-driven-development", "ai-agents", "coding-agent",
  "workflow"]`, matching the terms already chosen for the GitHub repository's
  own topics.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none - a Marketplace listing's categories and keywords, and community
files, change nothing the product does)

## Impact

- New: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`,
  `.github/ISSUE_TEMPLATE/bug_report.md`,
  `.github/ISSUE_TEMPLATE/feature_request.md`,
  `.github/PULL_REQUEST_TEMPLATE.md`.
- `packages/extension/package.json` (`categories`, `keywords`).
- A changeset (`openspec-ui-vscode`, patch): the Marketplace listing
  changes on the next release.

## Explicitly out of scope

- **The extension's `description` field.** Already correct as of
  `deepseek-joins-as-an-acp-agent`; not touched again here.
- **GitHub's own repository settings** (description, topics, homepage,
  social preview image). Done directly on 2026-09-22; nothing here to
  track in git, since none of it is a file.
- **A `SECURITY.md` or a governance document beyond the Code of Conduct.**
  Asked for community-health basics, not a full policy set.
