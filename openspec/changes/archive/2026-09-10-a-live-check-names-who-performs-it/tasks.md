One category, "a person must do this", covering two facts: no agent
can, and this agent cannot. All six open items are the second.

## 1. The marker

- [x] 1.1 `packages/core/src/task-checklist.ts`: a task whose first bold
  span reads `Delegated to <agent-id>` carries `delegatedTo: "<agent-id>"`,
  absent otherwise, matching `humanOnly`'s absent-when-not-applicable
  shape. Case-insensitive on the lead, exact on the id.
  `delegatedAgentFor` is the reader; the id shape is the one a registry
  id has, so `**Delegated to whoever is free**` names nobody and is not
  read as an assignment.
- [x] 1.2 A task carrying both markers is a task text error: the parser
  takes `humanOnly` and leaves `delegatedTo` absent, because "nobody can
  do this" and "this agent does this" cannot both be true, and the
  safer of the two is the one that reaches a person.
  Correction to this task's own premise: reading only the *first* bold
  span was not enough. A line led by `**Delegated to copilot-cli**` and
  marked `**Human-only**` further along matched neither test and fell
  out of the inbox entirely — found by the test written for this item,
  not by review. `HUMAN_ONLY_ANYWHERE_RE` is the wider test that settles
  it; `isHumanOnlyTask` is left reading the lead alone, since it is
  public and its prefix rule was measured against every marking the
  repository had written.

## 2. The inbox reports who each item waits on

- [x] 2.1 `packages/core/src/human-only-inbox-view.ts`: `HumanOnlyItem`
  carries `waitingOn`, either `{ kind: "person" }` or
  `{ kind: "agent", agent: string, known: boolean }`.
- [x] 2.2 `packages/core/src/human-only-inbox.ts`: collect unticked
  items that are human-only or delegated; check a delegated item's agent
  id against the registry and set `known` from it.
- [x] 2.3 `describeHumanOnlyInbox`: say how many wait on a person and how
  many on each named agent, and name an unknown agent id as unknown.
  Keep the three empty states apart as they are today.
- [x] 2.4 Confirm the registry import keeps `human-only-inbox-view.ts` a
  leaf: `packages/server/src/static.test.ts` is the gate, and the check
  belongs in the collector if the registry is not browser-safe.
  It is browser-safe — `agents/registry.ts` has no imports at all and
  `browser.ts` already re-exports it — but the check went in the
  collector anyway: whether a line *names* an agent is a fact about the
  text, and whether that name *is* an agent is a fact about the build.

## 3. Both surfaces say it

- [x] 3.1 `packages/extension/src/tree/human-only-inbox-tree.ts`: each
  row's description says who it waits on.
- [x] 3.2 The shell's "Waiting on a person" block in
  `packages/webui/src/standalone-entry.tsx`: retitled "Waiting on
  somebody", and each row labelled with who it waits on.

## 4. The rule

- [x] 4.1 `openspec/config.yaml`, `rules.tasks`: a task an implementing
  agent cannot perform names the agent that can, as
  `**Delegated to <agent-id>**`, together with the evidence that agent
  must record; `**Human-only**` is for a check no agent can make. A
  delegated item is ticked only with its evidence recorded in the task
  text.
- [x] 4.2 `openspec/README.md`: the same, where the task conventions are
  described.

## 5. The six open items

Each is rewritten from a marking that sends it to a person into a
procedure with named artifacts. None is ticked here.

- [x] 5.1 `a-date-is-one-day-in-every-source` 7.5 → `copilot-cli`, a
  Playwright assertion over the shell that the sentence under the charts
  carries this repository's own counts.
- [x] 5.2 `a-name-is-checked-before-it-is-used` 5.4 → `copilot-cli`, a
  case in the VS Code integration suite reading and saving a per-change
  override through the bridge.
- [x] 5.3 `a-schedule-keeps-its-promise` 8.5 → `copilot-cli`, two cases
  in the VS Code integration suite: an archived change's entry dropped
  with its reason, and a second entry opening on its stored path.
- [x] 5.4 `a-stage-override-keeps-its-custom-agent` 5.4 → `copilot-cli`,
  a live chain run whose audit line carrying `--agent` is quoted.
- [x] 5.5 `dependabot-block-action-majors` 3.5 → `copilot-cli`, the pull
  requests of the first weekly run after 2026-09-04, quoted.
- [x] 5.6 `quality-is-charged-to-the-agent-whose-work-was-checked` 5.5 →
  `copilot-cli`, a live chain run whose `checkedAgent` and rendered
  sentence are quoted.
- [x] 5.7 Read back by machine, not by eye: `collectHumanOnlyInbox` over
  this repository on 2026-09-10 answers "6 items waiting, across 6 of 8
  active changes: 6 on copilot-cli" — zero on a person, and every one of
  the six recognised as delegated to a registered agent.

## 6. A worked example

- [x] 6.1 Run `copilot-cli` now against 5.5's procedure, for the half
  that can be answered today: whether any github-actions major bump has
  been opened since the rule landed on 2026-09-04. Record its answer
  verbatim in this task, including a refusal to confirm what has not
  happened yet. A delegation whose first use invents an answer is a
  delegation to stop making.

  Run 2026-09-10, `copilot -p ... --allow-all-tools`, 12.81 AI credits,
  43 seconds. It ran `gh pr list --author "app/dependabot" --state all`,
  filtered on `createdAt > "2026-09-04"`, and reported:

  > **(1) Dependabot run dates since 2026-09-04:** None. The most recent
  > Dependabot PRs (#207–#209) were all created 2026-09-03, i.e. before
  > the ignore-rule commit 602e0aa (2026-09-04).
  > **(2) github-actions PR since 2026-09-04:** None exists. There is
  > nothing to check "does it bump minor/patch and not major".
  > **(3) Can the task be confirmed?** **No.** The first weekly
  > Dependabot run following the 2026-09-04 rule change has not happened
  > yet [...] This task item cannot be marked confirmed until a
  > post-2026-09-04 Dependabot PR appears.

  It refused, which is the answer this example was run to test for. The
  partial reading is recorded under that change's own item 3.5, not as a
  tick.

## 7. Tests

- [x] 7.1 Core: `readTaskChecklist` over a list carrying a human-only
  item, a delegated item, a delegated item naming an unregistered agent,
  an item carrying both markers, and an ordinary item.
  `task-checklist.test.ts`, `delegatedAgentFor` and `readTaskChecklist
  delegatedTo field`.
- [x] 7.2 Core: `collectHumanOnlyInbox` returns both kinds with
  `waitingOn` set, and `describeHumanOnlyInbox` counts them separately.
- [x] 7.3 Core: an unknown agent id is reported as unknown, not counted
  as delegated.
- [x] 7.4 Extension: the tree row's description names who it waits on.
- [x] 7.5 The shell's block: asserted in the browser rather than in a
  unit test, because `standalone-entry.tsx` has none and covering a
  component that size for one label would be a harness written for this
  line. `packages/server/e2e/waiting-on-inbox.spec.ts`, its own
  workspace of three changes — a person, a registered agent, an
  unregistered one — asserting the sentence and all three row labels.
  Run 2026-09-10: 1 passed, 11.9s.

## 8. Verification

- [x] 8.1 `openspec validate --strict --changes`.
- [x] 8.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Run 2026-09-10: exit 0 — 48 cli, 835 core, 310 extension, 70
  server, 346 webui. The browser suite is not part of it; the one case
  added here was run on its own (item 7.5).
- [x] 8.3 Version bump via `npx changeset` for core, webui and the
  extension.
- [x] 8.4 The spec delta here modifies the same requirement as
  `a-check-that-passes-checked-something`. Whichever archives second
  must carry both paragraphs — the failure-reporting one and the
  waiting-on one. This block includes both, so archiving this one second
  is safe; archiving it first means the other must be updated before it
  archives.
