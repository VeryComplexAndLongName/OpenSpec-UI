Reported by a first-time user on 2026-09-30: propose is missing from the
stages offered, implement on an unproposed change fails, and the VS Code
agent path offers Copilot only.

## 1. Propose writes the proposal

- [x] 1.1 `commandInstruction("plan")` in
  `packages/core/src/agents/shared.ts` asks for the missing planning
  artifacts in the change's directory, `openspec instructions` per
  artifact, strict validation, the directory's other files as the
  description, nothing written where nothing describes the change, and no
  change to code or to files outside the directory. Do not rename the
  command kind: `plan` stays `plan`.

## 2. The picker

- [x] 2.1 `RUN_START_COMMAND` in `packages/core/src/run-plan.ts`, exported
  from `browser.ts`: propose to `plan`, apply to `implement`, verify to
  `verify`.
- [x] 2.2 `commandLabel` in `packages/core/src/run-plan.ts`, exported from
  `browser.ts`: `plan` reads "propose", `implement` reads "apply", every
  other kind its own name.
- [x] 2.8 `packages/webui/src/notify-run-completion.ts`: `AGENT_COMMANDS`
  includes `verify`, and the notification's body uses `commandLabel`.
- [x] 2.9 `packages/extension/src/run-notifications.ts`: `verify` is
  notified of, and `describeRunCompletion` uses `commandLabel`.
- [x] 2.3 `AiPanel.tsx` lists `plan`, `review`, `implement`, `verify` last
  and in that order, shows each option's label with the kind as its value,
  pre-selects the `verify` stage's agent, and follows a changed
  `initialCommandKind`.
- [x] 2.4 `extension-entry.tsx` opens the picker on
  `RUN_START_COMMAND[plan.startsAt.stage]`, and on `implement` where the
  plan has no `startsAt`.
- [x] 2.5 `standalone-entry.tsx` does the same when "Run one stage" is
  chosen.
- [x] 2.6 `verify` in `STAGE_FOR_COMMAND_KIND` of
  `packages/server/src/websocket.ts`.
- [x] 2.7 `verify` in `STAGE_FOR_COMMAND_KIND` of
  `packages/extension/src/webview/ai-panel.ts`.

## 3. The VS Code Chat path

- [x] 3.1 The `vscode-agent` path in `packages/core/src/run-plan.ts` is
  titled "Apply in VS Code Chat", and its sentence says the model is
  chosen there and no configured agent runs. The path's id stays
  `vscode-agent`: a scheduled run stores it.

## 4. Documents

- [x] 4.1 `HARNESS.md`, `README.md` and `packages/extension/README.md` use
  the picker's names and the path's new title.

## 5. Checks

- [x] 5.1 Tests: the `plan` instruction's five demands; `RUN_START_COMMAND`
  for the three stages; the path's title and sentence; the picker's labels,
  order and values; `plan` sent when propose is run; the picker following a
  changed `initialCommandKind`; the notification's wording.
- [x] 5.2 `npm run typecheck && npm run lint && npm run test` at the root,
  run unpiped, exit code 0. 2026-09-30: typecheck 0, lint 0, test 0 (cli 192, core 1940, extension 118, server 498, webui 681).
- [x] 5.3 `openspec validate one-stage-speaks-openspec --strict`. Valid.
- [x] 5.4 A changeset: core, webui, the server and the extension, minor.
- [ ] 5.5 **Delegated to claude-cli**: a live `plan` run on a change
  directory holding `.openspec.yaml` and a note of what the change is for,
  in a scratch repository. Record the run's command, that `proposal.md`
  and `tasks.md` exist afterwards, the output of `openspec validate
  <name> --strict`, and that `git status` shows nothing changed outside
  the change's directory. Not done on 2026-09-30: tried through the real runner in a scratch repository, and on that machine `claude` answered "Not logged in" and `copilot` could not load its runtime, so no agent ran and nothing was written.
- [ ] 5.6 **Human-only**: in the Extension Development Host built from
  this branch, Start on a Drafted change and choose "Run one stage": the
  picker shows propose, review, apply, verify and opens on propose; the
  third path reads "Apply in VS Code Chat". The same in the standalone.
