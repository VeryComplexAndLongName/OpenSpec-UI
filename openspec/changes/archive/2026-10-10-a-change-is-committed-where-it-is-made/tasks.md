From ADR 0043, amended on 2026-10-10: the owner's report that the changes of
`HppMCP`, each in its own worktree, read as somebody else's and offered no
button.

## 1. Core

- [x] 1.1 `change-commit.ts`: commit what a directory holds and push its
  branch with an upstream; Commit Change for a change's own worktree;
  refused in the checkout and on the default branch. What is said, from the
  register.
  `change-commit.test.ts`, real git against a bare remote, 2 tests
  (2026-10-10).
- [x] 1.2 Create Change commits the new change on its branch and pushes it;
  a refused push leaves it made and says why.
  `change-in-its-worktree.test.ts`, 3 tests (2026-10-10).
- [x] 1.3 The rules say when to commit and push.
  `agent-workflow-rules.ts`; its test asserts the new lines (2026-10-10).
- [x] 1.4 The git stage commits what the stages left before it pushes.
  `harness-chain-runner.ts`; 2 tests in its git stage section, 8 pass
  (2026-10-10).
- [x] 1.5 The survey says where a change's own branch is not on the server,
  from the refs it lists anyway.
  `worktree-survey.ts`, `notOnServer`; a test over never pushed, at
  another commit and level (2026-10-10).
- [x] 1.6 Commit Change in core's list of actions, with its refusals.
  `change-actions.ts`; `change-actions.test.ts` (2026-10-10).
- [x] 1.7 Messages `OSW-GIT-001`, `002`, `101`, `102`, `103`, `201`, `202`,
  `203`; `docs/messages.md` regenerated; the ratchet stays at 290.

## 2. Hosts

- [x] 2.1 The Pipeline: a card of a change's own worktree offers its actions
  arranged by step too, and says where its branch is not on the server.
  `PipelineView.test.tsx`, 1 new test; 107 pass with the actions tests
  (2026-10-10).
- [x] 2.2 The extension: the Commit Change command and manifest entry; Create
  Change says whether the change was pushed.
  `commands.test.ts`, 1 new test; all 535 of the extension's unit tests pass
  (2026-10-10).
- [x] 2.3 The standalone server: Commit Change in the change-action route;
  Create Change's answer says whether the change is on the server, and the
  page says it.
  `change-actions-rest.test.ts` (2026-10-10).

- [x] 2.4 Run Change... on a card of a change's own worktree, in both
  arrangements; the run runs in that worktree, in both hosts. The owner's
  check on 2026-10-10 showed the card with every action but the run.
  `PipelineView.test.tsx` (the button, its directory, running); the
  extension's `runChange` resolves the change where it is worked and its
  Start is accepted for a change of its own worktree (`commands.test.ts`,
  `pipeline-panel.test.ts`); the standalone's run dialog, schedule and
  chain take the worktree's root. Seen live on `HppMCP`: the dialog for
  `mailbox-integrations-readonly` read its worktree's harness and "24 tasks
  still open" (2026-10-10).

## 3. Documents

- [x] 3.1 ADR 0043 amended (decisions 6-8).
- [x] 3.2 README and the extension's README.
- [x] 3.3 A changeset: core, webui, extension, server - minor.

## 4. Checks

- [x] 4.1 `npm run typecheck && npm run lint`; the affected tests with two
  workers.
  2026-10-10: typecheck clean; lint 0 errors (4 warnings, none in files
  this change touched). Core: change-commit, change-in-its-worktree,
  worktree-survey 33, change-actions, agent-workflow-rules, the message
  register and the chain runner's git stage; webui PipelineView 107;
  extension 535 + 1; server change-actions 5 - with two workers.
- [x] 4.2 `openspec validate a-change-is-committed-where-it-is-made
  --strict`, and the merge gate with the worktree's absolute path as
  `--cwd`.
  2026-10-10: valid under `--strict`; the gate, run as `openspec-ui-cli
  validate changes`, named only 4.1, 4.2 and 4.3 as open.
- [x] 4.3 **Human-only**: in `HppMCP`, on the extension built from this
  branch, a change of its own worktree shows "not on the server" and its
  actions in the arrangement by step; Commit Change puts it on the server;
  a change created afterwards is pushed at once.
  2026-10-10, the owner, on the extension 0.102.0 built from this branch:
  "Confirmed". Arranged by step, the cards of the four changes worked in
  their own worktrees showed their actions and, after the first check
  found it missing, Run Change..., which opened each change's run dialog;
  Commit Change committed and pushed. "not on the server" was gone by then,
  every branch being on the server.
