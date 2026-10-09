# @openspec-ui/cli

## 0.28.0

### Minor Changes

- 70707eb: **Breaking: every action is a verb and a noun** (every-action-is-a-verb-and-a-noun, ADR 0045). Every extension command is renamed to `<Verb> <Noun>` from approved lists, with the id `openspec-ui.<verb><Noun>`, the category "OpenSpec Workbench" and an icon of its own - no two commands show the same picture: "Configure Harness for this Change" is **Configure Change Harness**, "Run..." is **Run Change...**, "Say Something to This Run..." is **Send Message...**, "It Was Me..." is **Confirm Key...**, "Review Diff (tasks.md vs HEAD)" is **Show Diff**; the full table is in ADR 0045. Former command ids are not kept: a key binding that used one needs the new id. "Validate Change (Strict)" is gone - **Validate Change** is strict and asks for a change when none is selected. Every `openspec-ui-cli` subcommand is a pair too: `validate changes`, `run change`, `update plan`, `run checks`, `show readiness`, `diagnose workspace`, `show advice`, `show lease` / `remove lease`, `show status`, `set presence`, `set lock`, `stop run`, `confirm key`, `join team`, `show people`, `show history`, `show stages`, `set owner`, `set implementer`, `reopen change`, `complete task` / `reopen task` / `commit tasks`, `show questions` / `answer question`, `create worktree` / `show worktrees` / `move worktree` / `delete worktree`, `show graph`, `write manifest`. A former subcommand is refused with `error OSW-CLI-001`, naming its replacement. Core gains `action-vocabulary.ts`, the verbs and their groups, and the nouns, and every hint and message that names a command names it by its pair.

## 0.27.0

### Minor Changes

- c8de5d2: The agent asks the operator, and nothing goes on without an answer (the-agent-asks-the-operator, ADR 0042). Agent stages are told to print `Question for the operator: <question>` for each decision the change's files leave open, and `local-llm-acp` can ask mid-turn with its `ask_operator` tool. Each question is kept in the change's `decisions.md` and the audit log. A run that asked waits instead of completing, under every autonomy level, and once every question is answered it runs the stage again with the answers (`update` after `propose` or `review`). Agent runs on a change with an open question are refused, naming it. Questions are answered on the change's card, in the AI and chain panels, in the Human-Only Inbox, with `openspec-ui-cli answer`, or in `decisions.md` itself; `openspec-ui-cli status` and the supervisor say how to answer a waiting run. The run and chain panels also offer every permission request still pending, each with its own Allow and Deny, rather than only the latest: an agent that runs tool calls side by side asks for several at once. A new `permissionSettled` event says in the run's stream that a permission request was answered, on whichever surface, or withdrawn by the agent (it cancelled the request, or its turn ended with it open), and the request leaves every panel, as do the requests of a stage that has ended.

## 0.26.0

### Minor Changes

- 5ad8000: The plan is updated from its review (the-plan-is-updated-from-its-review, ADR 0041). A new command, `update`, revises a change's existing planning artifacts so they answer its last completed review and the operator's notes, keeps them coherent, validates the change strictly and changes no code. A review now ends with `Review verdict: ready` or `Review verdict: changes needed`; in a chain, `changes needed` runs one update on the review's agent before apply. The AI panel offers `update` with a notes field, a card whose last review asked for changes offers **Update the plan**, and the CLI has `openspec-ui-cli update <change> [--note <text>] [--agent <id>]`. An update from the terminal asks there for each permission its agent requests, and denies it where nobody can be asked. A review whose agent printed its findings without reporting a result now keeps them in the audit log, so the update can read them.

## 0.25.1

### Patch Changes

- 44ec9b7: simple-git 4.0.2, which fixes two critical advisories in earlier versions (GHSA-v5rq-49vh-5v5c, GHSA-x6jw-m9v5-85vh) (simple-git-4). simple-git 4 removes `GIT_` and other guarded variables from the environment of the git it starts; the product now opens git through one function that lets through only what a person set up to reach a remote - `GIT_ASKPASS`, `SSH_ASKPASS`, `GIT_SSH`, `GIT_SSH_COMMAND`, `GIT_SSH_VARIANT`, `GIT_TERMINAL_PROMPT` - so pushes keep authenticating, and keeps every other guarded variable away from git.

## 0.25.0

### Minor Changes

- 22dbe5e: The supervisor can act on a failed stage (the-supervisor-changes-agents, ADR 0039 decision 4). Under `supervisor.mode: "act"`, set in a change's own `harness.json` together with `autonomyLevel: "autonomous"` and more than one attempt per stage, a stage whose failure is likely to pass is attempted again on the same agent, and one that repeating cannot fix is moved to the first agent of `supervisor.fallback.<stage>` the change's policy allows: `allowProviderChange` for another provider, `allowCostIncrease` for any agent but the local model. Every repeat and move is said in the chain's events, recorded in the audit log, and costs an attempt; a chain says `failed` only for a stage it does not try again. Every registered agent now names its provider. Under `advise`, the last-run suggestion names the fallback `act` would use. A change's Harness Settings offers Act under Autonomous, with the fallback per stage, the allowances and a note on cost and providers; `openspec-ui-cli run` prints why a stage is attempted again.

## 0.24.0

### Minor Changes

- 7c87236: A Pipeline card works its change's tasks in the worktree made for it. A
  task's hint now holds all of it, and selecting a task opens it whole beside
  the board. For a change in its own worktree, a card closes or reopens a
  task with a note written under it (required for a Human-only or delegated
  task), commits that `tasks.md` alone and pushes the branch, and runs a
  delegated task on its agent. Refused while a run works there. The change's
  name opens its task list where it is worked: `tasks.md` from the worktree
  in the editor, which looked only in this checkout and so opened nothing for
  a change not yet merged; a page of its own in a new browser tab in the
  standalone app. An open card can hide its done tasks. From a terminal:
  `openspec-ui-cli task done|reopen <change> <number> [--note]` and
  `openspec-ui-cli task commit <change>`. Cards read from anywhere else stay
  read-only (ADR 0026, amended).
- 5f45ce9: A failed run says what is known about why, and the supervisor points out
  runs that need you. When a run fails, its reason and the end of what it
  printed are matched against causes that have been seen: the agent is not
  installed, not signed in, blocked by the machine, cannot reach the
  network, was rate-limited, or the service failed. The diagnosis says
  whether repeating can help, quotes the line it was found in, and says what
  to do instead. It is shown beneath the failure in both hosts, on the
  change's card and in `openspec-ui-cli run`.
  
  The supervisor (`supervisor.mode`, `advise` by default) adds three
  suggestions beside the others in the Pipeline and in `openspec-ui-cli
  advise`: a run that has said nothing new for longer than
  `supervisor.silentAfterSeconds` (600), a run that has waited on a person
  for longer than `supervisor.waitingAfterSeconds` (60), and a change whose
  last run failed for a cause repeating cannot fix. It suggests and changes
  nothing. Set it to Off from either Harness Settings view.

## 0.23.0

### Minor Changes

- cc63798: The local LLM agent is built in. `local-llm-acp` no longer starts an
  external `coding-agent` that you had to find and install: it is a coding
  agent inside the product, against your OpenAI-compatible server, with
  tools to read, write, replace in a file, list, search and run a command,
  all confined to the change's working directory. Each tool call and its
  result shows in the run. It reads a tool call the model wrote as text
  when the server's parser did not recognise it, as SGLang's `hermes`
  parser does with Qwen3.6. Turn on
  `openspec-ui.localLlm.agent.askBeforeCommands`
  (`OPENSPEC_UI_LOCAL_LLM_ASK_BEFORE_COMMANDS=1`) to allow each command
  yourself.
  
  The model is optional for `local-llm` and `local-llm-acp`: a stage may
  name one, the settings may, and otherwise the server is asked which model
  it serves. A model id may now contain `/`, as Hugging Face names are
  written.
  
  Agents can ignore the system proxy: `openspec-ui.agents.ignoreSystemProxy`
  (`OPENSPEC_UI_IGNORE_SYSTEM_PROXY=1`). The local LLM agents then connect
  directly, and CLI agents start without the proxy variables and with
  `NO_PROXY=*`.
  
  A run that failed inside an ACP agent (any of them, not only
  `local-llm-acp`) used to say only "Internal error" — the Agent Client
  Protocol's own fixed text for an unhandled exception, with the actual
  cause (an HTTP status, a bad key, a timeout) discarded. It now says that
  cause.
  
  With `openspec-ui.localLlm.agent.askBeforeCommands` on, clicking Allow on
  a direct (non-chain) run used to remove the prompt and then go nowhere —
  the answer reached a fresh, unrelated agent instance instead of the one
  actually waiting on it, so the run sat there until cancelled by hand. It
  now reaches the right one.

## 0.22.1

### Patch Changes

- c92b45e: Fix the packaged CLI ESM bundle so it resolves `yaml` without a dynamic require error.

## 0.22.0

### Minor Changes

- 39a5eee: Every change has a stage, and you can see how long it spent in each
  
  Each change now has a stage: Proposed, Planned, In progress, In review,
  Landed or Archived. Nobody sets it. The stage comes from what has already
  happened: commits, ticked tasks, runs, the pull request being opened and
  merged, and the archive. When a change is sent back, it returns to the
  stage it was sent to and moves forward again from there, so a change can
  pass through a stage more than once.
  
  `openspec-ui-cli stages` lists where every change is, for how long, and
  who owns and implements it. `openspec-ui-cli stages <change>` shows each
  time the change entered a stage and the total time it spent in each.
  Pull request times are read from GitHub, GitLab or Gitea.

## 0.21.0

### Minor Changes

- 99923cf: A change has an Owner, an Implementer and a history
  
  Each change can now have an Owner, who answers for it, and an
  Implementer, who does the work, by hand or through agents. Who holds a
  change comes from its history: one signed file per event in
  `openspec/changes/<id>/history/`, committed with the change.
  
  - `openspec-ui-cli owner` records who owns the change.
  - `openspec-ui-cli implementer` records who implements it.
  - `openspec-ui-cli send-back` returns the change to an earlier stage with
    a reason, reopening the task items you name.
  - `openspec-ui-cli history` shows it all.
  
  Only the Owner hands a change on, and an agent's action is marked as the
  agent's. The merge gate refuses any history that was edited or deleted.

## 0.20.0

### Minor Changes

- ffd38c0: A team's people are in the repository
  
  Each person on a team now has a file in the repository,
  `openspec/people/<handle>.json`, holding their name and a public key for
  each machine they work on. Every colleague and every machine can then
  verify what a person, or an agent working for them, signs, with no
  server. Join with **OpenSpec Workbench: Join the Team** in the editor, or
  `openspec-ui-cli join --handle <handle> --name <text>`, then commit the
  file in a pull request. The merge gate keeps these files sound: a key is
  retired, never removed, so what it signed keeps verifying. This is the
  first step of team work (ADR 0037).

## 0.19.0

### Minor Changes

- fddf66f: Every run keeps a log, and a change's card opens it
  
  A run's output used to vanish when the run ended. Now every run writes
  what it said to `.openspec-ui/runs/`: output and errors, the agent's
  replies and reasoning, tool calls, stages, stops, and how it ended,
  including a run that was refused and why. Each log is capped at 5 MB and
  the newest 200 are kept.
  
  Each card in the Pipeline, in the standalone app and in the editor's
  panel, has a Logs button. It lists the change's runs, newest first, and
  shows each one's log.

## 0.18.0

### Minor Changes

- fee5511: A change is archived only when it owes nothing
  
  `archiveChange` refuses a change that still has an item open, or a
  human-only or delegated item closed with nothing written under it, and
  names each. Every way this product archives - the Pipeline, the editor,
  a harness stage, the standalone server - goes through it.
  
  The merge gate takes `--base <ref>` and holds every change a pull
  request archives to the same rule, however the archive was made -
  including `openspec archive` run directly, which this product does not
  control. It compares the archive's two listings and needs no history,
  and a base it cannot read fails the gate rather than passing it.
  
  What an item still owes is decided once, in core, and read by both.

## 0.17.0

### Minor Changes

- 99015a0: A change lands with nothing open
  
  A task item now ends in one of three ways, and all three are closed:
  **done** (with what was done and by whom), **waived** (a person looked
  and decided not to), or **deferred** (a judgement about the shipped
  thing, which moves to the workspace's deferred list and stops holding a
  change open).
  
  The merge gate takes `--change <id>` and refuses that change where any
  item is open, or where an item marked human-only or naming an agent is
  closed with nothing written under it. It applies to that change alone:
  a pull request for one change never fails for another change's open
  item.
  
  `openspec/deferred.md` holds the questions that outlive their changes,
  each naming the change that raised it, and the Human-Only Inbox reads
  it. Reading them out of the archive instead was measured and rejected:
  285 archived changes, 1.76 MB, 309 ms on every collection.
  
  Two words are new where there was silence: a change whose items are all
  closed but which has no pull request at all, and one whose pull request
  was closed without merging.

## 0.16.0

### Minor Changes

- 209578a: Two agents on one machine can see each other. An agent that is not a run
  can report itself into the same status directory a run reports into -
  `openspec-ui-cli present` - so the Pipeline shows it and another agent can
  read it. A resource this machine has one of, such as the browser capture
  suite, can be held by a signed claim - `openspec-ui-cli claim
  browser-suite` - which says who holds it, waits a bounded time saying so,
  expires by heartbeat, and reports rather than proceeding.

## 0.15.1

### Patch Changes

- a0520c9: A run started from the terminal takes the notes and questions addressed to
  it, and writes the answers it owes: the channel was wired into the editor
  only. An answer now carries what the agent actually said - the stage's
  closing summary where it has one, and otherwise the tail of what it
  streamed - instead of reporting that a stage with no summary said nothing.

## 0.15.0

### Minor Changes

- 48bf1a1: A run can be told where to stop, not only that it should
  
  Asked for by the owner: say to a live run "only up to 4.6" without
  interrupting it.
  
  A request to stop can now name a task of the change. The run holds it and
  goes on working; when that task is ticked, or its agent says it is
  starting a task after it, the request becomes the stop the run already
  knew how to honour, and it ends where the work is sound. Nothing pauses,
  so nothing holds a lease while doing nothing.
  
  It travels on the same signed channel as a plain stop, with the same
  roster check and the same freshness window, and the chain's ending entry
  names the task it was told to stop after beside the reason and the asker.
  
  A request naming a task the change's list does not have is refused and
  recorded, and the run goes on: a typo must not become "stop now". One
  naming a task already ticked stops the run at the next sound point and
  says the point had passed.
  
  From a terminal: `openspec-ui-cli stop <instanceId> --reason "..." --after
  4.6`. From the editor: "OpenSpec UI: Stop This Run After a Task" on a
  change's row, which asks for the task and the reason.

## 0.14.0

### Minor Changes

- 352b8a6: A run in another worktree can be asked to stop, through ADR 0028's signed channel.
  
  - A request to stop is a file of its own in `.agent-messages`, beside the status and roster directories and inside no working directory. `askRunToStop` seals it with the asker's machine key. `readStopRequests` opens each envelope before parsing it, and gives a run each request addressed to it either to act on or refused as unverified, stale or already read. A request that does not check out is attributed to no run; `openspec-ui-cli status` reports it by file name.
  - A run reads its requests at each renewal of its status record. A verified, fresh and new request stops it where its work is sound, as a card's Stop would: the host's `onStopRequested` calls `requestStop` with the enrolled person as `by`, and a chain's ending entry carries the request's `messageId`. A refused request is said once in the run's activity and recorded as an audit message. The server's socket runs, the delegated item run, the CLI's run and the extension's runs all read requests, and the sweep removes request files long past their window.
  - `openspec-ui-cli stop <instanceId> --reason <text>` asks a live run to stop and prints the message id.
  - A Pipeline card offers Stop on a run held elsewhere only when its verified record is signed by the person this host's key is enrolled as. It then says it is waiting for the run to read the request, and later that the run has not. Any other run held elsewhere states whose it is, or that it is not verified. The standalone server answers `POST /api/runs/ask-to-stop`, and the editor's Pipeline panel `openspec-ui/ask-to-stop`; both ask only a run they read as live.

## 0.13.0

### Minor Changes

- 604e575: A run is signed by its person. Each person gets an Ed25519 key per machine, made on first need under `~/.openspec-ui/identity`. A run seals its status record's exact bytes with that key, and a reader verifies them before it parses anything. Every record reads as one of three states: verified (signed by an enrolled person), unverified, or does not check out. A record that does not check out shows nothing from its contents, and the sweep keeps it.
  
  A key that signs a live run and is not enrolled waits in the Human-Only Inbox of both hosts with "It was me". It is also listed by `openspec-ui-cli enrol`. `status` and the Pipeline's run lines say whose a run is, as far as its signature shows.

### Patch Changes

- f25c29a: A change says where it stands. Core reads each change across this checkout, every working directory, `main`, the change's own branch and, where `gh` can read it, its pull request (`readChangeStandings`). It also says how fresh each of those sources is. `describeChangeState` gives the one word every surface shows: Running, Waiting, Archived on main, Merged in #N, Deleted on main, Further along, Failed or Stopped at a stage, Done, Blocked, or Ready. The lines beneath the word name their sources, and a colour agrees with the word.
  
  Where the word shows:
  
  - The VS Code Changes tree and the standalone Changes list show it, and `openspec-ui-cli ready` prints it.
  - The run dialog in both hosts leads with it, and asks before starting a change that is running, settled on `main` or merged.
  - The Changes list and the Pipeline gain a Refresh that fetches refs now.
  
  A delegated run now records its request and its reply in the audit log, and the waiting-on inbox shows the latest reply beneath its item. The delegated prompt asks the agent to answer within its turn.

## 0.12.1

### Patch Changes

- 65ea319: A change is running when its run's status record says so: readiness reads the records beside the leases, and a record-only run carries `reportedBy` with no holder. `ready` names the directory and no author for such a run. A worktree on a branch named after an active change says whose it is (`belongsTo`), and the Pipeline tab draws that change once.

## 0.12.0

### Minor Changes

- a36e5a1: A run says which task it is on, and when it is waiting.
  
  The implementing instruction now asks the agent to print a line of its own, `Starting task <number>`, before it starts a task. A run's status record reads that line and keeps the task, and a run waiting at a checkpoint or on a permission says so instead of looking like it is still running.
  
  - Core: `readTaskMarker` reads a marker line — plain, in bold or backticks, after a quote, list or heading mark, with a title after a colon — and nothing in running prose. `taskInHand` pairs a recorded number with the change's own task list and names no task for a number the list does not have.
  - The status record gains `runId`, `task` (`{ number, source: "agent" | "command", since }`) and `waiting` (a checkpoint with its stages, or a permission with its description). A marker is read from stdout and from the agent's reply, never from its reasoning or a tool call's title; every completed line of a chunk is read, so a message that arrives whole keeps its marker. The task and the wait are written at once, outside the once-a-second limit on streamed activity. A run started for one task (`taskNumber`) keeps that task whatever a marker says. A record written before these fields reads with all three `null`.
  - The survey's runs carry `runId`, `waiting` and the task in hand, and `describeRun` says `on task 1.2: <text>, by its own account` or `the task it was given`, and `waiting to continue to <stage>` or `waiting for a permission: <description>` in place of the stage.
  - `openspec-ui-cli status` prints the same task and wait lines, and its `--json` carries the three fields as the record holds them.

## 0.11.1

### Patch Changes

- 1241027: A stale status is swept.
  
  A run that crashed left its status record behind for good, and a write that died between writing and renaming left its temporary file; the reader walked every one of them on every poll. Core gains `sweepAgentStatuses`, separate from `readAgentStatuses`, which stays a pure reading: it removes a record whose heartbeat is past the staleness window only if it is still past it when read again immediately before removal, removes a record's temporary file once it is older than the same window, never removes a malformed record, and treats a file already gone or momentarily in use as nothing to do. It reports what it removed. The sweep runs where the directory is already being looked at — a status writer as it starts, `openspec-ui-cli status` before it reads (removals are said on stderr), and the Pipeline tab's survey — with no timer of its own. A status record's fields are pinned by a test, so it cannot quietly start keeping history that a sweep would then throw away.

## 0.11.0

### Minor Changes

- b69f3c6: An agent says what it is doing.
  
  A hung agent renews its workspace lease exactly as a working one does, and
  its process still answers to a liveness check — the missing signal was
  never liveness, it was progress. Every run now writes its own status file
  into a directory shared by every working directory of a repository and
  outside all of them, so removing one never takes the record with it. It is
  named by the run's own identifier, never by a person, because one person
  routinely runs two agents at once; the identifier is repeated inside the
  file, so a record found under the wrong name is reported rather than read
  as that run's.
  
  A status is renewed on the workspace lease's own interval and reads as gone
  past the lease's own staleness window — one meaning of "gone", not two. It
  reports how long it has been since a run last said what it was doing, and
  never whether that run is stuck, hung, or unhealthy: a long turn and a hang
  produce the same silence, and telling them apart stays a person's judgement.
  
  Every run keeps one — started from the terminal, the standalone app or VS
  Code, a single stage or a whole chain — and neither the run nor its events
  wait for it. What it says is the chain's stage, the last complete line an
  agent wrote, or the tool it is running (`Bash: npm test`); streamed output
  rewrites the file at most once a second. `openspec-ui-cli status` prints
  every run of a repository — who, where, doing what, since when — and exits
  `0` whether or not anything is running, the same reasoning `ready` and
  `lease` already use.

### Patch Changes

- e0edfbe: A running agent now says what it is doing: which file it reads or edits, which command it runs, and which call failed.
  
  While `claude-cli-acp` worked, the AI panel repeated `agent update: assistant` and the terminal printed nothing but the agent's final words. The adapter forwarded Claude's own stream under ACP's name, so nothing downstream could read it, and no surface showed a tool call or a plan from any agent. The adapter now translates Claude's stream into ACP's own session updates — the agent's text, each tool call titled by what it acts on (`Edit packages/core/src/index.ts`, `Bash: npm test`), and each result as completed or failed. Core gains `describeAcpUpdate`, which reads an ACP update into one line and knows no particular agent; the AI panel, the chain panel, the VS Code output channel and the terminal all show that line. An update with nothing in it a person can read — Claude's own bookkeeping lines, a usage figure, a tool call that simply completed — is no longer listed by its kind in either panel or the output channel; it still reaches the event stream and the JSON output.

## 0.10.0

### Minor Changes

- 15363ee: Working directories go under one root, and removal takes their run history first.
  
  A change's working directory is created at `<root>/<repository>/<change>` rather than beside the repository, so a folder of repositories stays a folder of repositories. The root comes from `OPENSPEC_UI_WORKTREE_ROOT`, then `~/.openspec-ui/settings.json`, then the repository's parent — and never from the repository's own configuration, which travels to every checkout.
  
  `worktree remove` now merges the directory's `audit.jsonl` into the repository's own before deleting anything, and names what it is discarding. The directory's `.openspec-ui/` is gitignored and `git worktree remove` does not see ignored files, so until now the run history every recommendation, timeline and quality figure is built from went with the directory.
  
  `worktree list` reports a directory that is not under the root, and `worktree move` relocates one on request — never as a side effect, since something may be pointing at the path it has.

## 0.9.0

### Minor Changes

- f6b9389: `openspec-ui-cli doctor` reports what this machine and this workspace are
  missing before a run is started, instead of leaving it to be discovered
  by being refused: the runtime against the pinned engines, the `openspec`
  CLI, which agents are installed, whether the harness configuration reads,
  who holds the workspace, and whether a git identity is configured.
  `--change <id>` adds the preflight's own answer for one change. Exit `0`
  nothing would stop a run, `1` something would, `2` it could not look.
- 4940254: The readiness report's facts are now offered as suggestions: which ready
  changes can be started alongside each other, which is ready with nowhere
  to run, and which workspace is held by a run that stopped reporting
  itself. Each carries the fact it came from and the exact commands, shown
  in the Pipeline tab and printed by `openspec-ui-cli advise`. They create
  nothing and start nothing, they name every maximal set rather than
  choosing one, and `hints.enabled: false` means they are not computed at
  all.

## 0.8.0

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

## 0.7.0

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

## 0.6.0

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

## 0.5.0

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

## 0.4.0

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

## 0.3.2

### Patch Changes

- 9d4c55d: Describe what shipped. The CLI README said it "intentionally supports only
  `validate`" while the package had gained `change-graph` and
  `release-manifest`; all three are now documented. The extension README
  gains the Change Graph view, the command that walks a change back to what
  it follows, and the recorded spend and ceilings that were only described
  in LIMITS.md.

## 0.3.1

### Patch Changes

- e6cf843: Point at the project site. Both manifests gain a `homepage`, so the
  Marketplace and npm listings link to https://openspec-ui.dev, and the
  READMEs a reader lands on say where it is.

## 0.3.0

### Minor Changes

- e78face: Read the relation between changes from core, and add a blocking one. The
  reader for `follows`/`supersedes` moves out of repository scripts and into
  `packages/core`, so the editor can use it in any workspace; `blocked_by`
  joins them, stating what must land before a change can start. The check
  that verifies them is a test rather than a lint script, so it runs with
  nothing built, and `openspec-ui-cli change-graph` renders the result.

## 0.2.0

### Minor Changes

- a004d63: Add a `release-manifest` command that builds the `releases.json` the homepage reads.
  
  `OpenSpec-Ui-Homepage` currently reconstructs release information by walking this repository through the GitHub API, using a hard-coded map of `packages/<name>` paths that its own source calls "a bridge, not a destination" and that breaks silently on a monorepo reshuffle. The contract for the replacement already exists over there, in `app/schemas/manifest.py`; what was missing was a producer.
  
  `openspec-ui-cli release-manifest` builds that document from this repository's own records: each product's version from its `package.json`, its notes from the matching section of its `CHANGELOG.md`, and the extension's VSIX from the GitHub Release that already exists. Notes are trusted only when the changelog describes the version actually shipping, a changelog that does not parse yields no notes rather than a guess, and a product whose `package.json` cannot be read fails the build rather than being quietly omitted.
  
  `--fingerprint` prints the `id@version` set so CI can publish only when a version actually changed, and `--from` reads an already-published manifest so both sides of that comparison come from the same code.

## 0.1.2

### Patch Changes

- Add `--help`/`-h` to `openspec-ui-cli`, printing usage (command syntax,
  options, exit codes) and exiting `0`. Usage is now also printed
  alongside argument-parsing and unknown-command errors, so a mistake
  surfaces the available options immediately instead of only an error
  message.

## 0.1.1

### Patch Changes

- Package `@openspec-ui/cli` for npm distribution: bundle via esbuild
  (core's own source inlined, `cross-spawn`/`simple-git` kept as real
  dependencies), add a `bin` entry (`openspec-ui-cli`), and remove
  `"private": true`. The CLI's scope is unchanged — `validate` only. The
  actual `npm publish` is a separate manual step; this environment has no
  registry credentials.
