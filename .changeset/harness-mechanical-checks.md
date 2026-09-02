---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"openspec-ui-vscode": minor
---

Add mechanical task checks to the harness's `verify` stage, and stop
offering an agent for the mechanical `archive` stage.

- New closed registry (`mechanical-checks.ts`) of named checks
  (`validate-change`, `typecheck`, `test`, `lint`, `path-unchanged`,
  `changeset-present`) a `tasks.md` task line may declare via a
  `` `check(name[, param])` `` inline-code span.
- The `verify` chain stage now runs every declared check before invoking
  its agent: a failing check skips the agent entirely and names which
  checks failed; a passing check marks its own task `[x]` and is
  summarized in the agent's prompt so it is not re-run. An agent's own
  report never marks a task that carries a check.
- `stepAgents` no longer accepts an `archive` entry — `archive` is a real
  stage but a mechanical one, invoking no agent. A configuration that
  already sets `stepAgents.archive` is read with that entry dropped and a
  warning, not rejected.
- `HarnessSettingsView` (webui) and the extension's change-template wizard
  (`commands.ts`) still show `archive` as part of the stage sequence, but
  no longer offer an agent or model picker for it.
