## 1. Core: content registry and marker-based writers

- [x] 1.1 `packages/core/src/repo-bootstrap.ts`: `BootstrapProjectType =
  "node" | "python"`, `BootstrapSubtype = "backend" | "frontend" |
  "general"`; a small built-in content registry (agent-instructions body,
  dependabot ecosystem id, per-subtype instructions body) for both seed
  types.
- [x] 1.2 Section-marker helper: given a target file path and a desired
  managed-block body, if the file doesn't exist, create it with the
  block; if it exists and contains the exact start/end markers, replace
  only the block, preserving everything before/after; if it exists
  without the markers, return "not managed" without writing.
- [x] 1.3 `writeAgentInstructions(workspaceRoot, projectType)`: applies
  the section-marker helper to both `CLAUDE.md` and `AGENTS.md`
  independently, returns which of the two were actually written vs.
  skipped-as-foreign.
- [x] 1.4 `writeSubtypeInstructions(workspaceRoot, projectType,
  subtype)`: applies the section-marker helper to
  `.github/instructions/<subtype>.instructions.md`, with `applyTo: "**"`
  frontmatter ahead of the managed block (frontmatter is only rewritten
  when the file is being freshly created or is already ours).
- [x] 1.5 `writeDependabotConfig(workspaceRoot, projectTypes)`:
  whole-file marker check (first line); if foreign, no-op and report;
  otherwise scans the current file (if present) for already-included
  `package-ecosystem` ids, unions with the requested type(s) plus
  `github-actions`, and re-emits the whole file from canonical
  per-ecosystem blocks in a stable order.
- [x] 1.6 `repo-bootstrap.test.ts`: covers all three writers — fresh
  create, foreign-file no-op, regenerate-preserves-content-outside-
  markers, and dependabot's cross-invocation ecosystem accumulation. 9/9
  tests passing.
- [x] 1.7 Export from `packages/core/src/index.ts`.

## 2. Extension: commands

- [x] 2.1 `commands.ts`: `openspec-ui.generateAgentInstructions` —
  `showQuickPick(["node", "python"])`, calls `writeAgentInstructions`,
  opens whichever file(s) were actually written, reports any skipped-
  as-foreign file(s) as a warning.
- [x] 2.2 `commands.ts`: `openspec-ui.configureDependabot` —
  `showQuickPick(["node", "python"], { canPickMany: true })`, calls
  `writeDependabotConfig`, opens the file or reports the foreign-file
  warning.
- [x] 2.3 `commands.ts`: `openspec-ui.generateSubtypeInstructions` —
  `showQuickPick` for project type, then `showQuickPick(["backend",
  "frontend", "general"])` for subtype, calls
  `writeSubtypeInstructions`, opens the file or reports the warning.
- [x] 2.4 `package.json`: register all three commands (Command Palette
  only — no tree-item scoping, these are workspace-level actions).
- [x] 2.5 `commands.test.ts`: each command's QuickPick flow, the
  foreign-file warning path, and that the resulting file(s) open on
  success. 7 new tests, 40/40 extension command tests passing.

## 3. Verification, versioning, and smoke test

- [x] 3.1 `npm run typecheck && npm run lint && npm run test` passes for
  `packages/core`, `packages/extension`. Re-run `npm run verify` after
  `git add`/commit of all new files.
  Ran (post-`git add`) — 404 tests passing across all five workspaces,
  clean typecheck, no new lint errors (one pre-existing unrelated
  warning in `standalone-entry.tsx`). Confirmed independently by CI's
  own "Typecheck, lint, test, and build" job.
- [x] 3.2 Bump `package.json` versions (minor) for `@openspec-ui/core`,
  `openspec-ui-vscode`. core 0.17.0 → 0.18.0, extension 0.11.0 → 0.12.0.
  Also added a `packages/extension/CHANGELOG.md` 0.12.0 entry, extension
  README Features bullet, and root README version table.
- [x] 3.3 Manual smoke test: run the core writers for real against a
  scratch temp workspace — fresh creation of `CLAUDE.md`/`AGENTS.md`,
  foreign-file detection, regeneration preserving user content,
  `dependabot.yml` ecosystem accumulation across two calls — and record
  actual output in `smoke-test-notes.md`. VS Code command wiring
  verified via `npm run test:integration` (real Extension Host).
  All 5 real scenarios confirmed exactly as designed; real
  `@vscode/test-electron` run 6/6 passing. Full detail in
  `smoke-test-notes.md`.
- [x] 3.4 `openspec change validate --strict repo-bootstrap-snippets`
  passes.
