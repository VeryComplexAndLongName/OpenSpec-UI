## 1. Extension changelog

- [x] 1.1 Add a `0.5.0` entry to `packages/extension/CHANGELOG.md`
  summarizing `standalone-shell-host-aware-tabs`: the optional
  local-server Webview now shows only "Run a Command" (other sections
  already covered natively); the standalone shell itself gained tab
  navigation.
- [x] 1.2 Add a `0.6.0` entry summarizing `archive-tasks-as-template`:
  "Copy Tasks as Template Into…" on archived changes in the Archive tree.
- [x] 1.3 Add a `0.7.0` entry summarizing `agent-selection`: the Process
  Dashboard's AI panel can now run `plan`/`implement`/`review` through a
  selectable CLI agent (Claude/Copilot/Codex/Gemini/local LLM), in both
  the default message-bridge mode and the optional local-server mode.
- [x] 1.4 Add a `0.8.0` entry summarizing `template-catalog`: a new
  Templates view (built-in + project-level), "Customize" to fork a
  built-in template into the project, and "Insert Template Into…" to
  apply a rendered template to a change.

## 2. Root README

- [x] 2.1 Update `README.md`'s package version table to the current real
  versions (`@openspec-ui/core`, `openspec-ui-vscode`,
  `@openspec-ui/server`, `@openspec-ui/webui`).

## 3. Verification

- [x] 3.1 `openspec change validate --strict changelog-sync` passes.
