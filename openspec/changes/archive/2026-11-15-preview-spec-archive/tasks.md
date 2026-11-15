## 1. Preview specification updates

- [x] 1.1 Read the baseline, committed delta and other local branch claims. Produce the patch from an isolated archive and show overlaps and refusals. Verify the user repository is unchanged.
- [x] 1.2 Expose Show Archive Preview through Core change actions, standalone and the VS Code command. Verify it opens a read-only report.
- [x] 1.3 Add authored release notes for VS Code and standalone.

## 2. Verification

- [x] 2.1 Run strict OpenSpec validation, targeted archive preview and change action tests, lint the changed paths and check affected TypeScript projects. Exercise a real OpenSpec preview and both hosts.


## Verification evidence

- Fifteen targeted Vitest cases passed across the archive preview, change actions and message register. The separate local run with OPENSPEC_UI_REAL_ARCHIVE_PREVIEW=1 used OpenSpec 1.13.2 and verified the patch, overlapping titles and unchanged Git refs and working tree.
- ESLint for the changed TypeScript, the affected Core, standalone and extension TypeScript projects, Changesets and strict OpenSpec validation passed.
- Standalone Playwright "opens an isolated specification archive preview" and VS Code 1.145.2 "opens Archive Preview without running archive in the workspace" passed.
