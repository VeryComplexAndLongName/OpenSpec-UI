The marking is read by a surface and by nothing that acts. Seven
delegated items were closed on 2026-09-11 and a person drove every one.

## 1. Which agent a task uses

- [x] 1.1 `packages/core/src/harness-config.ts`: a `taskAgents` section,
  keyed by the task number as written in `tasks.md`, whose value is a
  stage-agent entry — the same shape `stepAgents` accepts, validated by
  the same rules including the `customAgent` shape rule. Unknown keys
  at the top level stay an error.
  One validator over both shapes rather than a second copy:
  `assertValidStepAgents`' entry body became `assertValidAgentEntry`,
  which takes the label it reports under (`stepAgents.apply`,
  `taskAgents."5.4"`). Two rules are `taskAgents`' own and were added
  beyond "the same rules": a key must match `TASK_NUMBER_PATTERN`, and
  `vscode-chat` is refused, because a delegated item's run spawns a CLI
  and cannot be handed to the editor's chat — accepting it would write
  a setting nothing reads.
- [x] 1.2 `taskAgents` is per-change only. A workspace-wide statement
  about a numbered task is a statement about a task in some other
  change, which is meaningless; refuse it in the global file the way
  `autonomyLevel: "autonomous"` is refused, with its own error type.
  `GlobalTaskAgentsError`, alongside the other four.
- [x] 1.3 A resolver in core: given a change, return each open item that
  names an agent, the agent it resolves to, and where that came from —
  the file or the task text. Precedence is file, then text.
  `packages/core/src/delegated-items.ts`: `resolveDelegatedItems` over a
  change, on the pure `assignTaskAgents` the inbox collector reads too,
  so one precedence rule serves both rather than two copies of it.
- [x] 1.4 A disagreement between the two is carried in the result, not
  resolved silently, so a surface can show both.
  `alsoNamedInText` on the assignment and on `WaitingOn`;
  `describeWaitingOn` says "claude-cli (this change's harness.json names
  it; the task text names copilot-cli)", so both hosts show it without
  either writing the sentence itself.
- [x] 1.5 A `taskAgents` key matching no open task line is reported as
  unmatched, for the reason design.md gives: that is a stale entry
  arriving by another route.
  Two reasons are kept apart, because they are fixed differently: no
  open task carries that number, or the task it names is marked for a
  person. Carried on the inbox as `unmatchedTaskAgents` and appended to
  its sentence, where it is otherwise visible nowhere.

- [x] 1.6 Found in review, not planned: reading `harness.json` per
  change made one unreadable file throw out of `collectHumanOnlyInbox`,
  so a single change's typo hid what every other change was waiting on.
  The collector now catches per change, resolves that change's items
  from their task text alone, and carries the failure as
  `unreadableTaskAgents` — appended to the sentence, the same way the
  unmatched entries are. A single failure must not swallow an answer
  nobody asked it about.

## 2. Running one item

- [x] 2.1 A core function that runs one delegated item: builds the
  prompt from the change and the task's own text, and goes through
  `createAgentRunner` so the allowlist, the cwd sandbox and the audit
  entry are the existing ones. No new trust.
  `packages/core/src/delegated-item-run.ts`, `runDelegatedItem`. It
  takes `resolveRunner(agentId)` — the seam `HarnessChainRunner`
  already uses — so both hosts hand it the registry
  `buildDefaultAgentRunners` built, and a test hands it a fake with no
  process anywhere near it.
- [x] 2.2 The prompt states the change, the task text verbatim, and the
  rule the task carries: record the named evidence in the task text and
  tick only with it present.
  `buildDelegatedItemPrompt`, carried as `context.promptContext` on an
  `implement` command, so the change's own files still reach the agent
  as data through `prepareAgentContext` and this sits beside them.
- [x] 2.3 The audit entry carries the change name and the task number,
  so the log answers what an agent was asked to do here.
  `Command.taskNumber` and `AuditEntry.taskNumber`, recorded by
  `createAgentRunner` on both the `started` and the terminal entry,
  beside `stage` — either can be the entry a reader finds first.
- [x] 2.4 An item whose named agent is not in the registry is refused
  before anything is spawned, naming the id.
  Asserted with a `resolveRunner` that records being called: it is not.
- [x] 2.5 A human-only item is refused: it is not delegated, and a run
  offered for it would be the control this repository refuses to build.
  Refused by its own branch naming the marking, not by "no agent is
  configured" — the two are different facts and only one is the
  marking's point.

## 3. The rubber-stamp gate

- [x] 3.1 The task line and its indented body are read before the run
  and compared after.
  The body counts: a task records its evidence underneath itself, so a
  gate reading the checkbox line alone would refuse every item whose
  agent did exactly what was asked.
- [x] 3.2 An item that became ticked with no other change to its text
  has the tick reverted, and the run is reported as refused, naming
  why.
  The revert goes through `writeTaskCheckStates`, which re-verifies the
  line's text before writing. The item is found again by its task
  number where it has one, so a run that inserted lines above it is
  still caught.
- [x] 3.3 An item that came back ticked with new text is left exactly as
  the agent wrote it. The gate claims nothing about whether the evidence
  is true, and the surface says so.
  "Something was recorded; whether it is true was not checked." — in
  `message`, which both hosts show.

## 4. Both hosts offer it

- [x] 4.1 `packages/extension/src/tree/human-only-inbox-tree.ts`: a row
  whose item names a registered agent carries a command to run it. A
  row waiting on a person carries none.
  Through the row's `contextValue`: `RUNNABLE_INBOX_ITEM_CONTEXT` is
  what `package.json`'s `view/item/context` binds
  `openspec-ui.runDelegatedItem` to. A row waiting on a person, or on
  an id nothing recognises, keeps the old value and shows no control —
  a `when` clause can read a contextValue and nothing else.
- [x] 4.2 The shell's waiting block: the same, as a button per row.
  `POST /api/delegated-item/run` and `runDelegatedItem` in
  `human-only-inbox-client.ts`; the button is disabled while any run is
  in flight, since one item per request is the rule.
- [x] 4.3 Both report the outcome where the row is, including a refusal
  from the gate.
  VS Code: `reportOutcome` puts `shortDelegatedItemOutcome` on the row's
  description and the full sentence in a notification, warning-level
  for a refusal. The shell renders `message` under the row. Both
  survive the refresh that follows a run.

## 5. Tests

- [x] 5.1 Core: `taskAgents` validated, refused in the global file,
  merged over the task text, and an unmatched key reported.
  `harness-config.test.ts`, "taskAgents (a-delegated-item-runs-its-
  agent)": six cases, plus `taskAgents` in the round-trip table that
  asserts itself against `TOP_LEVEL_CONFIG_KEYS`.
- [x] 5.2 Core: the resolver over a change carrying a human-only item, a
  marked item, an item named only in `taskAgents`, one named in both and
  agreeing, and one named in both and disagreeing.
  `delegated-items.test.ts`, one fixture carrying all five plus a done
  item and an ordinary one.
- [x] 5.3 Core: a run against a fake agent runner writes an audit entry
  naming the change and the task, and refuses an unregistered agent
  before spawning.
  `delegated-item-run.test.ts`. The runner is a real `createAgentRunner`
  over a fake adapter, so the allowlist, the cwd sandbox and the audit
  entry under test are the product's own.
- [x] 5.4 Core: the gate reverts a silent tick and leaves a tick with
  new text alone. Asserted over the file on disk, not over a value in
  memory.
  Five cases, each reading `tasks.md` back: a silent tick reverted, a
  tick with a body left alone, a body with no tick left open, a tick
  found again after the run inserted lines above it, and a deleted item
  reported rather than guessed at.
- [x] 5.5 Extension: the row for a person carries no run command; the
  row for an agent does.
  `human-only-inbox-tree.test.ts`, over all three kinds of row —
  including the unregistered id, which is not runnable either.
- [x] 5.6 Webui: the same, rendered.
  `packages/server/e2e/waiting-on-inbox.spec.ts`, in the browser for the
  reason 7.5 of `a-live-check-names-who-performs-it` gives:
  `standalone-entry.tsx` has no unit test. Two cases — which rows carry
  the button, and a refusal from the gate shown beside its row with the
  run stubbed at the network, since no test here may spawn an agent.

## 6. Verification

- [x] 6.1 `openspec validate --strict --changes`.
  Run 2026-09-11: 3 passed, 0 failed.
- [x] 6.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run.
  Run 2026-09-11: exit 0 — 48 cli, 952 core, 322 extension, 80 server,
  364 webui. The browser suite is not part of it; item 6.3 is that.
  The first run failed, which is the guard working:
  `HarnessSettingsView.test.tsx`'s "saving preserves what it cannot
  show" asserts against `TOP_LEVEL_CONFIG_KEYS` rather than a list of
  fields, and `taskAgents` — the ninth key — was missing from its
  fixture. Had it named fields, a change's `taskAgents` would have been
  deleted by pressing Save.
- [x] 6.3 Whole browser suite, not only the specs this touches.
  Run 2026-09-11: `npm run test:browser --workspace @openspec-ui/server`
  — all 14 specs passed, 4.3m, exit 0. `harness-screenshots.spec.ts`
  rewrote `docs/images/standalone/harness-settings.png` as it always
  does: nothing in this change alters that view, so the difference is
  the capture's own, and the file is left unstaged.
- [x] 6.4 `HARNESS.md`: `taskAgents`, its precedence, and that the gate
  checks only that something was written.
  Its own section under "Every key", plus the top-level key list, the
  per-change-only table, the merge list, the "Where each setting is
  edited" table and the worked per-change example.
- [x] 6.5 Version bump via `npx changeset` for core, webui and the
  extension.
  Correction to this task's premise: `@openspec-ui/server` belongs in it
  too — this change adds `POST /api/delegated-item/run` to it, and a
  package that changed without a bump ships the change under an
  unchanged version. Four packages, minor.
- [x] 6.6 **Delegated to claude-cli**: run a real delegated item end to
  end from the inbox — one that names `claude-cli` — and
  confirm the audit entry carries the change and task number and that
  the item's evidence was written. Evidence to record here: the run id,
  the audit line, and the resulting task text. This is the first use of
  the thing being built, and it is the honest test of it.

  Named for `claude-cli` rather than `copilot-cli`, asked for on
  2026-09-11: the owner's Copilot credits are running low. Both accept a
  custom agent through `--agent`, so nothing about the item changes but
  the name.

  Run 2026-09-11 against a throwaway workspace, never this repository.
  A change carrying one ordinary task and one delegated item that asked
  for a counted number and the command used to count it.

  The inbox found it: "1 item waiting, across 1 of 1 active change: 1 on
  claude-cli", resolved from the task text.

  The run, through the real adapter and the real `createAgentRunner`:

      "status": "ran", "agent": "claude-cli", "taskNumber": "1.2",
      "outcome": "completed", "gate": { "kind": "recorded" }

  Both audit entries carry the change and the task number:

      {"agent":"claude-cli","outcome":"started",
       "changeDir":"live-delegated","taskNumber":"1.2"}
      {"agent":"claude-cli","outcome":"completed",
       "changeDir":"live-delegated","taskNumber":"1.2"}

  The agent did the work and wrote the evidence the item asked for — the
  number, the command, and unprompted, the discrepancy between two ways
  of counting — then ticked the item. The surface said what the gate
  actually checked: "Something was recorded; whether it is true was not
  checked."

  The gate's refusal path was not exercised live: forcing an agent to
  tick while writing nothing is not something a prompt can reliably
  arrange. It is covered by 5.4, five cases asserted over the file on
  disk. Said rather than implied by a tick here.
