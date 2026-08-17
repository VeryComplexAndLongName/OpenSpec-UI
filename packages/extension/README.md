# OpenSpec Workbench for VS Code

OpenSpec Workbench brings the complete OpenSpec change workflow into VS Code.
It uses native tree views, markdown editors, diffs, Source Control, Chat, and
notifications while keeping lifecycle and security behavior in
`@openspec-ui/core`.

## Features

- Navigate `config.yaml`, active changes, archived changes, canonical specs,
  and every proposal, design, task list, and delta spec.
- Create, validate, archive, unarchive, and delete changes from contextual
  actions with confirmation for destructive operations. Expand a change to
  see its individual `tasks.md` checklist items; select one to jump to it
  in the editor, or delete it (active changes only) with confirmation.
- See queued, running, completed, failed, cancelled, interrupted, and
  rolled-back operations in the Processes view. Read-only work can run in
  parallel; workspace mutations are serialized to keep checkpoints isolated.
- Use `@openspec` in VS Code Chat with `/plan`, `/implement`, `/review`,
  `/status`, and `/validate`.
- Or run `plan`/`implement`/`review` directly from the Process Dashboard's
  own agent picker (Claude CLI, GitHub Copilot CLI, Codex CLI, Gemini CLI,
  or a local OpenAI-compatible LLM) — a separate mechanism from VS Code
  Chat, see "Agents" below.
- Recover process history and checkpointed runs after extension reload. Start
  VS Code Agent implementation sessions, finish them for review, and roll back
  only files changed by a run. Rollback refuses to overwrite later edits and
  discloses files omitted by checkpoint size limits.
- Open the Process Dashboard with Workspace root and Change directory filled
  from the current VS Code workspace. The default message-bridge dashboard
  follows the active VS Code color theme, including dark and high-contrast
  themes.
- Open native markdown and diff editors instead of custom replacements.
- Browse built-in and project-level change templates in the Templates
  view. Customize a built-in template into your project (keeping a
  backlink to the version it was forked from), insert a rendered
  template into any active change, or delete a project-level template
  with confirmation — built-in templates ship as part of the extension
  and are never deletable through the UI.
- Bootstrap repository files from the Command Palette, for a picked
  project type (Node.js/TypeScript or Python): agent instructions
  (`CLAUDE.md`/`AGENTS.md`), `.github/dependabot.yml`, and path-scoped
  `.github/instructions/<subtype>.instructions.md`. Any of these commands
  leaves an existing file alone (and tells you so) if it wasn't created
  by this extension — never overwrites hand-written content.

## Requirements

- VS Code 1.90 or newer.
- OpenSpec CLI available as `openspec` on `PATH`.
- A workspace containing `openspec/config.yaml`, or initialize OpenSpec from
  the CLI before using the Workbench.
- VS Code Chat and an available language model for `/plan`, `/implement`, and
  `/review`. Deterministic lifecycle, status, and validation actions do not
  require AI.

## Workflow

1. Open the OpenSpec activity-bar container.
2. Create or expand a change in **Changes**.
3. Edit Proposal, Design, Tasks, and delta Specs in native editors.
4. Run Validate, then choose **Implement with VS Code Agent** — this runs
   through VS Code's own Copilot Chat, using whatever model is selected
   in Chat's own model picker. If you specifically want a particular CLI
   agent (e.g. the real Anthropic Claude Code CLI, not Claude via
   Copilot) to make the change instead, use **OpenSpec UI: Open Process
   Dashboard** and its own agent picker instead — see "Agents" below.
5. Follow the run in **Processes**. When Agent work is done, choose
   **Finish Implementation & Review**.
6. Review native diffs, roll back the checkpoint if needed, or archive the
   completed change. Archiving creates or updates canonical specs.

## Chat

Enter `@openspec` and choose a slash command. The first argument must be an
active change id:

```text
@openspec /review openspec-workbench focus on rollback safety
```

## Agents

To run `plan`/`implement`/`review` through a specific CLI agent (Claude
CLI, GitHub Copilot CLI, Codex CLI, Gemini CLI, or a local
OpenAI-compatible LLM) instead of VS Code's native Chat/Agent handoff:

1. Run **OpenSpec UI: Open Process Dashboard** from the Command Palette
   (or the toolbar button on a change in **Changes**).
2. In the panel, pick `implement` (or `plan`/`review`) from the command
   dropdown.
3. Pick the agent you want from the agent dropdown next to it — each
   option shows a best-effort detected/not-detected badge.
4. Click **Run**.

This picker is independent of VS Code Chat: it runs the command through
this extension's own CLI-agent protocol (`@openspec-ui/core`'s
`buildDefaultAgentRunners`), resolved at activation from the open
workspace. Each listed CLI tool (`claude`/`copilot`/`codex`/`gemini`)
must already be installed and authenticated on the machine separately —
the extension never handles API keys itself. If a tool is missing, the
run fails immediately with a clear error instead of hanging. This works
the same way in both the default message-bridge dashboard and the
optional local-server mode
(`openspec-ui.transport.localServer.enabled`). None of these tools need a
VS Code extension or any VS Code-specific setup — a plain CLI login is
enough, the same as using it from a terminal. See the root repository
`README.md`'s "Agent Selection" section for the full picture, including
how this differs from the `@openspec` Chat Participant above.

## Settings

- `openspec-ui.transport.localServer.enabled`: use the optional standalone
  REST/WS shell inside the dashboard. The default extension path imports core
  directly and uses an in-process message bridge. Because the optional
  localhost shell is a cross-origin iframe, it retains the standalone palette
  instead of inheriting VS Code theme variables.

## Development

```bash
npm run typecheck --workspace openspec-ui-vscode
npm run lint --workspace openspec-ui-vscode
npm run test --workspace openspec-ui-vscode
npm run build --workspace openspec-ui-vscode
npm run test:integration --workspace openspec-ui-vscode
```
