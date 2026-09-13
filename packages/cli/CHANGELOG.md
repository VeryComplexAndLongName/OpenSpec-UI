# @openspec-ui/cli

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
