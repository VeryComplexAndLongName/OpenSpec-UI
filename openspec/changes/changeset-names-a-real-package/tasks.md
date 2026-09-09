Found on `main`, three merges after it landed, because the job that would
have caught it is skipped on pull requests.

## 1. The fix

- [x] 1.1 `.changeset/configurations-named-by-effort.md` names
  `openspec-ui-vscode`, the package, rather than `@openspec-ui/extension`,
  the directory. The bump itself was right: that change altered the
  extension.

## 2. The check

- [x] 2.1 Every name in every changeset must resolve to a workspace
  package, in `npm run lint`.
- [x] 2.2 The known names are read from the workspace, not written down
  beside the check.
- [x] 2.3 The failure names the file, the unknown package, and what the
  workspace does have — an error that only says "not in the workspace"
  leaves the reader to find the right spelling themselves.

## 3. Tests

- [x] 3.1 Proved against the real defect: a changeset naming
  `@openspec-ui/extension` fails the check, and the repository as it
  stands passes it.

## 4. Verification

- [x] 4.1 `openspec validate --strict --changes`.
- [x] 4.2 `npm run verify` unpiped, after the last edit, with everything
  staged.
  Run 2026-09-09: exit 0, including the new check — 48 cli, 796 core,
  302 extension, 68 server, 338 webui.
- [ ] 4.3 Watch the release job on `main` after the merge — it is the
  only place this failure was ever visible.
