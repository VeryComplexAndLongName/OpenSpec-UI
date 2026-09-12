# @openspec-ui/cli

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
