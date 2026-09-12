`HARNESS.md` answers "what does this key accept". Nothing answers "I
want to do this one thing" in fewer than a page of reading.

## 1. The pages

Each page states the goal, names the file it edits, gives at most two
steps, shows the JSON object it writes, and links `HARNESS.md` for the
detail. A page that needs a third step is not padded — see 3.1.

- [x] 1.1 `docs/how-to/run-a-change-unattended.md`: `autonomyLevel`,
  `checkpoints.requireConfirmationBetweenSteps`, which file they go in,
  and that a global file may set neither.
- [x] 1.2 `docs/how-to/hand-a-task-to-an-agent.md`: `taskAgents` keyed by
  the task number exactly as `tasks.md` writes it, and where the result
  is seen — the "Waiting on somebody" block and **OpenSpec UI: Run This
  Delegated Item**.
- [x] 1.3 `docs/how-to/cap-what-a-run-can-spend.md`: the chain-level
  `budget` and the per-stage one, which unit each agent reports in, and
  a link to `LIMITS.md` for what actually caps a run.
- [x] 1.4 `docs/how-to/use-your-own-agent-definition.md`: where Claude's
  and Copilot's definitions are read from, and `stepAgents.<stage>.customAgent`.
- [x] 1.5 `docs/how-to/run-a-change-from-a-terminal.md`:
  `openspec-ui-cli run <change>`, and the one refusal that stops it
  most often — a change whose configuration asks for a confirmation no
  terminal can answer.
- [x] 1.6 `docs/how-to/run-changes-side-by-side.md`: `worktree add`,
  `worktree list`, `worktree remove`, and that the lease is per
  workspace.
- [x] 1.7 No page restates an accepted-value table, a default, or a
  per-agent effort list. Each links `HARNESS.md` for those instead.

## 2. The way in

- [x] 2.1 `HARNESS.md`'s task index at the top of the file gains a column
  linking the how-to page for each row that has one. Do not remove the
  key column: the index's job is still to name the setting.
- [x] 2.2 `README.md`'s "Agentic Harness" section links `docs/how-to/`
  once, by directory. Do not list the pages in `README.md`.

## 3. What two steps could not reach

- [x] 3.1 Any goal above that could not be written in two steps is
  recorded in this change's `design.md` under a "Could not be done in
  two steps" heading, naming the goal and what stands in the way. An
  empty section is a valid outcome and is written as such; a page padded
  to three steps is not.

## 4. What Gemini and Codex accept

- [x] 4.1 `HARNESS.md`'s custom-agent section states, with the date it
  was read (2026-09-12) and a link to each CLI's own documentation:
  Gemini reads `.gemini/agents/*.md` and `~/.gemini/agents/*.md`
  (Markdown with YAML frontmatter) and documents no flag selecting one
  for a single run — selection is `@name` at the start of the prompt or
  the interactive `/agents` command.
- [x] 4.2 The same section states: Codex reads `.codex/agents/*.toml`
  and `~/.codex/agents/*.toml` (TOML, whose `name` field rather than the
  file name is the agent's name) and documents no `codex exec` flag
  selecting one.
- [x] 4.3 The same section states the consequence in one sentence: this
  repository's `customAgent` is passed as a flag on an allowlisted
  invocation, so neither CLI can be offered one until it has such a
  flag. Do not write "not supported" without the reason — the reason is
  what stops the question being re-derived.
- [x] 4.4 No code in `packages/core/src/custom-agents.ts` or
  `packages/core/src/custom-agent-family.ts` is modified by this change.
  `check(path-unchanged, packages/core/src/custom-agents.ts)`

## 5. Verification

- [x] 5.1 Every file path, key name and command quoted in the new pages
  exists: keys against `packages/core/src/harness-config.ts`, commands
  against `USAGE` in `packages/cli/src/main.ts`, VS Code command titles
  against `packages/extension/package.json`.
  Checked one at a time: `autonomyLevel`,
  `requireConfirmationBetweenSteps`, `reviewGate`, `maxCostUsd`,
  `maxRunSeconds`, `maxStageSeconds`, `taskAgents`, `customAgent` and
  `stepAgents` against the two config modules; `run <change>`,
  `worktree add`, `worktree remove`, `ready`, `lease release` and
  `--cwd` against `USAGE`; "OpenSpec UI: Run This Delegated Item"
  against `contributes.commands`.
  No page restates an accepted-value table, a default or a per-agent
  effort list: the six contain no markdown table at all, and none
  mentions an effort value.
- [x] 5.2 This change validates strictly. `check(validate-change)`
  `openspec validate --strict --changes` — 6 passed, 0 failed, this
  change among them.
- [x] 5.3 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts.
  2026-09-12, exit 0. Typecheck and lint clean across all five packages,
  including `lint:english` over the six new pages. Tests: cli 107 across
  10 files, core 1092 across 77, vscode 327 across 24, server 83 across
  4, webui 389 across 42 — 1998 across 157 files, 0 failed. No source
  changed, so those are the branch's baseline counts.
- [ ] 5.4 **Human-only**: somebody who has not configured the harness
  before follows one page start to finish and reaches the goal without
  opening `HARNESS.md`. The point of a two-step path is that it works
  for a person who does not already know the answer, and only a person
  who does not already know the answer can check that.
