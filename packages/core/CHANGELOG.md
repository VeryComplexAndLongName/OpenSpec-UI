# @openspec-ui/core

## 0.74.0

### Minor Changes

- e411f9a: A Pipeline tab: every active change in the order it declares, what is
  running right now and whose run it is, and what can be started alongside
  what.
  
  The placement is derived in core from the readiness report, coordinates
  and all, so the tab and `openspec-ui-cli ready` cannot disagree and
  nothing in the view is measured. A declared blocker is drawn as a
  relation; a collision is not, because a collision is not an order. A
  cycle of blockers is named rather than placed.
  
  The readiness report now carries the blockers each change declares, and
  its shape and wording moved to a browser-safe leaf so both surfaces
  describe a collision in the same words.

## 0.73.0

### Minor Changes

- 394d426: A workspace lease says who took it, and can be asked about.
  
  The lease records the git identity of the working directory that took it
  — `user.email`, falling back to `user.name`. It is attribution, never
  authentication: anybody can set that value to anything, so it is called
  "git author" wherever it is shown and nothing is permitted or refused on
  the strength of it. A lease taken where no identity is configured is
  valid and records none, exactly like every lease written before this.
  
  It is read once where a host starts up, never in the heartbeat — that
  renews every five seconds, and the value cannot change during a run.
  
  `openspec-ui-cli lease` answers who holds a workspace without trying to
  start a run and reading the refusal, which was the only way to ask
  before. It exits `0` held or free: the question was answered either way.
  
  `openspec-ui-cli lease release` clears a lease only where it can
  establish that the holder is gone — the heartbeat is already stale, or
  the holder is on this machine and its process is not running, checked
  with a signal that delivers nothing. There is deliberately no `--force`.
  A holder that died already self-heals once its heartbeat goes stale; a
  holder that is alive still has the workspace open, and taking its lease
  would permit a second mutating run against files it is still holding,
  which is what the lease exists to prevent. A stuck holder is stopped,
  not robbed.

## 0.72.0

### Minor Changes

- e02c596: A declared blocker blocks.
  
  A change may state in its own `.openspec.yaml` that it cannot start
  until another lands. That was computed, reported by
  `openspec-ui-cli ready`, and read by nothing that starts a run — so a
  change saying of itself "do not start me yet" started.
  
  A chain is now refused before its first stage when a declared blocker is
  still an active change, naming every unmet blocker rather than the
  first. There is no option that starts it anyway: the declaration is a
  sentence its author wrote in a version-controlled file, and the remedy
  is to land the blocker or delete the line.
  
  Unchanged: an unmet blocker is still not a validation failure. Whether
  the repository validates and whether a run may start now are different
  questions.

## 0.71.0

### Minor Changes

- 8f574fe: Repository Setup offers only the actions that can do something.
  
  Configure Dependabot appears where the origin is github.com; the
  path-scoped Copilot instructions appear where Copilot is present, by its
  editor extension or a `copilot` binary on the path. Generate Agent
  Instructions stays unconditional — plain files any agent may read.
  
  The two are decided differently on purpose: Dependabot is a service the
  repository's host runs and nothing is installed for it, while Copilot is
  a component on the machine.
  
  An action that is not listed stays in the Command Palette, where
  invoking it says what was established and offers to proceed — the only
  correct answer to a GitHub Enterprise host, which no URL check can
  recognise. A check that could not be completed shows the action rather
  than hiding it.
  
  `GitWrapper` gains `remoteUrl`.

## 0.70.0

### Minor Changes

- 4385179: What can start now, and alongside what.
  
  `openspec-ui-cli ready` reports every active change as running, ready or
  blocked, each carrying the fact that produced it, and says for each
  ready change which others it can be started alongside.
  
  Whether two changes collide is derived, never declared (ADR 0024): from
  a declared `blocked_by`, from two deltas naming the same capability —
  which archive into one spec file — and from two branches having changed
  the same file. A `touches:` list of paths was rejected: it is written
  before the work by whoever knows least about it, and once drifted is
  worse than absent because it is believed.
  
  `WorkspaceLeaseManager` gains a read-only peek, and `GitWrapper` gains
  `changedFilesBetween`.

## 0.69.0

### Minor Changes

- 261a2df: Changes run side by side, each in its own git worktree.
  
  `openspec-ui-cli worktree add <change>` gives a change its own working
  directory of the repository, on a branch named after it; `worktree list`
  and `worktree remove` manage them. Two chains in two working directories
  take two leases and never meet, which is the filesystem isolation ADR
  0010 decision 2 named as its own precondition — the lease itself is
  unchanged.
  
  A spending ceiling is now summed across every working directory of the
  repository rather than per directory, so parallel runs share one budget
  instead of one each. The aggregation is on the read side: each directory
  keeps writing only its own log.
  
  Creating a working directory refuses, changing nothing, where the change
  is not in the base commit, where the branch is already checked out, or
  where the directory exists. Removing one refuses where it still holds
  uncommitted work.

## 0.68.0

### Minor Changes

- 296802b: A change can declare a step in its own chain.
  
  A per-change `harness.json` may now carry `steps`, each naming an entry
  in a closed registry the core owns and stating one position relative to
  one fixed stage. The six fixed stages stay fixed, present, and in order:
  a declaration inserts, and can never remove, replace, or reorder one.
  
  The registry opens with `await-change`, which waits until a named change
  is no longer active in the workspace — the first consumer
  `waitForExternalSignal` has had since it was written. Time spent waiting
  is not charged against a chain's run-time ceiling, for the same reason
  time at a checkpoint is not.
  
  `HarnessStepAgentStage` is now the four stages that run an agent, named,
  rather than everything except the two that do not.

## 0.67.0

### Minor Changes

- 300b79d: A change runs from the terminal.
  
  `openspec-ui-cli run <change>` runs one change through the same harness
  chain the two interactive hosts use, with the same allowlist, sandbox,
  audit log and workspace lease. `openspec-ui-cli check <change>` runs the
  mechanical checks that change's `tasks.md` declares, invoking no agent.
  
  The terminal is a thinner surface, not a more privileged one: the run
  does only what the change's own configuration already permits, and there
  is no flag that starts a chain for a change configured to run one stage
  at a time or that answers a confirmation the change asked for. Every
  refusal happens before the first stage, including a stage whose agent
  this build has no runner for.
  
  Core gains `resolveChainStart`, `runDeclaredChecks` and
  `withWorkspaceLease`, and the workspace lease knows a third kind of host.

## 0.66.0

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

## 0.65.0

### Minor Changes

- e0a0e99: An autonomy level is named by what running under it does, and is offered
  only where a file may set it. Two of the three read "(not yet
  implemented)" of levels the chain runner has treated distinctly, and
  tested, for as long as it has existed. The workspace-level section also
  offered `autonomous`, which `writeGlobalHarnessConfig` refuses outright
  — a control whose value the save rejects. Which levels a scope accepts
  now comes from one list in core that the writer enforces and the surface
  reads, so the two cannot disagree again.

## 0.64.0

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

## 0.63.0

### Minor Changes

- be28986: A task that needs a live check can name the agent that performs it.
  `**Delegated to <agent-id>**` sits beside `**Human-only**`: the first
  means another agent can make the check, the second that none can. The
  inbox in both hosts now carries both kinds and says who each item waits
  on, naming an agent id the registry does not carry rather than treating
  it as assigned.
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

## 0.62.0

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

## 0.61.0

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

## 0.60.1

### Patch Changes

- 6abc8fa: A change with no design is not an unproposed change.
  
  A resumed chain decided where to start by requiring three artifacts to be
  done — proposal, design, tasks. A change that deliberately carries no
  `design.md` never satisfied that: the status command reports a missing
  artifact as `ready`, meaning "could be produced", and the chain read that
  as an unfinished proposal. It restarted at `propose` and re-proposed work
  that was already written, spending a run and pointing an agent at a
  finished `proposal.md`.
  
  Three of this repository's own active changes have no design, and so do
  many archived ones; `openspec validate --strict` accepts them.
  
  The proposing stage now counts as done when the proposal and the task
  list are. A change genuinely mid-proposal has no task list yet, which is
  the case the check exists for and still catches.

## 0.60.0

### Minor Changes

- db5e02c: Date a change by evidence, and say where each date came from.
  
  A change now carries four dates — proposed, first worked on, last worked
  on, archived — each with the source it was read from: a commit, a blame
  line, the audit log, the folder name, or nothing at all. Without the
  source a chart cannot tell a measured date from an inferred one, and
  they plot identically.
  
  The archiving date comes from the commit that put the change under
  `archive/`. The `YYYY-MM-DD-` folder prefix is the fallback, used only
  where there is no commit to read, and it says so when it is used. Over
  this repository's 178 archived changes it answered nothing.
  
  Two defects fixed on the way:
  
  - `getFileCreatedDate` combined `--follow` with `--reverse`, and git
    prints nothing at all for that pair. It returned `null` for every file
    that had ever been renamed — every archived change, silently, as
    "undeterminable".
  - `getChangeTimelines` ran every change at once and died with `EMFILE:
    too many open files` on a 185-change repository. It reads in batches
    now, and reads the whole archive's dates in one git call instead of one
    per change (0.5s against 80s).
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

### Patch Changes

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
- 09a49fd: Date a change's work by what was finished, not by what was written.
  
  `firstWorked` and `lastWorked` came from every blame date on `tasks.md`.
  That file is added by the same commit that adds `proposal.md`, so the
  earliest of those dates *is* the proposal date — measured across 185
  changes the day after it shipped, the span from proposed to first worked
  was exactly zero for every one of them. It also made the audit log
  unreachable, since a run always happens after the file exists and the
  earliest evidence wins.
  
  Evidence of work is now a ticked task or a recorded run. The same
  measurement gives p90 0.18d and max 2.06d, and a change whose task list
  is written but untouched reports no work dates at all rather than the
  day the file was written.

## 0.59.0

### Minor Changes

- 8f2ed11: A stage may name a custom agent — a preset you defined yourself — and it
  reaches the CLI as `--agent <name>`. Accepted for the `claude-cli` and
  `copilot-cli` families, raw and ACP alike; setting one for an agent whose
  CLI takes none is rejected rather than silently dropped.
  
  `findCustomAgents` discovers them from the directories the CLIs
  themselves read: `.claude/agents/*.md` in the project and for the user,
  and `.github/agents/*.md` for Copilot. A name defined in both is offered
  once, with the project's winning.
- cba553e: The run dialog draws recommendations from the workspace's own recorded
  runs, each named for what it recommends — the cheapest here, the fastest
  here, the most likely to finish — with the figure it won on beside it.
  
  A comparison needing two candidates is not offered with one: a
  superlative over a single row claims a distinction that was never
  established, and where that happens the box says so instead. Ties name
  every candidate, and a group resting on fewer runs than the threshold
  cannot win.
- d1e15ca: `verify` now records what a change's declared mechanical checks found —
  how many ran and how many failed, as fields on an audit entry rather than
  buried in a sentence. It is recorded whether or not the verifying agent
  then runs: a `verify` whose checks failed never invokes the agent, so
  before this the run that found the most left no trace at all.
  
  A change declaring no checks records nothing, since an entry saying none
  ran reads the same as one saying none failed.

## 0.58.0

### Minor Changes

- 9f323c1: `buildWorkspaceRunStats` reads the audit log back as an aggregate over
  the workspace: per agent, and per agent and effort together. Each group
  carries how many runs it rests on and how many of those reported a cost,
  and a group below the threshold of five is reported as below it rather
  than omitted — "too little is known here" and "this has never run" are
  different facts.
  
  Runs recorded against a change that is neither active nor archived are
  excluded. Such a change was deleted, which makes it an experiment rather
  than part of the project's record; without this, a project's own smoke
  tests count as its behaviour.

### Patch Changes

- 94a295e: A per-change stage entry now overrides the fields it names and inherits
  the rest from `agent-harness.json`. It used to replace the stage's entry
  outright, so a change setting only an effort for `apply` silently
  discarded the model the global file set for that stage — and every named
  configuration did exactly that.
  
  Naming a different agent for a stage still inherits nothing: a stage's
  model, effort and budget belong to its agent, whose effort vocabulary and
  budget unit differ from another's.

## 0.57.0

### Minor Changes

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

### Patch Changes

- 9836f84: A cancelled agent run no longer leaves a timer armed. `spawnAndStream`
  armed a ten-second kill-confirmation timer on abort and never cleared it,
  so on the ordinary path — the child dies, `cancelled` is yielded, the
  stream ends — the timer stayed pending, holding the Node event loop open
  and firing into a queue nothing was reading. A cancelled CLI run could
  take up to ten seconds longer to exit than it should.

## 0.56.0

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

## 0.55.0

### Minor Changes

- c26dea5: Recommend a harness configuration for a change, with the observations it was
  chosen from shown alongside it. A new command answers which of the three named
  templates suits a change, reading only what exists for every change: how many
  tasks remain, and how previous runs ended.
  
  It recommends a template and never a figure, and the measurement is the reason.
  Across this repository's audit log, 13 of 22 changes with any record have exactly
  one run and 16 have none that reported a cost. A per-change cost drawn from that
  would be arithmetic wearing the costume of evidence — and believed, because it
  looks computed.
  
  Where there is nothing to go on, the recommendation says so in the same breath as
  its answer, so "nothing is known" cannot be mistaken for "this is what the
  evidence suggests". A change whose last run was stopped by a ceiling is moved one
  template roomier, naming the ceiling; a change stopped repeatedly asks for a
  person rather than proposing something larger again.
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
- ea25d08: Record what each stage spent, and bound it. An audit entry now carries the
  `stage` it belongs to and the `effort` the agent was asked for, so a report built
  from the log can break a change down stage by stage — every stage of a chain runs
  under the chain's own run id, so nothing else in the record could say which stage
  spent what. Both fields are optional and absent for a single-stage run, and an
  entry written before them is never given a stage after the fact.
  
  `budget.maxStageCostUsd` and `budget.maxStageTokens` bound one stage, enforced
  here rather than by the agent's own command line — which offers a spending flag
  for two of the ten supported agents. Checked when a stage ends and stopping the
  chain rather than the stage, because a run's cost is not known until it ends:
  this prevents the next overspend, not the one that happened. Neither may exceed
  its whole-chain counterpart, which would stop the run first.
  
  A run stopped by a ceiling now records the reason on the single entry it already
  writes, rather than a second one, so a finished run can be told from one a person
  cancelled.
- ba09225: Let `verify` send work back to `apply`. `verify` writes each declared mechanical
  check's result onto its own task's checkbox, so a failing check unchecks the
  task — and the chain then walked forward into `archive`, which refuses while any
  task is unchecked. The machine detected unfinished work correctly and then
  stopped with an error instead of finishing it.
  
  Where `maxStageAttempts` allows another attempt, the chain now returns to `apply`
  and records that verification is why, so a stage appearing twice is
  distinguishable from a duplicate. Bounded by that existing counter rather than a
  second ceiling, and counted per stage, so a slow `verify` cannot consume the
  allowance meant for `apply`. Where the attempts are used up — or where the chain
  was entered at `verify` and has no `apply` to return to — it stops and names the
  tasks still unchecked, rather than only counting them.
  
  With no attempt count configured nothing changes: `archive` refuses exactly as
  before.
- 960b489: Read back what a change cost. A new command — **Show What This Change Cost** —
  reports, for any change in either the Changes or Archive tree, a row per run with
  the stage, agent, effort, outcome, reported spend and duration, plus a total. It
  is offered whether the change finished or not: a change whose run was cut or
  failed is where the question is most pressing, and the live usage panel cannot
  answer it because the panel is gone once the run ends.
  
  Duration comes from records already written — a run writes a `started` and a
  terminal entry, both timestamped — paired in order rather than by key, so a stage
  sent back by `verify` produces two rows with two durations rather than one wrong
  one.
  
  Two things are deliberately not tidied. A figure the agent never reported shows
  as *not reported*, never as `$0.00`, and the total says it covers only what was
  reported: most supported agents report nothing, and showing them as free would be
  wrong where a reader is least able to check. A record too old to name its stage
  appears as *unattributed* and is still counted — dropping it would make the total
  wrong, and guessing a stage would make a row wrong.

### Patch Changes

- 2074915: The Overnight harness template now sets
  `checkpoints.requireConfirmationBetweenSteps: false`, the "no checkpoints
  between stages" its own description promised. Without it, a change
  configured from the template still paused for confirmation between every
  stage. A guard now checks each template's stated behaviour against the
  configuration it applies, in both directions.
- 7aae888: Report why an archive was refused. `openspec archive` refuses precisely — naming
  the requirement whose modified block drifted, and the scenario that would have
  been dropped — and with `--json` it says so as structured data. That reached a
  caller as the entire JSON document, sentence buried inside, because the wrapper
  turns a non-zero exit into an error string.
  
  `archiveChange` now reads the refusal's `status[]` entries and throws with their
  messages, including the report's own `fix` line, so a caller sees "…current spec
  contains scenario(s) not present in the modified block: 'The same reader returns
  the next day'. Refresh the change spec before archiving… No files were changed."
  Every error is reported rather than the first, since a change can be refused for
  more than one reason at once.
  
  It keeps throwing rather than returning the report, unlike `validateChange`:
  every caller here asks whether the archive worked and why not, not for a result
  to render.
- c3963c9: A run stopped by a ceiling now records why in the audit log. The reason
  travels on the cancel command, so a run cut by a rule can be told from
  one a person cancelled without inspecting anything else. A person's
  cancel still records no reason.
- a82b322: A mechanical check that fails at `verify` now sends the work back to
  `apply` where another attempt is configured, instead of ending the chain.
  This is the case the backward edge was written for — a failing check is
  what unchecks the task — and it was the one case the edge could not
  reach. The verifying agent is still not invoked, and a chain configuring
  no extra attempts fails exactly as before, with the same message.

## 0.54.0

### Minor Changes

- 5b61c75: Make a failing merge gate say why. `openspec validate --json --strict` exits `1`
  to report an invalid change, printing the report on stdout; the wrapper rejected
  on any non-zero exit and kept only stderr, so every ordinary invalid change was
  reported as one that could not be validated — with the diagnosis that named the
  fix discarded, and `failedItems: 0, totalItems: 0` for the change that failed.
  
  `validateChange` now treats a non-zero exit carrying a readable report as the
  report. Where no report can be read, the reported reason prefers whichever
  stream carries a diagnosis and says "no diagnosis reported" rather than passing
  off a runtime warning banner as an explanation. The CLI's per-change result
  gains an `issues` field carrying what the underlying CLI stated. The exit-code
  contract is unchanged: `1` for a validation failure, `2` only where the check
  itself could not run.

## 0.53.0

### Minor Changes

- 53a9f7d: Fix a chain run hanging forever when its agent asks for permission: `HarnessChainRunner` now routes a `"resolvePermission"` command to the runner executing the stage in flight (mirroring how `"cancel"` is already routed), instead of rejecting it as a non-`"chain"` command. Both hosts (`packages/server`'s WebSocket dispatcher and the VS Code extension's webview message handler) gain the matching routing branch, and `HarnessChainPanel` gains the Allow/Deny control needed to answer. A permission request raised under `autonomyLevel: "autonomous"` — where there is no confirmation channel — now fails the stage with a stated reason and ends the underlying process, instead of waiting on a promise nothing can resolve.

## 0.52.0

### Minor Changes

- 12b730b: Add a Human-Only Inbox view listing every open item marked as requiring a
  person, across all active changes — reachable from the change it belongs to,
  with no control to mark one done, since the rule those items live by is that
  a person reports them done after observing the thing. `readTaskChecklist`
  now marks a task `humanOnly` when its first bold span begins with
  "Human-only".
  
  Also adds two quality-gate checks in `@openspec-ui/core`, run as tests: one
  fails when a change's tasks say "Successor created: `id`" but no change
  states it follows that change, and one fails when a change's `## MODIFIED
  Requirements` block no longer matches the specification it modifies — a
  renamed requirement header or an omitted scenario — catching drift at
  pull-request time instead of at `openspec archive`.

## 0.51.0

### Minor Changes

- e78face: Read the relation between changes from core, and add a blocking one. The
  reader for `follows`/`supersedes` moves out of repository scripts and into
  `packages/core`, so the editor can use it in any workspace; `blocked_by`
  joins them, stating what must land before a change can start. The check
  that verifies them is a test rather than a lint script, so it runs with
  nothing built, and `openspec-ui-cli change-graph` renders the result.

### Patch Changes

- bfad445: Stop showing finished runs as still working. A run that reported progress
  kept that value after finishing, and the Processes view printed it beside
  the state — `usage-from-acp · completed · Running`. The marker that
  produced it is no longer reported, a terminal row no longer shows a live
  field, and journal load drops that marker from records already written.
  The lease-reclamation note, which nothing else records, is preserved.

## 0.50.0

### Minor Changes

- a61bfbe: Record the resource usage an agent reports, so a configured budget can act on it.
  
  `AgentUsage` / `AuditEntry.usage` / `buildUsageReport` / `checkBudget` were a complete chain with nothing feeding it: no adapter had ever produced a usage figure, so the chain-level ceiling had never once fired. Two adapters now report what their agent said it spent — `claude-cli-acp` from `claude`'s own terminal `result` line, and the ACP session driver from `PromptResponse.usage` and `usage_update` notifications — and the runner writes it into the run's terminal audit entry.
  
  A run whose agent reported nothing records no `usage` field at all, never a zero: absent means unreported, and a ceiling compared against an absent figure still permits the work. An ACP `usage_update`'s `used` is context occupancy rather than consumption and is deliberately not recorded; a non-USD cost is kept in its own currency rather than converted. `LIMITS.md` now says which agents report usage and which do not.
- ae78a82: Show what a chain run has spent, while it is still running.
  
  A run recorded its usage but nothing displayed it: the figure lived in `.openspec-ui/audit.jsonl` and in one line of the event log. A chain now renders a usage summary beside its event log — a row per stage that has started, with tokens and money, and the configured ceiling beside the recorded total when one is configured.
  
  Attribution needed a new event. A chain publishes every stage under one `runId` and announced a stage only when it *ended*, so the first stage's usage had no stage to belong to, and a chain that stopped mid-stage never named the stage that spent the money. `stageStarted` is emitted immediately before each stage begins — after any check that could refuse it, so a stage stopped at the budget ceiling is never announced as having started. It is non-terminal, like `agentUpdate`/`cancelling`/`usageReported`.
  
  Two kinds of figure are kept apart. The recorded total is what agents reported for finished runs and is what a ceiling is compared against. A live figure — an ACP `usage_update` arriving during a run, previously rendered as `agent update: usage_update` and discarded — is shown as the agent's own running report; its `used` is context occupancy, falls after a compaction, and never enters a token total. Nothing here enforces anything: `HarnessChainRunner.checkBudget` remains the only thing that does.
  
  A stage whose agent reported nothing reads "not reported", never `$0.00`, and a run in which nothing reported says so outright rather than showing an empty panel that looks broken.

### Patch Changes

- af32105: Let every event kind survive a transport — `cancelling` and `usageReported` were being dropped.
  
  `isEvent()` switches on `kind` and ends in `default: return false`, so a kind added to `EventKind` and to the `Event` union compiles cleanly while the guard silently rejects it. Two kinds had already gone through that gap: the VS Code webview discarded them (`message-bridge-transport` gates on `isEvent`) and the standalone app discarded them too (`fetch-transport`'s `deserializeEvent` throws inside a conservative `catch {}`). Nothing logged, nothing failed.
  
  Both shipped features built on those events were therefore inert over both transports: the "Cancelling..." status from `cancel-reports-what-happened`, and the usage display from `usage-from-acp`. Recording and budget enforcement were unaffected — `agent-runner.ts` consumes the event in-process, never through a transport.
  
  The samples in `protocol.test.ts` are now a `Record<EventKind, Event>`, so adding a kind without a guard case is a compile error rather than something to remember.

## 0.49.0

### Minor Changes

- 2ec29df: Report cancellation when it happens, not when it is requested.
  
  - New non-terminal `cancelling` event. `cancelled` is now emitted only once the agent's process has actually exited; a process that outlives the request produces a `failed` naming that, not a `cancelled` that did not happen.
  - `terminateProcessTree` reports whether the kill could be issued instead of swallowing the result, and treats POSIX `ESRCH` as success.
  - The Cancel control stays available while a run is still producing output after a cancellation, and accepts a second press.

## 0.48.0

### Minor Changes

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

### Patch Changes

- 4e59bdf: Preserve the per-change git-stage gate across OpenSpec archive so an agent-sufficient chain reaches push, pull-request checks, and merge after the active change directory is moved.

## 0.47.0

### Minor Changes

- eca84bc: Bound retained checkpoints on their own limit and stop reading every one at startup.
  
  - `WorkbenchRunJournal.load()` returns checkpoint references with a `loadCheckpoint()` reader instead of reading and parsing every payload. On this repository that read was 531 MB on every activation.
  - New `maxCheckpointSessions` (default 10), separate from `maxProcesses`: a process entry is tens of bytes, a checkpoint tens of megabytes, and one limit over both is not a limit.
  - Retention is by recency, never by process state — `canRollback` covers completed and failed runs, so evicting them by state would withdraw a rollback the product offers.

### Patch Changes

- d161b50: Preserve the per-change git-stage gate across OpenSpec archive so an agent-sufficient chain reaches push, pull-request checks, and merge after the active change directory is moved.

## 0.46.0

### Minor Changes

- 348ee61: Add `copilot-cli-acp` and `claude-cli-acp` rows to `HARNESS_AGENT_CAPABILITIES`,
  matching their plain counterparts' reasoning-effort and spending-cap
  mechanisms exactly (each ACP adapter spawns the same binary with the same
  flags, already permitted by the same allowlist entries). Add explicit empty
  rows for `codex-cli-acp` and `gemini-cli-acp`, whose adapters deliberately
  render neither flag — an absent row is what let this drift silently before.
  
  `{ "agent": "copilot-cli-acp", "budget": { "maxAiCredits": 100 } }` and the
  equivalent `effort` setting now resolve instead of being refused; the unit
  and floor checks (`maxCostUsd` rejected for `copilot-cli-acp`, `maxAiCredits`
  rejected for `claude-cli-acp`, Copilot's 30-credit minimum) are unchanged.
- 348ee61: A harness configuration file (`openspec/agent-harness.json` or a per-change
  `harness.json`) carrying a top-level key that is not `stepAgents`,
  `autonomyLevel`, `reviewGate`, `checkpoints`, `budget`, or
  `gitStageAllowlist` is now refused, naming the unrecognized key and the
  accepted set. Previously such a file resolved silently to the default
  configuration wherever the misplaced key's effect would have applied —
  found via a per-change `harness.json` whose `apply` sat at the top level
  instead of inside `stepAgents`, which loaded without error or warning and
  was never once applied. When the unrecognized key is a stage name
  (`propose`, `review`, `apply`, `verify`, `archive`, `git`), the error names
  `stepAgents.<key>` as a possible fix.

## 0.45.0

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

## 0.44.0

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

## 0.43.0

### Minor Changes

- 8a69ea0: Implement harness config strictness for stage runner selection and validation.
  
  - Replace legacy `dispatch` usage in `stepAgents` with a dedicated `vscode-chat` step-runner id.
  - Refuse `model`, `effort`, and `budget` on chat-dispatched stages because those values cannot reach any CLI invocation.
  - Reject unknown keys in `stepAgents` entries and nested `budget` objects.
  - Migrate legacy `dispatch: "vscode-chat"` / `dispatch: "cli"` shapes on read and write.
  - Update core, webui, extension, and server runtime/test coverage for the new strict behavior.

## 0.42.0

### Minor Changes

- 5cddc4d: Adds ACP (Agent Client Protocol, agentclientprotocol.com) support: a shared session driver in `@openspec-ui/core` speaks ACP JSON-RPC to whichever ACP-capable subprocess it is pointed at, and four new, additional agent adapters — `copilot-cli-acp`, `gemini-cli-acp`, `codex-cli-acp`, `claude-cli-acp` — translate an agent's structured `session/update` progress into the protocol's new `agentUpdate` event and, where the underlying agent genuinely supports it, `session/request_permission` into a new `permissionRequest` event, answerable by a new `resolvePermission` command. These are additive, separately selectable entries alongside today's five raw-text adapters — none of them change. `@openspec-ui/webui`'s AI panel renders `agentUpdate` content and shows an explicit Allow/Deny control for a `permissionRequest`; `claude-cli-acp`'s picker entry states up front that it provides progress detail only, with no permission gate (Claude's CLI has no documented interactive-permission callback in this mode). `openspec-ui-vscode` gains matching event descriptions for its own event log. `codex-cli-acp` depends on an externally installed `codex-acp` binary, detected on `PATH` like every other CLI this project already shells out to — never bundled as an npm dependency, to avoid pulling in `@openai/codex`'s native platform binary for every contributor regardless of use.

## 0.41.0

### Minor Changes

- 144e13b: A workbench process can now suspend itself to wait on an external system without holding the workspace's mutation lock. `WorkbenchProcessState` gains `"suspended"`, and `WorkbenchProcess` gains an optional `waitingFor` reason. `ProcessExecutionContext` gains `suspend(reason, { timeoutMs })`, which releases the in-process mutation lock and, where a `WorkspaceLeaseManager` is configured, the cross-host lease too — letting another mutating process run in its place. `WorkbenchProcessScheduler.resumeProcess(id)` returns a suspended process to the queue (never directly to `"running"`, so two processes suspended at once still serialize), where it re-admits under the existing lock/lease rules. Every suspension is bounded: on timeout the process fails, naming what it waited for and for how long; cancelling a suspended process ends it as `"cancelled"` immediately. A suspended process persisted across a host restart is recovered as `"interrupted"`, matching `"queued"`/`"running"`, since the poller and the in-memory wait belonged to the host that is gone. New `external-waiter.ts` provides a generic, lock-free poller for a future consumer to build on. The Processes views in both the VS Code extension and the standalone webui render a suspended process as waiting, with its wait reason, distinctly from running. This ships the mechanism only — no stage in this repository suspends yet.

## 0.40.0

### Minor Changes

- ed9e4c9: Audit records now survive a host restart. `FileAuditLog` (packages/core/src/security.ts) gains a bounded, rotating JSONL file (oldest entries dropped first, never the whole file) and a `readEntries()` to read them back. Both `packages/server` (`cli.ts`, and `optional-server.ts` on the extension side) and `packages/extension`'s direct-import mode (`extension.ts`) now construct a `FileAuditLog` under the workspace's `.openspec-ui/audit.jsonl` and share it between the runners it audits and `HarnessChainRunner`'s `listAuditEntries`, so a configured spending ceiling sums a change's persisted history across restarts rather than resetting on every editor close. `core` also exports `auditLogPath(workspaceRoot)`, the one place this file's location is decided. No change to what is recorded, to `buildUsageReport`, or to the budget's comparison logic — only to whether the records outlive the process that wrote them.

## 0.39.0

### Minor Changes

- 80a097b: A `stepAgents` entry can now set a reasoning effort and a spending cap, resolved through the same global/per-change merge as `model`. `HarnessStepAgent`'s object form gains `effort?: HarnessEffort` and `budget?: { maxCostUsd?: number; maxAiCredits?: number }` — the spending cap stays in each agent's own unit rather than one shared field, since the CLIs do not share a unit. `HARNESS_AGENT_CAPABILITIES` (`packages/core/src/harness-step-agent.ts`) is the single table both `harness-config.ts`'s validator and each adapter read: `claude-cli` and `copilot-cli` render `--effort`/`--max-budget-usd`/`--max-ai-credits`; `codex-cli` renders `-c model_reasoning_effort="<level>"` and nothing for budget; `gemini-cli` has neither mechanism. A stage entry setting a value its agent cannot express is refused when the configuration resolves, naming the agent and the accepted values, rather than being silently ignored or failing minutes into a run. `default-runners.ts`'s allowlist matcher generalizes from a single optional `--model` pair to an ordered, closed set of validated optional pairs. The webui's Harness Settings view and the VS Code extension's per-change customization wizard both offer effort/budget per stage, limited to what that stage's selected agent accepts. An entry without the new fields produces a byte-identical command line to before this change.

## 0.38.0

### Minor Changes

- d0be00e: A `"cancel"` command now stops the run it names instead of starting a second, billable agent process to ask the first one to stop. `spawnAndStream` accepts an optional `AbortSignal`; on abort it terminates the spawned process **tree** (via `taskkill /T /F /PID` on Windows, so a `.cmd`-shimmed agent like `copilot` is not orphaned) and ends the stream with `cancelled` rather than letting the killed process's non-zero exit surface as `failed`. `AgentAdapter.execute()` now receives that signal and every adapter (`claude`, `copilot`, `codex`, `gemini`, `local-llm`) forwards it. `createAgentRunner`'s returned runner tracks each run's `AbortController` by `runId` and handles a `"cancel"` command itself — aborting the matching run without calling `buildInvocation()`, calling `execute()`, or recording a run start; cancelling an already-finished or unknown `runId` is reported as `cancelled`, not an error.

## 0.37.0

### Minor Changes

- 8f60b09: Checkpoint sessions are now stored one file per session under `.openspec-ui/checkpoints/<processId>.json` instead of embedded in `.openspec-ui/workbench-runs.json`; the journal keeps only a `{ processId, changeName? }` reference per session. A live workspace's journal had grown to 356.6 MB because every process state change re-serialized every retained checkpoint (up to 20 MB each) along with it — recording a process's state now only rewrites the small journal, and a finalized checkpoint is written once and never rewritten. `WORKBENCH_RUN_JOURNAL_VERSION` moves to `2`; a version-1 journal is migrated automatically on first load, writing its embedded sessions out as files. A checkpoint file that no journal entry references (e.g. left behind by an interrupted write) is removed on load; a referenced file that is missing degrades to "no recoverable checkpoint" for that process rather than failing the whole load.

## 0.36.0

### Minor Changes

- dc71cec: Added a `verify` stage to the Agentic Harness chain, running after `apply` and before `archive`, per `docs/adr/0018-event-driven-harness-orchestration.md` gap 1. It reviews the implementation against `tasks.md` and the change's spec delta, and unchecks any task whose stated verification does not actually hold — the existing archive gate (which already refuses to archive a change with unchecked tasks) is what stops the chain, not a new outcome or gate.
  
  `CommandKind` gains an additive `"verify"` member; `commandInstruction("review")` is reworded to describe reviewing the change's proposal (its actual job at chain position 2), resolving the standing contradiction with its old "review the current implementation" wording. `HarnessStage`/`STAGES` gain `"verify"` between `"apply"` and `"archive"`; `HarnessChainRunner`'s `CHAIN_STAGES` and `determineStartStage()` are updated to match — a change whose tasks are all checked but isn't yet archived now resumes at `verify`, not `archive` directly. `stepAgents.verify` resolves through the same global/per-change merge as every other stage.
  
  `security.ts`'s `AgentPromptContextOptions` gains an optional `verifiedDelta` field; when present, `prepareAgentContext()` adds a labelled section carrying the verified run's changed files, truncated with a visible count if oversized, and never sourced from `GitWrapper.diff()` (which would leak a concurrent session's unrelated uncommitted work). `HarnessChainRunner` sources this from a checkpoint captured around the `apply` stage, best-effort — a chain with no delta available (or one that never captures a checkpoint) produces the exact same prompt as before this change.
  
  `packages/extension`/`packages/webui`: the hand-maintained stage lists in the per-change harness config wizard (`commands.ts`) and the Harness Settings view (`HarnessSettingsView.tsx`) now include `verify` in chain order.

## 0.35.0

### Minor Changes

- 6ed2d1a: Added accounting plumbing for a run's resource usage and observed agent version, and an optional cost/token budget for Agentic Harness chains.
  
  `AuditEntry` (security.ts) gains optional `usage`, `agentVersion`, and `changeDir` fields — all optional, so audit lines written before this change stay valid. `agent-detection.ts` now captures a best-effort agent version from the `--version` probe it already runs (no second spawn) via a new `detectAvailableAgentsDetailed()` export; the existing `detectAvailableAgents()` boolean-map contract is unchanged. New `agent-usage.ts` defines the adapter-agnostic `AgentUsage` shape; new `usage-report.ts` aggregates recorded usage by agent, by model, and by change, distinguishing unmeasured runs from zero cost. New `verified-agent-versions.ts` holds the single `claude` CLI version this project's structured-output parsing was verified against.
  
  `HarnessConfig` gains an optional `budget` (`maxCostUsd`/`maxTokens`); `HarnessChainRunner` checks it before starting each stage of a chain and refuses to continue once recorded usage reaches it, naming the budget as the reason. A run already in progress is never interrupted. `WorkbenchProcess` gains an optional `usage` field so a run's recorded cost can be shown in the Processes view (extension tree, webui table) when present — never as `$0.00` when absent.
  
  No adapter is changed by this commit: nothing yet produces `AuditEntry.usage`, so the budget stays inert until a future change (`acp-agent-adapters`) adds a producer.

## 0.34.1

### Patch Changes

- d15f4cb: An Agentic Harness run's prompt now includes the project's own instructions for the artifact being worked on (`implement` -> `tasks`, via `openspec instructions <artifact> --change <id>`), in a section labelled as rules to follow, ahead of the change's own content. Previously `prepareAgentContext()` built a run's prompt from only `proposal.md`/`design.md`/`tasks.md`/`specs/*/spec.md`, so rules such as "mark each task as soon as its own verification passes" never reached an agent run through this path, even though they were reachable via the CLI. When the rules lookup fails or returns nothing, the run proceeds exactly as before. `copilot-cli`'s fallback prompt (used once the rules addition pushes prompts past its argv length threshold) now also tells the agent to run `openspec instructions tasks --change <id>` itself.

## 0.34.0

### Minor Changes

- db0e717: Agentic Harness `stepAgents` entries may now declare `dispatch: "vscode-chat"` (alongside the existing `"cli"`, the default) to hand a stage's prompt to VS Code's own chat instead of spawning a CLI subprocess — the same `workbench.action.chat.open` dispatch `openspec-ui.startImplementation` already used, now reachable through the harness. Valid only under `autonomyLevel: assisted`, and only in the VS Code delivery target; resolving it in the standalone server is a configuration error rather than a silent fallback to a CLI. Such a stage emits `started` followed by a new non-terminal `handedOff` event, never `completed` — nothing observes the chat session's work. Existing configurations are unaffected: absent `dispatch`, every stage behaves exactly as before.
- 6b13d58: Agentic Harness `stepAgents` entries may now name a model alongside the agent (`{ agent, model }`, in addition to the existing bare agent id string), passed as `--model <value>` to `claude-cli`/`copilot-cli`. Lets a change configure a cheap model for `apply` and an expensive one for `propose`/`review`/`archive` on the same CLI. A model is validated against a closed character set and against the target agent's registry entry at config-read time, before any run starts.

### Patch Changes

- 6b13d58: Agent presence detection now allows a CLI 10 s to answer a `--version` probe instead of 3 s. On a loaded Windows machine `copilot --version` measured 4.96-6.51 s and `claude --version` 1.61-2.72 s, so an installed, working CLI was annotated as "not detected". A genuinely missing executable still resolves immediately via `cross-spawn`'s `error` event rather than waiting out the budget, and probes still run in parallel, so the worst case grows once, not per agent.
- d9084ab: An Agentic Harness chain now decides between the `apply` and `archive` stages from the change's own `tasks.md` checkboxes, and refuses to archive while any task is unchecked. Previously `statusChange()` synthesized a `progress` value from artifact presence when the CLI reported none, where an artifact being "done" means only that its file exists; a change with all four artifact files written and every task unchecked therefore reported `remaining: 0`, and a chain skipped `apply` and archived it unimplemented. `progress` is now optional on `OpenSpecStatusResult` and absent when the CLI reports none, rather than fabricated. When task completion cannot be determined at all, a chain starts at `apply` and refuses to archive, so an unknown signal never selects the irreversible stage.

## 0.33.2

### Patch Changes

- 5ce55ae: Fix `claude-cli` runs stalling on an unanswerable Edit/Write/Bash permission prompt in non-interactive mode. `buildInvocation()` now passes `--dangerously-skip-permissions`, matching the existing non-interactive-bypass posture already used by `copilot-cli` (`--allow-all-tools`) and `gemini-cli` (`--yolo`).

## 0.33.1

### Patch Changes

- 3f294f3: Fix `copilot-cli` `plan`/`review`/`implement` runs failing outright
  (`copilot exited with code 1`, no work done) for any change whose combined
  `proposal.md`/`design.md`/`tasks.md`/delta-spec content is large — a
  direct side effect of the `agent-prompt-context` fix, which made prompts
  carry real content instead of being nearly empty. `copilot -p` delivers
  the prompt only as a positional CLI argument (no stdin path), and
  cross-spawn resolves its npm-global `.cmd` shim through `cmd.exe`, whose
  own command-line length budget (~8191 characters) is easy to exceed once
  real file content is embedded. `CopilotCliAdapter` now falls back to a
  short prompt naming the change's directory and instructing the agent to
  read its files itself (it already runs with `--allow-all-tools`) whenever
  the full embedded prompt would be too large, instead of failing.
  
  See `openspec/changes/copilot-prompt-length-limit/` for the full
  diagnosis (reproduced live; the raw stderr bytes decode as CP866 to the
  Russian-language OS text for "the command line is too long").

## 0.33.0

### Minor Changes

- b21d2f4: Fix `prepareAgentContext` sending an effectively empty prompt to every
  `plan`/`review`/`implement` run (single-stage or as part of a `"chain"`)
  for every agent, since the product first shipped: it now actually reads
  and embeds the change's real `proposal.md`/`design.md`/`tasks.md` and any
  delta-spec content under the run's `changeDir`, instead of relying on a
  `promptContext` field that no caller has ever populated. Also adds an
  explicit instruction to work only within the named change directory, as
  additional insurance against an agent wandering to a different
  `openspec/changes/<id>/` directory than the one it was asked about — found
  live when a `copilot-cli` `implement` run picked a different change to
  work on than the one actually selected.
  
  See `openspec/changes/agent-prompt-context/` for the full diagnosis and
  fix. No change to the allowlist/cwd-sandbox/audit security boundary —
  `prepareAgentContext` still cannot affect what gets run or where.

## 0.32.0

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

## 0.31.0

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
- da70d78: Standalone app's "OpenSpec view summary" tab now renders active and
  archived changes as searchable lists (by name or status), using the
  shared `ChangesList`/`ArchiveList` components instead of a static table;
  archived changes now show real task progress and a last-modified date.

## 0.30.0

### Minor Changes

- Add a cross-host workspace lease (docs/adr/0010-cross-host-workspace-lease.md) so at most one host process — a VS Code extension or a standalone server, pointed at the same workspace — can run a mutating operation at a time. A blocked host gets an immediate, actionable error naming the other host instead of racing it or queuing forever. The standalone server's own `implement` execution is now routed through the same mutation lock and lease (it previously bypassed the scheduler entirely), closing a pre-existing same-host gap alongside the cross-host one.

## 0.29.0

### Minor Changes

- Add a downloadable sprint summary PDF report: for a user-picked date
  range and set of changes, who authored each one (from git), what it
  was, task completion, plus aggregate statistics (total changes, tasks
  completed in range, a per-author breakdown). New "Sprint report" mode
  in the standalone Timeline tab.

## 0.28.0

### Minor Changes

- Add stale-pending-task detection: a pending task untouched (per git
  blame) longer than a configurable threshold (default 14 days) is now
  flagged in the Change Timeline view. Configurable via a number input in
  the standalone Timeline tab and the new `openspec-ui.staleTaskThresholdDays`
  VS Code setting.

## 0.27.0

### Minor Changes

- Add a best-effort, git-derived change timeline data layer: created date,
  archived date, and a per-task completion date (via `git blame` on
  `tasks.md`, `null` for still-pending tasks), plus proposal/design/spec
  content in one read. New `getChangeTimeline`/`getChangeTimelines` in
  `@openspec-ui/core`, `POST /api/change-timeline`/`/api/change-timelines`
  in the standalone server, and a matching webui client. No UI yet — this
  is the shared data layer for a "change timeline" view, coming next.

## 0.26.0

### Minor Changes

- Add an archive-time Changesets reminder to the VS Code extension. When a
  workspace has adopted Changesets (`.changeset/config.json` exists) and no
  changeset is currently pending, archiving a change now offers to run
  `npx changeset` in an integrated terminal. Silent for workspaces that
  have not adopted Changesets, and never affects the archive operation's
  own result.

## 0.25.0

### Minor Changes

- Add a new built-in template, `adopt-changesets` (category
  `release-management`), for proposing Changesets adoption in an npm
  workspaces monorepo from an OpenSpec change. It bakes in the
  `privatePackages` configuration gotcha discovered adopting Changesets in
  this repository, and a verification step that confirms a real changeset
  actually changes a version and changelog rather than trusting a clean
  exit code.
