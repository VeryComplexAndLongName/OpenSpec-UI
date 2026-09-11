# @openspec-ui/webui

## 1.37.2

### Patch Changes

- Updated dependencies [296802b]
  - @openspec-ui/core@0.68.0

## 1.37.1

### Patch Changes

- Updated dependencies [300b79d]
  - @openspec-ui/core@0.67.0

## 1.37.0

### Minor Changes

- 91f9ad7: A delegated item can be run by the agent it names. The marking has said
  who closes an item since `a-live-check-names-who-performs-it`, and
  nothing acted on it — seven items were closed on 2026-09-11 and a person
  drove every one. Either host now offers a run on a row whose item names
  an agent this build carries, through the same allowlist,
  working-directory sandbox and audit log as any stage; the audit entry
  carries the change and the task number. A change may also state which
  agent a particular task uses, in its own `harness.json` under
  `taskAgents`, keyed by the task's number — per-change only, taking
  precedence over the task text, with a disagreement between the two
  reported rather than resolved in silence, and a key matching no open
  task reported as unmatched. An item that comes back ticked while saying
  nothing it did not say before has the tick reverted and the run reported
  as refused; nothing here judges whether written evidence is true, and
  the surfaces say so.
- 9c2c7d5: Text an agent streams over ACP reads as the prose it was written as. The
  event log has folded consecutive `stdout` chunks into one since the panel
  was written, which is why a raw-CLI agent's output runs on; an ACP agent
  emits `agentUpdate` instead, and the fold had no case for it, so every
  slice of a reply rendered as its own element — half a sentence, sometimes
  half a word. Consecutive text chunks of the same kind now join with
  nothing between them, as `stdout` does and unlike `stderr` and
  `progress`, whose separator would land inside a split word. A message
  chunk and a thought chunk never join with each other, and anything that
  is not streamed text — a tool call, a plan, a usage figure — ends the run
  around it, so a tool call that happened between two sentences still shows
  between them. Whether an ACP update carries text, and what that text is,
  is now answered by one function in `@openspec-ui/core` that both hosts
  read; an update whose shape it does not recognise carries no text and is
  rendered exactly as before, because guessing at an addition to a protocol
  this project does not own would turn it into mangled output.

### Patch Changes

- Updated dependencies [91f9ad7]
- Updated dependencies [9c2c7d5]
  - @openspec-ui/core@0.66.0

## 1.36.0

### Minor Changes

- e0a0e99: An autonomy level is named by what running under it does, and is offered
  only where a file may set it. Two of the three read "(not yet
  implemented)" of levels the chain runner has treated distinctly, and
  tested, for as long as it has existed. The workspace-level section also
  offered `autonomous`, which `writeGlobalHarnessConfig` refuses outright
  — a control whose value the save rejects. Which levels a scope accepts
  now comes from one list in core that the writer enforces and the surface
  reads, so the two cannot disagree again.

### Patch Changes

- Updated dependencies [e0a0e99]
  - @openspec-ui/core@0.65.0

## 1.35.0

### Minor Changes

- 3f435c7: A check that passes checked something.
  
  The standalone shell's "Waiting on somebody" block now says when the
  inbox could not be read, and why, in the place the count would have been
  — a failed read used to remove the block, which is what a block that has
  not loaded yet looks like.
  
  A webview bridge request that gets no reply now fails after ten seconds
  with the operation's name, instead of leaving the Harness Settings form
  on "Working..." with its save button disabled and nothing said.
  
  Behind those: the changeset lint reads bare and single-quoted package
  names as well as double-quoted ones and refuses a frontmatter line it
  cannot read; the browser test named for a project's archiving history
  asserts the counts that history produced; and the fixtures that build git
  histories run git with `commit.gpgsign` and `core.hooksPath` of their own,
  so they no longer fail on a machine whose global configuration sets
  either.
- 1806701: A change's date now carries the day its own record names, alongside the
  instant. A commit records its offset and `git blame`'s porcelain output
  records it too; the day is read from that string before any
  normalisation, so an archive committed at `02:30 +03:00` is that day
  rather than the previous one in UTC. The instant is still normalised, so
  ordering and lead times are unchanged. The archived date shown in the
  sprint report, the timeline and the per-day chart is that day.
  
  The audit log reaches both hosts. `getChangeTimelines` takes the
  timestamps of the runs recorded against each change, and the server
  route and the extension's timeline command each read the log once per
  request and hand them down — so work that began with a run before anyone
  ticked a task is dated from that run in a workspace, not only in a test.
  
  A date that cannot be read is now absent and says so. One folder named
  `2026-13-01-something` used to throw out of the whole multi-change
  request, taking every other change's dates with it.
  
  The one-call archive read no longer mistakes a path for a date. It told
  them apart by a leading `C`, and `--name-only` prints paths relative to
  the repository root, so any workspace under a directory beginning with
  `C` fell back to a git call per change without saying so. It reports the
  lines it could not read, and the chart's basis line says when there were
  any.
  
  The chart arithmetic moved from `webui` into core, exported through
  `@openspec-ui/core/browser`, so a host showing the same figures in
  another form draws them from the same functions. The lead-time buckets
  are named by their boundaries — "Under a day", "1–2 days", "2–3 days",
  "3–8 days", "8 days or more" — rather than by "Same day", which a
  twenty-four-hour floor does not mean. The sentence explaining the
  work-duration chart that is deliberately not drawn is computed from the
  changes on screen; it used to state "measured over this repository, 135
  of 185 changes…" in every workspace.

### Patch Changes

- Updated dependencies [3f435c7]
- Updated dependencies [1806701]
  - @openspec-ui/core@0.64.0

## 1.34.0

### Minor Changes

- be28986: A task that needs a live check can name the agent that performs it.
  `**Delegated to <agent-id>**` sits beside `**Human-only**`: the first
  means another agent can make the check, the second that none can. The
  inbox in both hosts now carries both kinds and says who each item waits
  on, naming an agent id the registry does not carry rather than treating
  it as assigned.
- 1b67bee: What a verifying stage's checks found is now charged to the agent whose
  work they covered. The entry gains `checkedAgent`, taken from the chain's
  resolved `apply` stage, and the quality readback groups by it — grouping
  by the entry's `agent` could only ever produce one row, named
  `verify-checks`, whatever had run the apply. An entry recorded before
  that field existed is counted and reported as such rather than charged to
  a group.
  
  A checks entry is also no longer counted as a run. It carries a terminal
  outcome and no `started` partner, so the per-change cost report listed it
  as a run refused before it started and one chain run of apply and verify
  reported two previous runs; one predicate in core now says which entries
  are runs, and both counters use it. A checks entry therefore no longer
  appears as a row in the per-change cost report — what it found is read
  back beside the run figures instead.
  
  A recommendation's gap says which nothing it is: nothing reported the
  measure, something reported it but rests on too few runs, or one
  candidate is eligible with nothing to compare against. Four runs that
  each reported a cost previously read as "no agent has reported a cost
  across 4 recorded run(s)".
- c679bd4: A scheduled run keeps the promise the dialog makes. Opening the
  application is now enough: the workspace is read on open, so the
  schedule is read too and a due run starts with nothing else done — it
  used to wait for a click that a real reopen never makes. The run starts
  on the path that was chosen when it was scheduled rather than reopening
  the dialog for the same choice, and the entry leaves the file only once
  the run has been opened, so a configuration that cannot be resolved
  reports itself as a run that could not be opened instead of consuming
  the schedule under the wrong message. A change archived after being
  scheduled is dropped and says it was archived, and a run due behind it
  starts on the same reading. Firing is decided once, in
  `planScheduleFiring` in core, with each host performing only the
  effects it is handed. The dialog is announced as a dialog and takes
  focus when it opens by itself, and what the schedule did is readable
  from any tab of the standalone shell.

### Patch Changes

- 9dd0767: A name arriving from a request is checked before it is used. A change
  name now passes the change-name rule before it is joined into a path,
  in core beside the path it protects, so a message naming
  `../../../../Users/me/.claude` no longer decides where a `harness.json`
  is written — the bridge answers `ok: false` and the REST routes answer
  400, both carrying the rule the name broke. A schedule entry is
  validated on the way in by the same rule the reader applies on the way
  out, so a stored row and the response that reported it can no longer
  disagree, and a body asking for an addition and a removal at once is
  refused rather than half-applied. A `customAgent` obeys the same shape
  rule as a model id, for the same reason: both reach the CLI as the value
  of a flag, and a value beginning with `-` may be read as a second one. A
  custom-agent definition whose file name that rule refuses is reported as
  found and not offered, rather than dropped in silence.
- ad1a8ae: A stage override keeps its custom agent, and one function decides what
  applying a named configuration writes.
  
  `mergeStepAgent` merged three named fields across a per-change override.
  `customAgent` was the fourth field a stage entry may carry, so a change
  naming the same agent plus a custom agent resolved without it and the
  chain ran with no `--agent` flag, silently. The merge now iterates
  `STEP_AGENT_KEYS` — the list the validator already reads — so the next
  field added to an entry arrives already merged, and it agrees with
  `templateConfigToWrite`, which kept the field by spread.
  
  Applying a named configuration to a change now goes through one core
  function, `changeTemplateConfigToWrite`, from all three surfaces. The
  run dialog resolved a configuration's effort against the change's
  resolved configuration and the settings view against the change's own
  override, where every stage the change does not name reads as
  "inherit" — so the two wrote different files for the same change, and
  the settings view's message said "None of the agents on screen takes an
  effort setting" when that was not the reason. That message now names the
  stages given an effort, the agents that take none, and the stages with
  no agent chosen, each only where it is true.
  
  The balanced and careful configurations describe their effort by its
  position in the agent's range ("a third of the way up", "two thirds")
  rather than as "the middle", which the thirds mapping never produced:
  for `copilot-cli` the medium level resolves to `low`, the third of
  seven. `HARNESS.md` carries the resolved value per registered agent.
- Updated dependencies [be28986]
- Updated dependencies [9dd0767]
- Updated dependencies [1b67bee]
- Updated dependencies [c679bd4]
- Updated dependencies [ad1a8ae]
  - @openspec-ui/core@0.63.0

## 1.33.0

### Minor Changes

- 93b544d: Read back what the verifying stages found, and what is waiting on a
  person.
  
  The audit log has recorded `checksRan` and `checksFailed` since
  verify-records-what-it-found and nothing read them. They now appear per
  agent beside what runs cost — an agent that is cheap and fails its checks
  is not the cheap one. Measured on this repository first: 0 of 108 entries
  carry the fields, because no chain has verified since the recording
  landed, so the surface says which nothing that is rather than showing a
  blank.
  
  Unticked human-only items are readable in the standalone shell too. A
  change waiting on a live check and a change nobody has started are the
  same row in a list of changes — a question this repository was actually
  asked, about six changes that were finished. The collecting moved into
  `core`, so both hosts read one answer instead of one host walking the
  files itself.
  
  Also here, from automating a human-only check: a scheduled run firing
  while another tab was open consumed its entry and displayed nothing, and
  the first schedule read ran before the workspace's changes were known and
  deleted every entry as belonging to a deleted change.

### Patch Changes

- Updated dependencies [93b544d]
  - @openspec-ui/core@0.62.0

## 1.32.0

### Minor Changes

- 71e0051: A run can be asked for at a time, and says what became of it.
  
  The run dialog now takes a time as well as a path — the same question,
  asked once. The schedule lives in `.openspec-ui/scheduled-runs.json`,
  gitignored beside the audit log, because "start this one at six" is one
  person's intent on one machine rather than project configuration.
  
  `one-way-in-to-run` left this open with the argument it turns on: what
  happens when the process is not running. The answer here is that the run
  starts the next time the application is opened, and the dialog says how
  late it is — a schedule that quietly does not happen is worse than no
  schedule, so the dialog also says, before anyone relies on it, that it
  needs the application open.
  
  A time already past is refused where it is entered. Where several come
  due together one starts and the rest are reported as waiting, because the
  workspace lease refuses a second mutating run and that refusal would read
  as a fault. An entry for a change that no longer exists is dropped and the
  drop is reported.
  
  Both hosts fire from the same core function, on start and on a tick.

### Patch Changes

- Updated dependencies [71e0051]
  - @openspec-ui/core@0.61.0

## 1.31.1

### Patch Changes

- Updated dependencies [6abc8fa]
  - @openspec-ui/core@0.60.1

## 1.31.0

### Minor Changes

- 24925a7: Chart what a project finished, and what the chart rests on.
  
  Two charts under the multi-change timeline, in both hosts: how many
  changes were archived per day, and how long each took from the commit
  that proposed it to the one that archived it. Every day between the first
  and the last is a column, so a quiet day is a gap rather than a missing
  column.
  
  Each chart states what it drew, how many changes it left out for having
  no date, and how many of its dates came from a commit rather than from a
  folder name — a chart that drops the source plots an inference and a
  measurement identically.
  
  Two more charts were measured and deliberately not drawn: the work span
  and the wait before work are flat here (135 of 185 changes have exactly
  zero days between being proposed and their first finished task), and the
  view says so rather than shipping a flat line that reads as a finding.
  
  The multi-change timeline now plots an archived change at the commit that
  archived it. The end-of-day anchor remains for the case it was written
  for — a date read off the folder name, which carries no time of day.
- f4beaaf: Name the four configurations by the effort they ask for.
  
  They were named by their ceilings, with the figures in the title. A title
  reading "up to $3" was read as what a run would cost, and it is not a
  price — it is the point at which a run is stopped.
  
  Thorough, Careful, Balanced and Economy each carry an effort *level*
  rather than a value, resolved when the configuration is applied against
  the agent that stage will use: "highest" is `max` for `claude-cli` and
  `high` for `codex-cli`, and nothing at all for the five registered agents
  that accept no effort, where both surfaces say the configurations differ
  in their ceilings alone. None of them sets a model — the model is
  whichever the workspace already configured, and each says so in its own
  text. The ceilings are unchanged and still carry where each figure came
  from.
  
  Applying one now goes through one function in `core` for both hosts, so
  the change's existing `harness.json` is kept and the stage's agent is
  written beside the resolved effort.
- 8987e8b: Choose a custom agent where the stage's agent is chosen.
  
  `POST /api/custom-agents` returns the definitions a workspace holds, with
  the directories they were looked for in, and the harness settings offer
  one picker per stage — listing only the definitions that stage's own CLI
  accepts.
  
  Nothing is offered as an empty control: a stage whose agent takes none
  says so, a workspace defining none says so and names the directories
  read, and a configured name the discovery no longer finds stays selected
  and is marked as not found rather than being replaced.
  
  Saving a stage now keeps a `model` this form has no control for. It was
  being deleted on save — the same defect as `settings-save-what-was-shown`,
  one level down in the stage entry.
- 432769d: Edit the harness configuration in VS Code through the settings view.
  
  Both `Configure Harness` commands opened the JSON file, which carries
  none of what the surface knows: which effort values the chosen agent
  accepts, which spending field it honours, which custom agents the
  workspace defines, and which configured ceilings cannot act. They now
  open the same settings view the standalone shell renders, in the panel,
  with the per-change command loading that change's override.
  
  The files stay hand-editable and the view names them.
  
  This needed the webview to be able to ask its host a question: the bridge
  carried a command one way and events the other, and neither shape is a
  read. Requests name one of five operations — never a path, a file or a
  function — and the host answers against its own workspace root, carrying
  a refusal back as the error rather than swallowing it.
- 8b7f4b8: Show the run dialog in the panel instead of a quick-pick.
  
  `Run` in VS Code asked its question through a control that gives one line
  per item and cuts the rest without saying so — every named
  configuration's intent ended mid-word. It now renders the same dialog the
  standalone shell renders, from the same components, in the panel that
  already hosts them.
  
  The plan travels in the first render's context, because it decides which
  component mounts. Choosing a chain or a single stage mounts it in place;
  the two answers only the extension can carry out — opening a chat
  session, and writing a named configuration — come back as one message,
  and the configuration's id rather than its contents, so a message cannot
  decide what is written to a file. After a write the host re-reads and
  posts the plan the file now resolves to.
  
  The quick-pick is deleted rather than kept as a fallback: two dialogs
  that must agree is the shape this removes.

### Patch Changes

- Updated dependencies [db5e02c]
- Updated dependencies [f4beaaf]
- Updated dependencies [8987e8b]
- Updated dependencies [09a49fd]
  - @openspec-ui/core@0.60.0

## 1.30.0

### Minor Changes

- a107503: The run dialog shows what runs have cost in this workspace: per agent,
  with the median and p90 cost and duration, how many runs each figure
  rests on, and how many of those reported a cost at all. An agent that
  reports nothing says so rather than showing a cost of zero, and a group
  resting on fewer runs than the threshold is marked rather than omitted.
  
  A workspace with nothing recorded says so and states how many audit
  entries were read, so the box changes as runs accumulate instead of
  looking identical before and after one has happened.
  
  New route `POST /api/workspace-run-stats`, since the figures come from
  the audit log and from which changes still exist, and the browser can
  read neither.

### Patch Changes

- cba553e: The run dialog draws recommendations from the workspace's own recorded
  runs, each named for what it recommends — the cheapest here, the fastest
  here, the most likely to finish — with the figure it won on beside it.
  
  A comparison needing two candidates is not offered with one: a
  superlative over a single row claims a distinction that was never
  established, and where that happens the box says so instead. Ties name
  every candidate, and a group resting on fewer runs than the threshold
  cannot win.
- Updated dependencies [8f2ed11]
- Updated dependencies [cba553e]
- Updated dependencies [d1e15ca]
  - @openspec-ui/core@0.59.0

## 1.29.1

### Patch Changes

- Updated dependencies [94a295e]
- Updated dependencies [9f323c1]
  - @openspec-ui/core@0.58.0

## 1.29.0

### Minor Changes

- ec0d6ac: The Run dialog advises rather than claiming to. It was shipped as a path
  picker: the standalone shell never recommended anything, the editor's
  recommendation went into a quick-pick hint that truncates, no named
  configuration could be applied from it, and a configuration with nothing
  wrong rendered nothing at all.
  
  The recommendation now appears in both hosts — the standalone shell reads
  the change's open task count from `/api/change-timeline`, which it could
  always do — and is shown where it can be read. The three named
  configurations are offered beside it, so a recommendation is something to
  act on rather than a remark; applying one writes the change's
  configuration and starts nothing. A configuration whose ceilings can all
  act now says so.

### Patch Changes

- a21392c: Applying a named configuration from the Run dialog no longer deletes the
  change's other settings. Both hosts wrote the template as the change's
  whole file, and the writer replaces — so `gitStageAllowlist`, which says
  which paths a chain may stage, along with any hand-tuned ceilings, was
  removed by applying a template. The template's keys are now laid over
  what the change already has.
- dea1dc4: The three named harness configurations are titled by what a person is
  actually choosing between — **Minimum cost · up to $3, 45 min**,
  **Balanced · up to $5, 60 min**, **Fastest · up to $25, 4 hours** — with
  the ceilings in the title rather than in a sentence below it. They were
  previously named for how closely the run is watched, which is a
  consequence of each choice and not the choice.
  
  The configurations themselves are unchanged; their ceilings were measured
  against this repository's audit log and that measurement stands. Their
  ids change with their names (`min-cost`, `balanced`, `fastest`) — nothing
  stores a template by id.
  
  "Fastest" states what makes it fast, since nothing here makes an agent
  work faster: it never waits for a person, and its ceilings are wide
  enough that a stage is not cut and started over.
- Updated dependencies [9836f84]
- Updated dependencies [dea1dc4]
  - @openspec-ui/core@0.57.0

## 1.28.0

### Minor Changes

- 4115954: One entry starts a run, and it shows what the configuration resolves to
  before starting: which path will run and why, which agent each stage will
  use, any ceiling that cannot act, and — where the host can read the
  change's task list and audit log — the recommended configuration with the
  observations behind it.
  
  **Implement with VS Code Agent** is gone as a menu entry and is now a
  choice inside that dialog. It was never a separate way of working:
  `vscode-chat` is already a step agent, so that path is the `apply` stage
  run by it. Choosing any path other than the configured one applies to
  that run alone and writes nothing to `harness.json`.
  
  New in core: `buildRunPlan`, `agentForChosenPath`, and the `RunPlan` /
  `RunPath` types. New in webui: the `RunDialog` component.

### Patch Changes

- Updated dependencies [4115954]
  - @openspec-ui/core@0.56.0

## 1.27.0

### Minor Changes

- 878db9c: Bound a harness run in time. `timeout.maxRunSeconds` and
  `timeout.maxStageSeconds` cap a whole chain and a single stage, both optional and
  absent-means-unbounded, settable globally and per change.
  
  Unlike a spending ceiling, this one stops a stage that is already running:
  elapsed time is known during a run where a run's cost is not. It is also the only
  ceiling with any force over an agent that reports no usage — six of the ten
  supported report nothing, and no ceiling of any kind was in force over them
  before. Time counts while a stage runs and not while the chain waits at a
  checkpoint, so a person deliberating is never charged for it.
  
  Reaching a ceiling ends the run as *cancelled* with a reason naming the ceiling
  and its value, rather than as a failure: `CancelledEvent` gains an optional
  `reason`, and an absent one keeps meaning "a person asked". `maxStageAttempts`
  allows a cut stage to be attempted again — one number covering every reason a
  stage is retried, with each attempt recording why the previous one ended. A stage
  that failed on its own merits is not retried. The usage summary gains an
  elapsed-against-ceiling row and shows which attempt a stage is on.
- 182f22e: Say what a harness configuration cannot do. A ceiling could be configured, saved,
  accepted by validation and never fire — a cost ceiling over an agent that reports
  no cost, a token ceiling over one whose tokens are almost all cache, or any
  spending ceiling over the six agents that report nothing at all. Each is
  documented in `LIMITS.md`, which is read by someone who already suspects a
  problem rather than by the person setting the ceiling.
  
  What each agent reports is now recorded in code, beside what its command line
  accepts, with four states rather than two: cost and tokens, tokens only, nothing,
  and never observed. The fourth keeps it honest — two ACP adapters have never been
  measured here, and recording them as silent would assert something nobody
  checked.
  
  The harness settings view now lists what the configuration on screen cannot do,
  updating as an agent is chosen, and a new **Explain Harness Settings** command
  answers the same question for a configuration edited as JSON by hand. The finding
  that matters most is a stage whose agent reports nothing and which has no time
  ceiling: that stage can run without any bound at all.
  
  Reported, never refused: an operator may knowingly leave one stage's ceiling
  unable to act, and nothing here recommends a value.
- 695bf32: Offer harness configurations by intent. Three named templates — **Careful**,
  **Overnight** and **Thrifty** — set agents, ceilings and autonomy together, so the
  first experience of the harness is not a configuration exercise against eight
  settings whose interactions are not obvious.
  
  Each says what it is for **and when it is the wrong choice**, which is the
  sentence that helps someone pick: "Overnight" states outright that it will spend
  up to $25 and run for four hours without asking. Each also says where its numbers
  came from, so a reader can disagree with the judgement and not with the
  measurement.
  
  The ceilings are measured, not chosen. Read from this repository's own audit log:
  49 runs with a duration (median 7.7 min, p75 19.7, p90 34.9, longest 56.8) and 16
  with a cost (median $1.94, p90 $7.14, largest $8.67). A ten-minute stage ceiling —
  the round number a person reaches for — would have cut nearly a third of those
  runs.
  
  Every template is checked against the diagnostic that reports what a
  configuration cannot do, and a template producing a finding fails the build. That
  check is what separates a template from a suggestion: shipping a named
  configuration whose ceiling cannot act would publish, in the product's own voice,
  the confusion that diagnostic exists to report. Templates also declare their
  scope, since three settings are refused in a global file.

### Patch Changes

- ce232d2: The harness settings view no longer deletes configuration it has no
  fields for. Both writers replace the file, so saving used to remove
  `timeout`, `maxStageAttempts`, `budget`, `checkpoints` and
  `gitStageAllowlist`. The per-change section also gains the template
  picker, which is the only place the per-change-only "overnight" template
  can be applied from.
- 13efb9e: The chain panel's button now reads "Start chain". It read "Run with
  Agentic Harness", the same words as the dispatch entry rendered directly
  above it in the standalone UI — two buttons, one label, different
  actions.
- Updated dependencies [2074915]
- Updated dependencies [7aae888]
- Updated dependencies [c26dea5]
- Updated dependencies [878db9c]
- Updated dependencies [182f22e]
- Updated dependencies [695bf32]
- Updated dependencies [c3963c9]
- Updated dependencies [ea25d08]
- Updated dependencies [a82b322]
- Updated dependencies [ba09225]
- Updated dependencies [960b489]
  - @openspec-ui/core@0.55.0

## 1.26.1

### Patch Changes

- Updated dependencies [5b61c75]
  - @openspec-ui/core@0.54.0

## 1.26.0

### Minor Changes

- 53a9f7d: Fix a chain run hanging forever when its agent asks for permission: `HarnessChainRunner` now routes a `"resolvePermission"` command to the runner executing the stage in flight (mirroring how `"cancel"` is already routed), instead of rejecting it as a non-`"chain"` command. Both hosts (`packages/server`'s WebSocket dispatcher and the VS Code extension's webview message handler) gain the matching routing branch, and `HarnessChainPanel` gains the Allow/Deny control needed to answer. A permission request raised under `autonomyLevel: "autonomous"` — where there is no confirmation channel — now fails the stage with a stated reason and ends the underlying process, instead of waiting on a promise nothing can resolve.

### Patch Changes

- Updated dependencies [53a9f7d]
  - @openspec-ui/core@0.53.0

## 1.25.2

### Patch Changes

- Updated dependencies [12b730b]
  - @openspec-ui/core@0.52.0

## 1.25.1

### Patch Changes

- Updated dependencies [e78face]
- Updated dependencies [bfad445]
  - @openspec-ui/core@0.51.0

## 1.25.0

### Minor Changes

- 9353534: Start "Run with Agentic Harness" on the change it was opened for.
  
  The panel opened on `list` with nothing selected, so the user re-entered what they had just said by right-clicking a change. The change now seeds from the `changeDir` the host already sends, and the command kind seeds to `implement` when the panel was opened to run one change — which in turn makes the existing agent pre-selection reachable, since it maps the command kind to a stage and `list` mapped to none.
- ae78a82: Show what a chain run has spent, while it is still running.
  
  A run recorded its usage but nothing displayed it: the figure lived in `.openspec-ui/audit.jsonl` and in one line of the event log. A chain now renders a usage summary beside its event log — a row per stage that has started, with tokens and money, and the configured ceiling beside the recorded total when one is configured.
  
  Attribution needed a new event. A chain publishes every stage under one `runId` and announced a stage only when it *ended*, so the first stage's usage had no stage to belong to, and a chain that stopped mid-stage never named the stage that spent the money. `stageStarted` is emitted immediately before each stage begins — after any check that could refuse it, so a stage stopped at the budget ceiling is never announced as having started. It is non-terminal, like `agentUpdate`/`cancelling`/`usageReported`.
  
  Two kinds of figure are kept apart. The recorded total is what agents reported for finished runs and is what a ceiling is compared against. A live figure — an ACP `usage_update` arriving during a run, previously rendered as `agent update: usage_update` and discarded — is shown as the agent's own running report; its `used` is context occupancy, falls after a compaction, and never enters a token total. Nothing here enforces anything: `HarnessChainRunner.checkBudget` remains the only thing that does.
  
  A stage whose agent reported nothing reads "not reported", never `$0.00`, and a run in which nothing reported says so outright rather than showing an empty panel that looks broken.

### Patch Changes

- Updated dependencies [af32105]
- Updated dependencies [a61bfbe]
- Updated dependencies [ae78a82]
  - @openspec-ui/core@0.50.0

## 1.24.0

### Minor Changes

- 2ec29df: Report cancellation when it happens, not when it is requested.
  
  - New non-terminal `cancelling` event. `cancelled` is now emitted only once the agent's process has actually exited; a process that outlives the request produces a `failed` naming that, not a `cancelled` that did not happen.
  - `terminateProcessTree` reports whether the kill could be issued instead of swallowing the result, and treats POSIX `ESRCH` as success.
  - The Cancel control stays available while a run is still producing output after a cancellation, and accepts a second press.

### Patch Changes

- Updated dependencies [2ec29df]
  - @openspec-ui/core@0.49.0

## 1.23.3

### Patch Changes

- 4e59bdf: `stepAgents` no longer accepts a `git` entry, joining `archive` — the
  `git` stage runs its own push/pull-request/merge sequence and invokes no
  CLI agent, so there was never anything for a `stepAgents.git` entry to
  configure. `HarnessStepAgentStage` now excludes both stages; a
  `stepAgents.git` entry from before this restriction existed is read and
  dropped with a warning naming the file, not rejected.
  
  The standalone settings surface (`HarnessSettingsView.tsx`) now renders
  `git` the same way it already renders `archive`: listed, with no agent,
  effort or budget picker. Previously it offered a picker for an agent id
  that `HarnessChainRunner` never read.
- Updated dependencies [4e59bdf]
- Updated dependencies [4e59bdf]
  - @openspec-ui/core@0.48.0

## 1.23.2

### Patch Changes

- Updated dependencies [eca84bc]
- Updated dependencies [d161b50]
  - @openspec-ui/core@0.47.0

## 1.23.1

### Patch Changes

- Updated dependencies [348ee61]
- Updated dependencies [348ee61]
  - @openspec-ui/core@0.46.0

## 1.23.0

### Minor Changes

- 5271dfe: Add mechanical task checks to the harness's `verify` stage, and stop
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

### Patch Changes

- Updated dependencies [5271dfe]
  - @openspec-ui/core@0.45.0

## 1.22.0

### Minor Changes

- 366bb77: Add the harness `git` stage, and make `verify` run mechanical checks itself.
  
  - The `git` stage pushes, opens a pull request and merges, only under a
    per-change `reviewGate.mode: "agent-sufficient"` plus a per-change
    remote/branch allowlist. Every action is checked against that allowlist
    and audited, blocked attempts included.
  - The merge waits for the pull request's checks and refuses one whose
    checks have not passed. Not configurable, and an absent or all-skipped
    result is a refusal rather than permission (ADR 0014).
  - `verify` runs the mechanical checks a `tasks.md` declares before its
    agent. A failing check skips the agent entirely; a passing one marks its
    own task, and an agent's report can no longer mark a checked task.
  - `stepAgents` no longer accepts an `archive` entry — the stage is
    mechanical and invoked no agent. Existing configurations are read with
    that entry dropped and a warning, never rejected.

### Patch Changes

- Updated dependencies [366bb77]
  - @openspec-ui/core@0.44.0

## 1.21.0

### Minor Changes

- 8a69ea0: Implement harness config strictness for stage runner selection and validation.
  
  - Replace legacy `dispatch` usage in `stepAgents` with a dedicated `vscode-chat` step-runner id.
  - Refuse `model`, `effort`, and `budget` on chat-dispatched stages because those values cannot reach any CLI invocation.
  - Reject unknown keys in `stepAgents` entries and nested `budget` objects.
  - Migrate legacy `dispatch: "vscode-chat"` / `dispatch: "cli"` shapes on read and write.
  - Update core, webui, extension, and server runtime/test coverage for the new strict behavior.

### Patch Changes

- Updated dependencies [8a69ea0]
  - @openspec-ui/core@0.43.0

## 1.20.0

### Minor Changes

- 5cddc4d: Adds ACP (Agent Client Protocol, agentclientprotocol.com) support: a shared session driver in `@openspec-ui/core` speaks ACP JSON-RPC to whichever ACP-capable subprocess it is pointed at, and four new, additional agent adapters — `copilot-cli-acp`, `gemini-cli-acp`, `codex-cli-acp`, `claude-cli-acp` — translate an agent's structured `session/update` progress into the protocol's new `agentUpdate` event and, where the underlying agent genuinely supports it, `session/request_permission` into a new `permissionRequest` event, answerable by a new `resolvePermission` command. These are additive, separately selectable entries alongside today's five raw-text adapters — none of them change. `@openspec-ui/webui`'s AI panel renders `agentUpdate` content and shows an explicit Allow/Deny control for a `permissionRequest`; `claude-cli-acp`'s picker entry states up front that it provides progress detail only, with no permission gate (Claude's CLI has no documented interactive-permission callback in this mode). `openspec-ui-vscode` gains matching event descriptions for its own event log. `codex-cli-acp` depends on an externally installed `codex-acp` binary, detected on `PATH` like every other CLI this project already shells out to — never bundled as an npm dependency, to avoid pulling in `@openai/codex`'s native platform binary for every contributor regardless of use.

### Patch Changes

- Updated dependencies [5cddc4d]
  - @openspec-ui/core@0.42.0

## 1.19.2

### Patch Changes

- 144e13b: A workbench process can now suspend itself to wait on an external system without holding the workspace's mutation lock. `WorkbenchProcessState` gains `"suspended"`, and `WorkbenchProcess` gains an optional `waitingFor` reason. `ProcessExecutionContext` gains `suspend(reason, { timeoutMs })`, which releases the in-process mutation lock and, where a `WorkspaceLeaseManager` is configured, the cross-host lease too — letting another mutating process run in its place. `WorkbenchProcessScheduler.resumeProcess(id)` returns a suspended process to the queue (never directly to `"running"`, so two processes suspended at once still serialize), where it re-admits under the existing lock/lease rules. Every suspension is bounded: on timeout the process fails, naming what it waited for and for how long; cancelling a suspended process ends it as `"cancelled"` immediately. A suspended process persisted across a host restart is recovered as `"interrupted"`, matching `"queued"`/`"running"`, since the poller and the in-memory wait belonged to the host that is gone. New `external-waiter.ts` provides a generic, lock-free poller for a future consumer to build on. The Processes views in both the VS Code extension and the standalone webui render a suspended process as waiting, with its wait reason, distinctly from running. This ships the mechanism only — no stage in this repository suspends yet.
- Updated dependencies [144e13b]
  - @openspec-ui/core@0.41.0

## 1.19.1

### Patch Changes

- Updated dependencies [ed9e4c9]
  - @openspec-ui/core@0.40.0

## 1.19.0

### Minor Changes

- 80a097b: A `stepAgents` entry can now set a reasoning effort and a spending cap, resolved through the same global/per-change merge as `model`. `HarnessStepAgent`'s object form gains `effort?: HarnessEffort` and `budget?: { maxCostUsd?: number; maxAiCredits?: number }` — the spending cap stays in each agent's own unit rather than one shared field, since the CLIs do not share a unit. `HARNESS_AGENT_CAPABILITIES` (`packages/core/src/harness-step-agent.ts`) is the single table both `harness-config.ts`'s validator and each adapter read: `claude-cli` and `copilot-cli` render `--effort`/`--max-budget-usd`/`--max-ai-credits`; `codex-cli` renders `-c model_reasoning_effort="<level>"` and nothing for budget; `gemini-cli` has neither mechanism. A stage entry setting a value its agent cannot express is refused when the configuration resolves, naming the agent and the accepted values, rather than being silently ignored or failing minutes into a run. `default-runners.ts`'s allowlist matcher generalizes from a single optional `--model` pair to an ordered, closed set of validated optional pairs. The webui's Harness Settings view and the VS Code extension's per-change customization wizard both offer effort/budget per stage, limited to what that stage's selected agent accepts. An entry without the new fields produces a byte-identical command line to before this change.

### Patch Changes

- Updated dependencies [80a097b]
  - @openspec-ui/core@0.39.0

## 1.18.0

### Minor Changes

- 56a7c37: A run started from the AI panel can now be cancelled from it: a Cancel button next to Run appears while a run is in flight, sending a `cancel` command on the active `runId` through the same transport the run was started on — the only cancel affordance previously existed for `HarnessChainPanel`'s chain runs, unreachable at `autonomyLevel: "assisted"`, so a single-stage run (available at every autonomy level) could not be cancelled from the UI at all. `openspec-ui.cancelProcess`'s contributed title is renamed to "OpenSpec UI: Cancel Implementation Session" to say what it actually cancels — an implementation session via `deps.implementationSessions.cancel(...)`, not a harness run; its command id, `when` clause, and behavior are unchanged.

## 1.17.7

### Patch Changes

- Updated dependencies [d0be00e]
  - @openspec-ui/core@0.38.0

## 1.17.6

### Patch Changes

- Updated dependencies [8f60b09]
  - @openspec-ui/core@0.37.0

## 1.17.5

### Patch Changes

- dc71cec: Added a `verify` stage to the Agentic Harness chain, running after `apply` and before `archive`, per `docs/adr/0018-event-driven-harness-orchestration.md` gap 1. It reviews the implementation against `tasks.md` and the change's spec delta, and unchecks any task whose stated verification does not actually hold — the existing archive gate (which already refuses to archive a change with unchecked tasks) is what stops the chain, not a new outcome or gate.
  
  `CommandKind` gains an additive `"verify"` member; `commandInstruction("review")` is reworded to describe reviewing the change's proposal (its actual job at chain position 2), resolving the standing contradiction with its old "review the current implementation" wording. `HarnessStage`/`STAGES` gain `"verify"` between `"apply"` and `"archive"`; `HarnessChainRunner`'s `CHAIN_STAGES` and `determineStartStage()` are updated to match — a change whose tasks are all checked but isn't yet archived now resumes at `verify`, not `archive` directly. `stepAgents.verify` resolves through the same global/per-change merge as every other stage.
  
  `security.ts`'s `AgentPromptContextOptions` gains an optional `verifiedDelta` field; when present, `prepareAgentContext()` adds a labelled section carrying the verified run's changed files, truncated with a visible count if oversized, and never sourced from `GitWrapper.diff()` (which would leak a concurrent session's unrelated uncommitted work). `HarnessChainRunner` sources this from a checkpoint captured around the `apply` stage, best-effort — a chain with no delta available (or one that never captures a checkpoint) produces the exact same prompt as before this change.
  
  `packages/extension`/`packages/webui`: the hand-maintained stage lists in the per-change harness config wizard (`commands.ts`) and the Harness Settings view (`HarnessSettingsView.tsx`) now include `verify` in chain order.
- Updated dependencies [dc71cec]
  - @openspec-ui/core@0.36.0

## 1.17.4

### Patch Changes

- 6ed2d1a: Added accounting plumbing for a run's resource usage and observed agent version, and an optional cost/token budget for Agentic Harness chains.
  
  `AuditEntry` (security.ts) gains optional `usage`, `agentVersion`, and `changeDir` fields — all optional, so audit lines written before this change stay valid. `agent-detection.ts` now captures a best-effort agent version from the `--version` probe it already runs (no second spawn) via a new `detectAvailableAgentsDetailed()` export; the existing `detectAvailableAgents()` boolean-map contract is unchanged. New `agent-usage.ts` defines the adapter-agnostic `AgentUsage` shape; new `usage-report.ts` aggregates recorded usage by agent, by model, and by change, distinguishing unmeasured runs from zero cost. New `verified-agent-versions.ts` holds the single `claude` CLI version this project's structured-output parsing was verified against.
  
  `HarnessConfig` gains an optional `budget` (`maxCostUsd`/`maxTokens`); `HarnessChainRunner` checks it before starting each stage of a chain and refuses to continue once recorded usage reaches it, naming the budget as the reason. A run already in progress is never interrupted. `WorkbenchProcess` gains an optional `usage` field so a run's recorded cost can be shown in the Processes view (extension tree, webui table) when present — never as `$0.00` when absent.
  
  No adapter is changed by this commit: nothing yet produces `AuditEntry.usage`, so the budget stays inert until a future change (`acp-agent-adapters`) adds a producer.
- Updated dependencies [6ed2d1a]
  - @openspec-ui/core@0.35.0

## 1.17.3

### Patch Changes

- Updated dependencies [d15f4cb]
  - @openspec-ui/core@0.34.1

## 1.17.2

### Patch Changes

- 6b13d58: The AI panel now reads the OpenSpec change list automatically once it has a usable working directory, so the change picker is populated the moment the panel opens. Previously "Load changes" was an unlabelled precondition: until it was clicked the picker stayed empty and disabled, which blocked every command that needs a selected change. The button remains, relabelled "Reload changes", because changes can still appear on disk while the panel is open. Only the read-only `list` command is auto-run, never `plan`/`review`/`implement`, and the auto-read is skipped while another run is in flight so its output is not discarded.
- Updated dependencies [6b13d58]
- Updated dependencies [d9084ab]
- Updated dependencies [db0e717]
- Updated dependencies [6b13d58]
  - @openspec-ui/core@0.34.0

## 1.17.1

### Patch Changes

- Updated dependencies [5ce55ae]
  - @openspec-ui/core@0.33.2

## 1.17.0

### Minor Changes

- be47425: Make the Agentic Harness's `semi-autonomous`/`autonomous` autonomy levels
  functional. A new `"chain"` command runs `propose -> review -> apply ->
  archive` for a change in sequence, pausing at an explicit `checkpoint`
  between stages by default (`semi-autonomous`) or continuing immediately via
  `stageCompleted` (`autonomous`, or a per-change `harness.json` setting
  `checkpoints.requireConfirmationBetweenSteps: false`). `autonomous` is
  reachable only through an explicit per-change `openspec/changes/<id>/
  harness.json` — never the global `openspec/agent-harness.json`, and never
  implied by any other setting.
  
  See `docs/adr/0012-agentic-harness-chain-execution-protocol.md` and
  `openspec/changes/agentic-harness-autonomy/` for the full design. A chain
  always stops after `archive` and never invokes the `git` stepAgent —
  commit/push automation remains fully out of scope, deferred to its own
  future change. The "Run with Agentic Harness" UI entry point that starts a
  chain from either delivery target is also a separate, dependent follow-up
  (`openspec/changes/agentic-harness-run-menu/`); this release only adds the
  protocol and a minimal, not-yet-wired-up `HarnessChainPanel` component.

### Patch Changes

- be47425: Add a discoverable "Run with Agentic Harness" entry point for the chain
  execution `agentic-harness-autonomy` introduced: a new context-menu command
  (`openspec-ui.runWithHarness`) in the VS Code extension, and a matching
  button in the standalone shell's Change Editor tab. Both resolve the
  selected change's Agentic Harness configuration fresh on every invocation
  and dispatch accordingly — the existing Agent Selection picker for
  `assisted`, or the `HarnessChainPanel` chain view for `semi-autonomous`/
  `autonomous` — without ever overriding what that configuration says.
  
  See `openspec/changes/agentic-harness-run-menu/` for the full design. No
  protocol change — this is purely a discoverable trigger over what
  `agentic-harness-autonomy` already exposes.
- Updated dependencies [be47425]
- Updated dependencies [be47425]
  - @openspec-ui/core@0.32.0

## 1.16.0

### Minor Changes

- 3a93782: Add the Agentic Harness (assisted level): a two-level (global +
  per-change), product-owned config that recommends a CLI agent per
  OpenSpec-change stage in the Agent Selection picker, and shows which
  agent ran a process plus its percent-complete in the Processes view.
  Configurable via a new "Harness Settings" GUI in both delivery targets.
  
  See `docs/adr/0011-agentic-harness-config-and-autonomy-levels.md` and
  `openspec/changes/agentic-harness/` for the full design. Only the
  `assisted` autonomy level is functional in this release —
  `semi-autonomous`/`autonomous`/the `git` stepAgent action/parallel task
  execution are accepted in the config schema for forward compatibility
  but not yet implemented, and are visibly marked as such in the Harness
  Settings UI.
- cc7fc8a: `ChangesList` and `ArchiveList` now show a task-completion percentage
  alongside the existing fraction, and both show a change's last-modified
  date (previously `ChangesList` didn't show it, and `ArchiveList` didn't
  show task progress at all).
- da70d78: Standalone app's "OpenSpec view summary" tab now renders active and
  archived changes as searchable lists (by name or status), using the
  shared `ChangesList`/`ArchiveList` components instead of a static table;
  archived changes now show real task progress and a last-modified date.
- 47b2fc4: `TabPanel` gains an opt-in `lazy` prop that defers a tab's first mount
  until the user opens it, instead of mounting on app load; applied to all
  of the standalone shell's top-level tabs, closing an eager-fetch gap
  where the Processes and Recovery tab loaded its data before ever being
  opened.
- fcd2f15: `ChangesList`/`ArchiveList` now render inside a height-bounded, scrollable
  container — so the search box no longer scrolls out of view on long
  lists — and switch to windowed DOM rendering above 50 items, keeping the
  live DOM node count bounded regardless of how many changes a repository
  has archived.

### Patch Changes

- Updated dependencies [3a93782]
- Updated dependencies [da70d78]
  - @openspec-ui/core@0.31.0

## 1.15.0

### Minor Changes

- Add a downloadable sprint summary PDF report: for a user-picked date
  range and set of changes, who authored each one (from git), what it
  was, task completion, plus aggregate statistics (total changes, tasks
  completed in range, a per-author breakdown). New "Sprint report" mode
  in the standalone Timeline tab.

### Patch Changes

- Updated dependencies
  - @openspec-ui/core@0.29.0

## 1.14.0

### Minor Changes

- Add stale-pending-task detection: a pending task untouched (per git
  blame) longer than a configurable threshold (default 14 days) is now
  flagged in the Change Timeline view. Configurable via a number input in
  the standalone Timeline tab and the new `openspec-ui.staleTaskThresholdDays`
  VS Code setting.

### Patch Changes

- Updated dependencies
  - @openspec-ui/core@0.28.0

## 1.13.0

### Minor Changes

- Add a "compare changes" timeline: a new global command
  (`openspec-ui.showAllChangesTimeline`) and a standalone Timeline-tab
  mode that show several changes as parallel lanes on a shared,
  log-scaled time axis (verified against real archived-change data
  before choosing the log-scale direction). Also adds the CSS the
  single-change timeline view needed but was missing, and fixes archived
  dates plotting before same-day created/task timestamps.

## 1.12.0

### Minor Changes

- Add a "Show Change Timeline" context-menu command (active and archived
  changes) and a standalone "Timeline" tab: proposal/design/spec content
  followed by tasks positioned by best-effort git-derived completion
  date, with pending/undated tasks shown distinctly. The extension
  computes the timeline directly (no HTTP, no message bridge) and opens
  it in a new webview tab per change.

## 1.11.0

### Minor Changes

- Add a best-effort, git-derived change timeline data layer: created date,
  archived date, and a per-task completion date (via `git blame` on
  `tasks.md`, `null` for still-pending tasks), plus proposal/design/spec
  content in one read. New `getChangeTimeline`/`getChangeTimelines` in
  `@openspec-ui/core`, `POST /api/change-timeline`/`/api/change-timelines`
  in the standalone server, and a matching webui client. No UI yet — this
  is the shared data layer for a "change timeline" view, coming next.

### Patch Changes

- Updated dependencies
  - @openspec-ui/core@0.27.0

## 1.10.0

### Minor Changes

- Notify when a `plan`/`implement`/`review` run finishes while you're not
  watching the Processes view or the AI panel. The VS Code extension shows a
  native notification (with a "View" action that opens the Process
  Dashboard); the standalone app shows a browser notification, once
  permission is granted. `status`/`list`/`show`/`validate` (near-instant) and
  `cancelled`/`interrupted`/`rolled-back` runs are not notified.
