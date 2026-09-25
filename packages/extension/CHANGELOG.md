# Changelog

## 0.87.1

### Patch Changes

- c7a1e9a: A control that asks for something before it acts now says so with three
  dots, as every menu does: a Pipeline card's "Start..." (it opens the run
  dialog) and "Stop..." (it asks for a reason), the standalone's "Run with
  Agentic Harness...", and the twenty-two editor commands that ask for a
  name, a pick, a filter or a file, such as "Run...", "Create Change..." and
  "Add Relation...". Controls that act or show at once keep their words, and
  accessible names are unchanged.
- Updated dependencies [c7a1e9a]
  - @openspec-ui/webui@1.76.1
  - @openspec-ui/server@1.48.1

## 0.87.0

### Minor Changes

- 4b621c6: The run dialog says where a run begins, and why: "Continues at apply: 1
  task still open.", "Starts at propose: there is no proposal and task list
  yet.", or "Continues at verify: every task is done." The chain resumes
  with the same function, so the dialog cannot name one stage and the run
  begin at another. Under the `assisted` autonomy level the dialog no longer
  offers "Run the chain", which the runner refused the moment it started;
  it says instead that a chain is not offered and that Semi-autonomous
  offers one.

### Patch Changes

- e6acba0: What a configuration cannot do is said once. The same finding on several
  stages, such as an agent that reports no usage on all four, was four lines
  differing in one word, in Harness settings and again in the run dialog; it
  is now one sentence naming every stage: "no spending ceiling can act on
  "propose", "review", "apply" and "verify"".
- Updated dependencies [e6acba0]
- Updated dependencies [4b621c6]
  - @openspec-ui/core@0.128.0
  - @openspec-ui/webui@1.76.0
  - @openspec-ui/server@1.48.0

## 0.86.0

### Minor Changes

- 5f8dbe9: A change made before its proposal is on the Pipeline, in a new first
  column, Drafted. A change directory holding only `.openspec.yaml`, or
  nothing yet, was taken for what an archive leaves behind and left off the
  board, so propose, the one thing it wants, could not be started from it.
  It is now a card, and Start on it begins at propose. A directory is still
  a leftover where a change of its name was archived. The Changes tree is
  unchanged. ADR 0037 is amended with the new stage.

### Patch Changes

- Updated dependencies [5f8dbe9]
  - @openspec-ui/core@0.127.0
  - @openspec-ui/webui@1.75.0
  - @openspec-ui/server@1.47.0

## 0.85.0

### Minor Changes

- 13f25e8: The Pipeline's cards can be sorted. A Sort control beside the arrangement
  stacks each column's cards by Name, by Progress (the change furthest along
  first), or by Recently changed (the change worked on last first, counting
  a task list's last change as well as a run's end, so work done by hand
  counts too). The choice is kept with the zoom and the arrangement.
  
  Names are now compared as a person reads them: digits as numbers, case
  aside. A numbered change stands in its place, "change-2" before
  "change-10", where before the column put "change-10" first.

### Patch Changes

- Updated dependencies [13f25e8]
  - @openspec-ui/core@0.126.0
  - @openspec-ui/webui@1.74.0
  - @openspec-ui/server@1.46.0

## 0.84.2

### Patch Changes

- 4483ff2: The Pipeline picture's first column is headed "Step 1 - waits for nothing"
  instead of "can start now". The old words read, over a change with every
  task done, as advice to start it again; the column only ever meant that
  nothing active blocks its changes. The other columns read "Step N - after
  step N-1", with a plain hyphen where a middle dot was.
- Updated dependencies [4483ff2]
  - @openspec-ui/core@0.125.1
  - @openspec-ui/webui@1.73.2
  - @openspec-ui/server@1.45.2

## 0.84.1

### Patch Changes

- c28ca71: Logs on a Pipeline card now opens where it can be seen. It opened beneath
  the board and brought only its nearest edge into view, so on a board taller
  than the window it showed 82 pixels of itself at the bottom edge, saying
  "Reading the logs...", and the press seemed to do nothing. The logs now
  open over the board, along the right side of the window, whatever its
  height and scroll. The panel takes the focus, Escape closes it as Close
  does, and the focus goes back to the Logs button that opened it. The
  standalone and the editor's Pipeline panel both get this.
- Updated dependencies [c28ca71]
  - @openspec-ui/webui@1.73.1
  - @openspec-ui/server@1.45.1

## 0.84.0

### Minor Changes

- 93b2b48: The board's Archived column now holds what was archived. It could not
  before, and not by accident: archiving moves a change out of
  `openspec/changes`, which is where the board draws from, so the last
  column was empty by construction and nothing could ever appear in it.
  
  It draws the changes archived most recently, each saying the day it was
  archived and offering no action, and counts the rest in one line beneath
  the board. What is drawn is bounded twice, by a window of days and by a
  count: a week of this repository is 75 archived changes, which is a wall
  rather than a column, and a count alone would show a quiet repository
  changes archived months ago.
  
  The archive is read from the default branch on the server, so every
  machine that has fetched sees the same one - a working directory's own
  copy is as stale as that directory. Where that branch cannot be read, this
  directory's archive is read instead and the line beneath the board says
  so.
  
  The day comes from the archived directory's own name. No commit, no blame,
  no forge: one listing of one tree answers the whole question.

### Patch Changes

- Updated dependencies [93b2b48]
  - @openspec-ui/core@0.125.0
  - @openspec-ui/webui@1.73.0
  - @openspec-ui/server@1.45.0

## 0.83.0

### Minor Changes

- 9da6d90: The Pipeline's board now shows every active change of the repository,
  wherever it is worked: this working directory's and every other one's, one
  card per change. A change worked in two places stands on the board once.
  
  A card of another working directory says which directory works it and
  where it stands, and offers no action on it - read here and never acted on
  from here, as it has always been - and it is no longer drawn a second time
  under "Other working directories". That section keeps its directories,
  their branches and their runs.
  
  A board is of the work, not of one folder: one person with several
  worktrees has one flow of work, and a board showing a third of it is worse
  than no board. Its heading is now "Changes". The arrangement by declared
  order keeps to this checkout, because an order is what this repository
  declares here.
  
  The stages are read for every working directory and merged by name, since
  a change that lives only in another worktree has no stage in this one -
  and a change with no stage read would pile into Proposed and say something
  untrue.

### Patch Changes

- Updated dependencies [9da6d90]
  - @openspec-ui/core@0.124.0
  - @openspec-ui/webui@1.72.0
  - @openspec-ui/server@1.44.0

## 0.82.3

### Patch Changes

- 282123e: The Pipeline's board now looks like a board. A rule stands between each
  column and the next, and every heading carries the stage's word, a picture
  that stands for it, how many changes are in that column, and a colour of
  that stage's own.
  
  The colour never carries a distinction by itself: the word is always
  there, and the picture agrees with it. Its value comes from a palette
  token defined for the light theme, the dark theme and the editor alike -
  and in the editor from the editor's own chart colours, so a theme that
  repaints its charts repaints these with them.
  
  The count is shown as a figure and said in full for a reader who hears the
  heading rather than seeing it.
  
  The arrangement by declared order is untouched: its columns are a
  sequence, not six named places, and a rule there would assert a boundary
  nothing has.
- Updated dependencies [282123e]
  - @openspec-ui/core@0.123.3
  - @openspec-ui/webui@1.71.5
  - @openspec-ui/server@1.43.3

## 0.82.2

### Patch Changes

- f02bd7a: The sweep finishes the archive pull request it opened. It used to follow
  one only while there was still something to archive, and the check that
  keeps an ordinary pass offline stood above the loop that does the
  following - so once a pull request's changes had been archived by another,
  no later pass ever looked at it again. One sat open for an hour with every
  check green.
  
  A pass with nothing to archive now still follows an archive pull request
  of its own. Whether one may be open is read offline, from the refs a
  pruning fetch left behind: where no `archive-landed-*` branch is on the
  server, the forge is asked nothing, exactly as before.
  
  One archive pass at a time also runs over a workspace on a machine, held
  by the advisory claim this product already uses for resources a machine
  has one of. Two hosts sweeping the same workspace had opened two archive
  pull requests for the same changes 43 seconds apart, each having read the
  forge before the other pushed. A pass that cannot take the claim leaves
  the archive alone and says who is archiving.
- Updated dependencies [f02bd7a]
  - @openspec-ui/core@0.123.2
  - @openspec-ui/server@1.43.2
  - @openspec-ui/webui@1.71.4

## 0.82.1

### Patch Changes

- 7ee03b0: The Pipeline's board is drawn whenever it is chosen, even with nothing on
  it: six columns, headed and empty, and a line saying why they are empty.
  Before this, a Pipeline with no change to draw answered with a note
  instead of a picture, so pressing "By stage" changed nothing on screen -
  which looks exactly like a control that does not work.
  
  The board also no longer folds away what landed. The other arrangement
  hides landed changes, which is right where landing is not a place; on a
  board Landed is a column, so folding it empties that column by
  construction, and on a checkout whose changes had all landed it emptied
  the whole board.
  
  Where a card says the same change is also worked elsewhere, the main
  checkout is now called "the main working directory" rather than by its
  label. That label is the name of whichever folder the repository was
  cloned into, which says nothing about the place - and on this repository
  read as the product's own name.
- Updated dependencies [7ee03b0]
  - @openspec-ui/core@0.123.1
  - @openspec-ui/webui@1.71.3
  - @openspec-ui/server@1.43.1

## 0.82.0

### Minor Changes

- 90902e9: A new ceiling, `budget.maxContextShare`: how much of its context window a
  run may fill, as a share between 0 and 1. It reads ACP's `usage_update`,
  which arrives during a stage, so unlike every spending ceiling it stops a
  stage that is already running - ending the run as cancelled, with the
  ceiling, its value and the reading all named. A value outside that range
  is refused where the configuration resolves.
  
  The figure is still not counted as a spend: it falls after a compaction,
  so counting it as consumption would under-count exactly the long runs
  that compact. What it says is that the conversation has outgrown the
  task, and every further turn carries the whole of it again.
  
  This matters most where nothing else can act. `deepseek-cli-acp` reports
  no cost, no credits and no token split, so before this only `timeout`
  bounded it at all. Agent capabilities now record `contextGauge` beside
  `reports` - a different question, answered from evidence - and the
  settings surfaces say before a run when this ceiling cannot act, and stop
  calling a stage unbounded when it can.

### Patch Changes

- Updated dependencies [90902e9]
- Updated dependencies [c6c53a3]
  - @openspec-ui/core@0.123.0
  - @openspec-ui/server@1.43.0
  - @openspec-ui/webui@1.71.2

## 0.81.1

### Patch Changes

- Updated dependencies [a8a08fc]
  - @openspec-ui/core@0.122.0
  - @openspec-ui/server@1.42.1
  - @openspec-ui/webui@1.71.1

## 0.81.0

### Minor Changes

- a051a88: The Pipeline becomes a board of the stages
  
  Press **By stage** in the Pipeline, in the editor or in the standalone
  app, and the same cards are arranged as a board: a column for each stage
  from Proposed to Archived. Press **By step** to go back to the
  arrangement by what each change waits for. Whichever you leave it in is
  the one you come back to.
  
  Every card now says where its change is, how long it has been there, and
  who owns and implements it. Nothing on the board is dragged: a change
  moves when the work moves it, and goes back only when somebody sends it
  back with a reason.

### Patch Changes

- Updated dependencies [a051a88]
  - @openspec-ui/core@0.121.0
  - @openspec-ui/server@1.42.0
  - @openspec-ui/webui@1.71.0

## 0.80.3

### Patch Changes

- Updated dependencies [39a5eee]
  - @openspec-ui/core@0.120.0
  - @openspec-ui/server@1.41.5
  - @openspec-ui/webui@1.70.12

## 0.80.2

### Patch Changes

- 451f56c: An archive pull request is brought up to date when the forge asks for it
  
  Some repositories only merge pull requests that are up to date with the
  default branch, such as GitHub's "require branches to be up to date",
  GitLab's fast-forward merge, and Gitea's outdated-branch block. There, an
  archive pull request the sweep opened could never merge once something
  else landed first. Now, when the forge refuses it and the default branch
  has moved on, the sweep rebuilds the archive on the current default
  branch, updates its own branch, and merges it once the checks pass again.
- Updated dependencies [8c2dadf]
- Updated dependencies [451f56c]
  - @openspec-ui/core@0.119.1
  - @openspec-ui/server@1.41.4
  - @openspec-ui/webui@1.70.11

## 0.80.1

### Patch Changes

- Updated dependencies [99923cf]
  - @openspec-ui/core@0.119.0
  - @openspec-ui/server@1.41.3
  - @openspec-ui/webui@1.70.10

## 0.80.0

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

### Patch Changes

- Updated dependencies [ffd38c0]
  - @openspec-ui/core@0.118.0
  - @openspec-ui/server@1.41.2
  - @openspec-ui/webui@1.70.9

## 0.79.1

### Patch Changes

- 919bc1e: A finished working directory is removed even when it holds long paths or a downloaded VS Code
  
  The editor's sweep no longer leaves a finished working directory on disk
  when it holds a downloaded VS Code, as the extension's integration tests
  leave in `.vscode-test`. Git now removes paths longer than 260 characters
  on Windows. Inside the editor, the rest of the removal no longer opens the
  downloaded editor's `node_modules.asar` as an archive, which had failed
  and kept the file locked until the editor closed. When a removal still
  fails, the message now names what stopped it, not only git's complaint.
- Updated dependencies [919bc1e]
  - @openspec-ui/core@0.117.1
  - @openspec-ui/server@1.41.1
  - @openspec-ui/webui@1.70.8

## 0.79.0

### Minor Changes

- cd8327a: The product merges its own archive pull requests
  
  A change that has landed is still archived for you in a pull request, but
  the product no longer asks GitHub, GitLab or Gitea for an automatic merge.
  It follows the pull request itself, every five minutes while it is open,
  and merges it once its checks pass, or where the repository has none. It
  works the same on every forge, whatever the repository's merge settings.
  Where a check fails or the forge refuses the merge, for example because an
  approval is required, the pull request stays open and you are told why.

### Patch Changes

- Updated dependencies [cd8327a]
  - @openspec-ui/core@0.117.0
  - @openspec-ui/server@1.41.0
  - @openspec-ui/webui@1.70.7

## 0.78.1

### Patch Changes

- 4ff47f4: The Marketplace listing's `categories` and `keywords` now describe what the
  extension actually is (`Machine Learning`/`Other`, and terms including
  `ai-agents`/`coding-agent`), instead of the generic `Other` category and
  three narrow keywords it shipped with. No behavior change.

## 0.78.0

### Minor Changes

- 7832036: GitHub without `gh`, and the git stage on GitLab and Gitea
  
  With `GITHUB_TOKEN` or `GH_TOKEN` in the environment, GitHub is asked over
  its API and `gh` is not needed. Without a token, `gh` is used as before.
  When neither is there, the product now says so plainly.
  
  The Agentic Harness's `git` stage now works on whichever forge `origin` is
  on: it opens the pull request, waits for its checks and merges on GitHub,
  GitLab or Gitea alike. It still merges only when a check has actually
  passed.

### Patch Changes

- Updated dependencies [7832036]
  - @openspec-ui/core@0.116.0
  - @openspec-ui/server@1.40.0
  - @openspec-ui/webui@1.70.6

## 0.77.0

### Minor Changes

- 4417a8a: GitLab and Gitea, as well as GitHub
  
  A repository on GitLab or Gitea now works where only GitHub did. The
  product reads which changes' pull requests are open or merged from
  whichever forge `origin` is on, and opens and merges archive pull requests
  there. github.com goes through `gh` as before. gitlab.com and self-hosted
  GitLab or Gitea go through their REST APIs, with `GITLAB_TOKEN` or
  `GITEA_TOKEN` from the environment. For an ssh remote, `GITEA_URL` or
  `GITLAB_URL` names the forge. The `git` stage's own pull request still goes
  through `gh`.

### Patch Changes

- Updated dependencies [4417a8a]
  - @openspec-ui/core@0.115.0
  - @openspec-ui/server@1.39.0
  - @openspec-ui/webui@1.70.5

## 0.76.0

### Minor Changes

- 3605fd7: DeepSeek is an agent
  
  `deepseek-cli-acp` runs DeepSeek through its CLI's ACP profile,
  `dsh --profile acp`, and can be picked for any stage or task like the
  other agents. Its prompts start with a short instruction to follow the
  steps literally and in order. It uses DeepSeek-V4-Flash, `dsh`'s default,
  and reports no usage.
  
  `dsh` needs a Node newer than 22.11 on the PATH it is started with. On
  22.11 it exits without a word, and the run now says which Node it found.

### Patch Changes

- Updated dependencies [3605fd7]
  - @openspec-ui/core@0.114.0
  - @openspec-ui/server@1.38.0
  - @openspec-ui/webui@1.70.4

## 0.75.1

### Patch Changes

- c520d4e: A change you have not written yet takes a relation
  
  A directory in `openspec/changes/` that holds only its `.openspec.yaml`,
  as `/opsx:new` leaves it, is listed with a (?) because it is not a change
  yet. Right-clicking it used to open nothing. It now offers Add Relation and
  Remove Relation, and its tooltip says the rest of a change's menu arrives
  with its first proposal, design, tasks or specs. An archived change's
  leavings still offer only removal, now from the right-click menu as well.
  
  Remove Relation is offered only on a change that states a relation, rather
  than opening to say there is nothing to remove.
  
  HARNESS.md now lists a stage's model among the settings the harness views
  edit, and the per-change review gate pick describes `agent-sufficient` as
  the `git` stage behaves today.

## 0.75.0

### Minor Changes

- 5751201: Your main checkout follows what landed
  
  The workspace sweep now fast-forwards the main checkout's `main` to
  `origin/main`, so a change that landed, or an archive, shows up or leaves
  without anybody pulling. It does this only when the tree is clean, `main`
  has no commits of its own, and no run is working in it; otherwise it says
  how far behind `main` is and why. It pushes nothing, and
  `"branches": { "followMain": false }` turns it off.
  
  The editor sweeps again 15 minutes after opening an archive pull request,
  so the archive arrives soon after it merges. The Pipeline's drift line now
  names the changes on `origin/main` that this checkout does not show. An
  archive pull request's title names the changes it archives.

### Patch Changes

- Updated dependencies [5751201]
  - @openspec-ui/core@0.113.0
  - @openspec-ui/server@1.37.0
  - @openspec-ui/webui@1.70.3

## 0.74.2

### Patch Changes

- Updated dependencies [5eb31fa]
  - @openspec-ui/webui@1.70.2
  - @openspec-ui/server@1.36.2

## 0.74.1

### Patch Changes

- c3f4a84: The sweep no longer leaves half-removed working directories
  
  When git could not delete part of a finished working directory, for
  example a path too long for it on Windows, the sweep said so and left the
  rest behind, where nothing looked at it again. It now removes what git
  left and has git forget the worktree. The pass that archives landed
  changes also refuses to push a branch that archives nothing.
- Updated dependencies [c3f4a84]
  - @openspec-ui/core@0.112.1
  - @openspec-ui/server@1.36.1
  - @openspec-ui/webui@1.70.1

## 0.74.0

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

### Patch Changes

- Updated dependencies [fddf66f]
  - @openspec-ui/core@0.112.0
  - @openspec-ui/webui@1.70.0
  - @openspec-ui/server@1.36.0

## 0.73.1

### Patch Changes

- a0102c6: The editor no longer marks a correct harness file as wrong
  
  VS Code checks `openspec/agent-harness.json` and each change's
  `harness.json` against schemas the extension ships. Those schemas knew 4
  of the 14 settings and marked the rest as errors: `budget`, `timeout`,
  `branches`, `archive`, a stage's agent written with a model or an effort,
  and the ACP agents among them. They are now built from the same rules the
  product enforces, so the editor marks what the product would refuse and
  nothing else, and most settings say what they do when hovered.
- Updated dependencies [a0102c6]
  - @openspec-ui/core@0.111.1
  - @openspec-ui/server@1.35.5
  - @openspec-ui/webui@1.69.5

## 0.73.0

### Minor Changes

- 628069d: A change that has landed is archived for you
  
  Once a change's pull request has merged and every item in its task list
  is closed, the workspace sweep archives it. It makes one pull request per
  pass for every such change, on an `archive-landed-` branch, and asks it to
  merge when its checks pass. The Pipeline and Changes then show only what
  is still in flight. A change that landed while still owing something is
  never archived; the editor warns about it, and the standalone lists it
  under "Done for you".
  
  On by default; `"archive": { "whenLanded": false }` in
  `openspec/agent-harness.json`, or in one change's `harness.json`, turns it
  off. It needs the openspec CLI and a signed-in `gh`. See ADR 0035 and
  `HARNESS.md`.

### Patch Changes

- Updated dependencies [628069d]
  - @openspec-ui/core@0.111.0
  - @openspec-ui/server@1.35.4
  - @openspec-ui/webui@1.69.4

## 0.72.3

### Patch Changes

- ef790ed: Everything now says OpenSpec Workbench
  
  The Command Palette, notifications, panel titles, the standalone's
  headline, the server's startup line and the settings schemas said
  "OpenSpec UI", the product's old name. They now say "OpenSpec Workbench".
  Command ids, settings, keybindings and stored state keep their names, so
  nothing needs to be set up again.
- Updated dependencies [ef790ed]
  - @openspec-ui/core@0.110.3
  - @openspec-ui/webui@1.69.3
  - @openspec-ui/server@1.35.3

## 0.72.2

### Patch Changes

- c51a17a: The Sprint Report opens again, and four times faster
  
  In the standalone, the report's tab now opens at the click and says how
  many changes it is reading, then becomes the report. It used to open only
  once the report was ready, and a browser refuses a tab that late: after a
  long wait at full load, nothing appeared.
  
  The report now reads its changes the way the Timeline tab does, in
  batches with the archive's dates read once. Every change's authorship and
  every proposal's first commit now come from one git call each, where they
  were asked once per change. Over this repository's 296 archived changes the
  report takes 26 s instead of 109 s; a week's 66 changes take 7 s. The
  Timeline tab's comparison reads the same dates the same way and gains too.
  The editor's command shows a progress notification while it reads.
- Updated dependencies [c51a17a]
  - @openspec-ui/core@0.110.2
  - @openspec-ui/webui@1.69.2
  - @openspec-ui/server@1.35.2

## 0.72.1

### Patch Changes

- 9815e34: The Change Graph no longer holds a processor at 100%
  
  The view read the whole graph - archive included - once for every open
  row, and again on every file event under `openspec/`, so a run ticking
  tasks re-read the archive many times a second. It now reads once per
  drawing, shared by every row, and refreshes only when something it reads
  changes: a change's `.openspec.yaml`, or a change directory appearing or
  going. A ticked task no longer touches it.
  
  A reading of this repository's 293 archived changes takes 159 ms; it was
  never the archive's size.
- Updated dependencies [9815e34]
  - @openspec-ui/core@0.110.1
  - @openspec-ui/server@1.35.1
  - @openspec-ui/webui@1.69.1

## 0.72.0

### Minor Changes

- 607a181: A change's branch that falls behind is rebased for you
  
  The working-directory sweep now rebases a change's branch that has fallen
  behind the default branch and pushes it with `--force-with-lease`, so its
  pull request's checks run again against the current default branch. Two
  pull requests that were green apart meet on the same `main` before either
  lands.
  
  It happens only where nothing can be lost: the branch is named after a
  change, was pushed and is still on the server, equals its upstream, has a
  clean tree and no run working in it. A conflict is never resolved - the
  rebase is aborted, the branch is left as it was, and the files are named;
  the editor raises a warning. A push the lease refuses puts the branch back.
  
  It is on by default. `branches.rebaseWhenBehind: false` in
  `openspec/agent-harness.json`, or in one change's `harness.json`, turns it
  off - for a team that shares change branches, say. See ADR 0034 and
  `HARNESS.md`.
  
  The standalone now runs the same sweep as the editor, removal of finished
  working directories included, and says what it did under "Done for you".

### Patch Changes

- Updated dependencies [607a181]
  - @openspec-ui/core@0.110.0
  - @openspec-ui/server@1.35.0
  - @openspec-ui/webui@1.69.0

## 0.71.2

### Patch Changes

- Updated dependencies [fee5511]
  - @openspec-ui/core@0.109.0
  - @openspec-ui/server@1.34.3
  - @openspec-ui/webui@1.68.3

## 0.71.1

### Patch Changes

- Updated dependencies [99015a0]
  - @openspec-ui/core@0.108.0
  - @openspec-ui/server@1.34.2
  - @openspec-ui/webui@1.68.2

## 0.71.0

### Minor Changes

- c4550cc: git decides a working directory is done, and the sweep removes it
  
  A working directory whose branch was pushed and whose upstream git now
  reports gone is done with: that is what a merged pull request leaves
  behind where the server deletes its branches on merge. The reading needs
  no token, no pull request and no change to hang the answer on, and it
  works offline. A pruning fetch comes first, since `gone` appears only
  after one, and a fetch that fails removes nothing.
  
  The sweep now removes such a directory rather than offering a press. Six
  accumulated on one machine in a day, because a press nobody remembers is
  a press nobody makes. Every rail is unchanged - a clean tree, no run
  recorded, a branch that was actually pushed - and the local branch is
  left alone, so nothing is lost. Nothing under `openspec/changes/` is
  read, moved or written: a change is repository content.

### Patch Changes

- Updated dependencies [c4550cc]
  - @openspec-ui/core@0.107.0
  - @openspec-ui/server@1.34.1
  - @openspec-ui/webui@1.68.1

## 0.70.0

### Minor Changes

- 8a8cd01: The sprint report is a page of the product
  
  The sprint report is the one thing this product makes that leaves it, and
  it was the only surface not drawn in the product's own look: a PDF library
  drew it in Helvetica on white. It is now an HTML page styled by the same
  stylesheets every other surface uses, and the PDF comes from the browser's
  own print, which paginates better than a hand-written layout and lets the
  reader choose the paper.
  
  The standalone opens the report in a tab and prints it, instead of
  downloading a file; `POST /api/sprint-report` returns `text/html`. The VS
  Code command writes `sprint-report-<from>-<to>.html` and offers to open it
  in a browser. What the report says is unchanged.
  
  `pdfkit` and `@types/pdfkit` leave `@openspec-ui/core`, and with them the
  esbuild alias the extension's bundle needed to load that library at all.

### Patch Changes

- Updated dependencies [8a8cd01]
  - @openspec-ui/core@0.106.0
  - @openspec-ui/webui@1.68.0
  - @openspec-ui/server@1.34.0

## 0.69.0

### Minor Changes

- a65ce77: The Changes view says whose each change is
  
  A working directory is cut from the default branch, so it holds every
  change that was active there rather than one. Each row now says where its
  change is worked: this directory's own change comes first and is named
  beside the view's title, a change worked in another working directory is
  locked and greyed with the directory and the person in its description,
  and a change nobody has taken up is left as it was.
  
  The menu items that would write are not offered on another directory's
  row, and each of those commands refuses when it is reached another way,
  naming the directory to work in instead. Reading one is offered instead:
  that directory's own copy of a change opens read-only, edits and all, and
  a picker lists every active change with where it is worked.

### Patch Changes

- Updated dependencies [a65ce77]
  - @openspec-ui/core@0.105.0
  - @openspec-ui/webui@1.67.0
  - @openspec-ui/server@1.33.3

## 0.68.2

### Patch Changes

- Updated dependencies [209578a]
  - @openspec-ui/core@0.104.0
  - @openspec-ui/server@1.33.2
  - @openspec-ui/webui@1.66.1

## 0.68.1

### Patch Changes

- Updated dependencies [478ae8f]
  - @openspec-ui/core@0.103.0
  - @openspec-ui/webui@1.66.0
  - @openspec-ui/server@1.33.1

## 0.68.0

### Minor Changes

- 08d2cf8: The Pipeline says how far this checkout is behind what has landed - "main is
  5 commits behind origin/main; 2 of these changes are archived on main" - and
  offers to catch up. Catching up is a fast-forward and nothing else: it
  refuses a tree that is not clean, a branch with commits the remote does not
  have, and a checkout that is not on its default branch, each by name. A card
  of a change in another working directory now says when that change is
  archived on main.

### Patch Changes

- Updated dependencies [08d2cf8]
  - @openspec-ui/core@0.102.0
  - @openspec-ui/webui@1.65.0
  - @openspec-ui/server@1.33.0

## 0.67.1

### Patch Changes

- Updated dependencies [a0520c9]
  - @openspec-ui/core@0.101.1
  - @openspec-ui/server@1.32.2
  - @openspec-ui/webui@1.64.2

## 0.67.0

### Minor Changes

- dac06ce: The operator can say something to a run, and hear back. The signed channel
  that carries a stop now also carries a note, a question and an answer: a run
  takes what a person wrote at its next status renewal, hands it to its agent
  in the prompt of the next stage it starts, and answers a question with what
  that stage said. A run does not take another run's messages unless
  `allowAgentMessages` says it may. In the editor, a change with a live run
  gains "Say Something to This Run", and an answer addressed to you is shown
  when it arrives.

### Patch Changes

- Updated dependencies [dac06ce]
  - @openspec-ui/core@0.101.0
  - @openspec-ui/server@1.32.1
  - @openspec-ui/webui@1.64.1

## 0.66.1

### Patch Changes

- 3af743e: A change's standing colours its icon in the Changes tree, not its label. The
  word stays in the description, the badge letter and the tooltip stay in the
  file decoration, and the row's text is drawn in the theme's own foreground.

## 0.66.0

### Minor Changes

- 84bbb26: Review in Processes answers where it was pressed: a run's details, its
  changed files and its rollback control open under that run's own row
  instead of in a panel at the foot of the tab, which with a hundred rows
  put the answer five screens below the button. A second press folds it,
  opening another run closes the first, and the list can be narrowed by a
  word.

### Patch Changes

- Updated dependencies [84bbb26]
  - @openspec-ui/webui@1.64.0
  - @openspec-ui/server@1.32.0

## 0.65.0

### Minor Changes

- 1f9797a: What is finished is tidied away
  
  Asked for by the owner, after three directories under `.worktrees`
  refused to go and the Pipeline showed a wall of finished cards.
  
  The sweep now covers what it missed. An empty directory counts as holding
  only what this product wrote, so a leftover with nothing in it is cleared
  where its change is archived - and still kept where nothing of its name
  is, because that is somebody's start. The root the working directories
  live under is swept too: a directory git no longer lists and that holds no
  file at any depth is this product's own shell, left by removing a working
  directory, and goes with the rest.
  
  A removal that cannot happen now says who is holding the directory, read
  from the processes whose command line mentions it. That is how three
  servers, started by live checks days earlier, were found.
  
  "Finished with" reads what settles it: the change's pull request merged,
  or the default branch carrying the change archived, beside the branch
  being gone. A repository that squashes never makes a branch's tip an
  ancestor of its default branch, so the merge base alone answered "not
  finished" for work that plainly was.
  
  The Pipeline folds the changes whose work has landed into one row with
  their count, which opens them and offers to archive them all, and takes a
  filter over a change's name and the word beside it.

### Patch Changes

- Updated dependencies [1f9797a]
  - @openspec-ui/core@0.100.0
  - @openspec-ui/server@1.31.0
  - @openspec-ui/webui@1.63.0

## 0.64.0

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

### Patch Changes

- Updated dependencies [48bf1a1]
  - @openspec-ui/core@0.99.0
  - @openspec-ui/server@1.30.1
  - @openspec-ui/webui@1.62.1

## 0.63.0

### Minor Changes

- ceaddae: The workspace clears what it left behind
  
  Asked for by the owner after the product listed two archived changes as
  "No tasks": allow for a directory left behind, remove it at startup, and
  sweep for it on an interval - and look at the working directories, where a
  lot gets stuck.
  
  A directory under `openspec/changes/` carrying none of `proposal.md`,
  `design.md`, `tasks.md` or `specs/` is not a change, and no longer appears
  as one in either host. The product clears the ones it left itself: a
  directory whose change is already archived and whose every file is one
  this product writes. Everything else is shown rather than removed - a
  directory holding `.openspec.yaml` alone is somebody starting a change by
  hand, and one whose name is nowhere in the archive may be a change nobody
  has written yet. The sweep runs where a workspace is read, on activation
  and on one interval both hosts take from core.
  
  Working directories are read the same way: the survey now says of each
  whether it is finished with - its branch merged into the default branch or
  gone from everywhere, its tree clean, no run recorded against it. Nothing
  is removed without a press, and the press deletes every junction as a
  junction before the directory, since a recursive delete through a
  worktree's `node_modules` takes the primary tree's packages with it.
  
  The Summary gains a "Left behind" panel: what was cleared, what will not be
  cleared with what it holds, and the working directories with nothing left
  to do. The editor's Changes view says the same above its changes, and
  offers the removal on the row.

### Patch Changes

- Updated dependencies [ceaddae]
  - @openspec-ui/core@0.98.0
  - @openspec-ui/server@1.30.0
  - @openspec-ui/webui@1.62.0

## 0.62.0

### Minor Changes

- b361b2d: A relation is added and removed from the row that shows it
  
  Asked for by DW: manage a dependency with a mouse, rather than by editing
  `.openspec.yaml` by hand.
  
  A change's row in the Changes view and in the Change Graph now offers Add
  Relation and Remove Relation. Adding asks which relation - Follows,
  Supersedes or Blocked by, each with the sentence that says what it means -
  and then which change, from every change the workspace has, active first,
  with the ones that relation already names marked. Removing offers only the
  relations the change actually states.
  
  Core owns the file. A new `change-relations-file.ts` rewrites one relation
  key in a change's metadata and passes every other line through as it found
  it: other keys, comments, key order, the file's own line endings and its
  trailing newline. A flow sequence stays a flow sequence, and a key left
  with no value is removed rather than left in a shape the parser reports as
  an error.
  
  The checks that were the lint gate's happen at the edit. An edit naming a
  change the workspace does not have, a change naming itself, or one that
  would close a cycle is refused with the reason before anything is written,
  and the cycle is found by the same `findChangeGraphCycles` the gate uses,
  run over the graph as it would be after the edit. The refusal is a value a
  host shows, not an exception it has to parse. An archived change's
  relations are drawn and never edited.

### Patch Changes

- Updated dependencies [b361b2d]
  - @openspec-ui/core@0.97.0
  - @openspec-ui/server@1.29.3
  - @openspec-ui/webui@1.61.2

## 0.61.0

### Minor Changes

- b8fdb6f: The Archive, Specs and Change Graph views can be narrowed, and the graph
  folds what has landed
  
  Asked for by DW: a search box beside Archive, Specs and the Change Graph,
  and a way to hide the parts of the graph where every change has landed.
  269 archived changes and two finished clusters were in the way of the part
  being decided.
  
  Each of the three views takes a filter from its title bar: an input box
  seeded with what the view is already narrowed by, every typed word having
  to appear somewhere in the row. A narrowed view says what it is narrowed
  by and how much of itself it is showing, and a view filtered to nothing
  says so with the words it was given rather than looking like a workspace
  with nothing in it.
  
  The Change Graph folds every branch whose root and every change under it
  are archived, and ends its roots with a row reading "N landed relations
  hidden" that shows them when pressed; the title bar offers Show and Hide
  in turn. Two branches stay drawn whatever the fold says: one a live change
  follows, since the parent is the reason that change exists, and one a live
  change is waiting on, since a row reading "waiting on base" needs a base
  to point at. A filter that finds something inside a folded branch unfolds
  it for the reading.
  
  The predicate itself is core's `matchesFilter`, which the standalone lists
  now call instead of their own copy, so a word that finds a change in one
  host finds it in the other. `landedBranches` reads the `follows` relation
  and says which branches have finished.

### Patch Changes

- Updated dependencies [b8fdb6f]
  - @openspec-ui/core@0.96.0
  - @openspec-ui/webui@1.61.1
  - @openspec-ui/server@1.29.2

## 0.60.7

### Patch Changes

- 26a3e14: A blocked change says so in the Changes views
  
  Reported by DW: the Changes view marked a change ready while the Change
  Graph showed it blocked by another that was still active. The graph, the
  readiness reading and the command line all read `blocked_by`; the two
  Changes views asked core for a change's word without that fact, and core
  only ever considers Blocked when it is given, so every unfinished change
  fell through to Ready.
  
  Both views now read readiness and pass it, and the word names what blocks
  the change: "Blocked by apply-plan-stays-pending", with "and N more" past
  the first. A change whose tasks are all ticked and whose blocker is still
  active says Done with Blocked beneath it, rather than one fact hiding the
  other. A test reads one workspace as a listing and as the graph and fails
  where they disagree.
- Updated dependencies [26a3e14]
  - @openspec-ui/core@0.95.0
  - @openspec-ui/webui@1.61.0
  - @openspec-ui/server@1.29.1

## 0.60.6

### Patch Changes

- b6573f9: The last five tabs are drawn from the shared components
  
  Run a Command, Processes, Diff Preview, Change Editor and Templates were
  left on the pre-redesign markup when ADR 0033 redrew the screens a mockup
  covered. Each now has panels that name what they hold, one toolbar of the
  shape every other tab uses, tables in the shared class, badges for a run's
  state and a template's origin, and its own words when there is nothing to
  show. The Change Editor's hand-rolled document strip is the shared
  segmented control, Diff Preview lists the files it changed, and Templates
  says what it offers before anything is loaded.
  
  Nothing a person or a test reaches for moved: every test handle, label and
  role is what it was. The editor's own colours follow the renamed classes,
  which the mapping test gates.
- Updated dependencies [b6573f9]
  - @openspec-ui/webui@1.60.0

## 0.60.5

### Patch Changes

- 86b4c79: Compare changes draws every change of the workspace on a grid of days
  
  The Timeline's comparison no longer asks which changes to compare or over
  which dates. Choosing it reads the whole workspace in one pass and draws a
  bar per change, from the hour it was proposed to the hour it was archived,
  with the period chosen from 2 days, 5 days, 2 weeks or All, weekends
  shaded, a dashed line at now, a filter for finding a change by name, and a
  row that opens that change's own timeline. The charts follow the grid, over
  the changes the grid shows.
  
  Core gains `readChangeSpans`, which dates every change of a workspace in
  one pass — 1.2 s against the 62 s the per-change read cost on this
  repository's 264 changes — and `change-comparison.ts`, which derives the
  grid's days, rows and positions. The server gains `POST /api/change-spans`.
  The editor's "Show Change Comparison Timeline" opens the same screen over
  every change, with no quick pick.
- Updated dependencies [86b4c79]
  - @openspec-ui/core@0.94.0
  - @openspec-ui/webui@1.59.0
  - @openspec-ui/server@1.29.0

## 0.60.4

### Patch Changes

- 5c2dd79: The Pipeline looks like the approved mockup, in the standalone shell and in
  the editor's panel. A card is the site's card: the change's name as its
  heading, its state in a coloured badge that still says the word, a bar with
  "9 / 22 tasks", a waiting run's question in a callout, each fact with a mark
  for its kind, and its controls in a footer, where Start and Continue are the
  filled buttons and Stop is outlined in red. An open card lists its tasks as
  rows with a tag each. Columns are headed "Step 1 · can start now", the view
  has a toolbar with the zoom and Refresh, and the picture, the suggestions and
  the other working directories each sit in a panel; a suggestion's command
  can be copied.
  
  Core derives every card's height from what it holds (`pipelineCardHeight`),
  so nothing is measured and no line is cut at any zoom; `describeChangeCard`
  gives each fact a kind and the run's stage, and `describeLane` heads a column.
- Updated dependencies [5c2dd79]
  - @openspec-ui/core@0.93.0
  - @openspec-ui/webui@1.58.0
  - @openspec-ui/server@1.28.5

## 0.60.3

### Patch Changes

- 87d2236: The editor's Pipeline answers on a repository with hundreds of archived
  changes, and the OpenSpec views no longer fail with "EMFILE: too many open
  files". The Processes view read the whole workspace twice for every change
  its process history named, all at once; it now reads just those changes,
  once. A survey of the working directories read the archive for every task
  list and took 39 seconds on this repository; it now reads each directory's
  active changes once, in under a second. The Changes view reads only active
  changes, the Archive view only archived ones and only when the archive
  changes, and one reading of a workspace takes 16 changes at a time.
- 3e1f91a: The Timeline tab's change is found by typing part of its name. The picker is
  a search field: as you type, it lists the active and archived changes whose
  name holds every word, recent ones first, and a change is chosen with the
  arrow keys and Enter or with a click. An archived change's date matches too,
  and at most 100 matches are drawn, with a count of the rest.
- Updated dependencies [87d2236]
- Updated dependencies [3e1f91a]
  - @openspec-ui/core@0.92.1
  - @openspec-ui/webui@1.57.0
  - @openspec-ui/server@1.28.4

## 0.60.2

### Patch Changes

- 65847f0: The Timeline's one-change screen now looks like the approved mockup, in the
  standalone shell and in the editor's timeline panel. "Tasks over time" places
  the change's proposal, each moment its tasks were ticked, and its archive on
  a rail, with tasks ticked in one commit shown as one moment ("5 tasks ticked
  in one commit") that opens to its tasks. Beside it, a Tasks tile gives done of
  total and how long the change took, and a Dates panel gives each date with
  where it was read from. Open tasks, done tasks with no date, and the
  proposal, design and specs stay available below. Choosing a change loads it,
  with no button to press, and the page head names the change.
  
  A task reads as its whole sentence: core's task checklist items carry
  `continued`, the lines `tasks.md` wraps a task onto.
- Updated dependencies [65847f0]
  - @openspec-ui/webui@1.56.0
  - @openspec-ui/core@0.92.0
  - @openspec-ui/server@1.28.3

## 0.60.1

### Patch Changes

- b8871aa: The editor's Changes tree says Running while a run works on a change. It
  used to say Ready until a task was ticked, the view was refreshed or five
  minutes passed, because a run's status record is written outside the
  workspace. The tree now watches those records while the Changes view is
  visible and reads the runs again from them alone, without git, drawing a row
  again only when its word changes. The standalone Changes list reads which
  runs are live again every thirty seconds while the summary is shown.
- Updated dependencies [b8871aa]
  - @openspec-ui/core@0.91.2
  - @openspec-ui/webui@1.55.1
  - @openspec-ui/server@1.28.2

## 0.60.0

### Minor Changes

- 6cb2d6c: The Pipeline panel keeps answering while an Agentic Harness chain runs in
  this editor, when the optional local server (`openspec-ui.transport.localServer.enabled`)
  is on: the panel embeds the server's own Pipeline tab instead of reading over
  the message bridge, so its cards are drawn from readings the server's own
  process took, not the extension host's. Opening a change from a card still
  opens it in the editor. With the local server off, the panel is unchanged.
  
  A panel that embeds the server's page, the Pipeline or the AI panel, now
  fills its tab and draws in the editor's light or dark theme; before, the page
  sat in a small box in the tab's corner and followed the operating system's
  theme. The Pipeline draws itself again when the editor's theme changes.
  
  A Pipeline card no longer says Ready above its own "running apply" line: its
  word now reads the same runs its lines do.

### Patch Changes

- Updated dependencies [6cb2d6c]
  - @openspec-ui/core@0.91.1
  - @openspec-ui/webui@1.55.0
  - @openspec-ui/server@1.28.1

## 0.59.6

### Patch Changes

- 7bbf30e: Icons draw in the editor's panels. The Harness Settings, Pipeline, Timeline and AI panels refused the icon font their stylesheet carries, because their Content Security Policy allowed no font source, so every icon — the gear beside "Global harness settings" among them — was an empty box. Each panel now allows `data:` fonts, and nothing else.

## 0.59.5

### Patch Changes

- 8c649d5: The standalone shell wears the project site's frame (ADR 0033). A bar across
  the top carries the owl, the name, the workspace and the theme switch; a page
  head names the open tab under a tagline; the nine tabs fit one row with short
  labels — Run, Processes, Diff, Summary, Editor, Templates, Timeline,
  Pipeline, Harness — the current one underlined in red; the page is 1180
  pixels wide, with a footer carrying the versions. The palette is the site's,
  in light and dark, and the summary's tiles take its KPI shape and colours.
  Each tab keeps its full name for assistive technology. In VS Code the
  webviews keep the editor's colours and take no part of the frame.
- Updated dependencies [3e8f341]
- Updated dependencies [8c649d5]
- Updated dependencies [94313ec]
  - @openspec-ui/webui@1.54.0

## 0.59.4

### Patch Changes

- ce7bbd3: The standalone shell says what it is doing — and this release is where that
  arrives. Extension 0.59.0 and 0.59.1, server 1.27.0 and webui 1.51.0 carried
  an entry describing these features before they existed; that entry was
  released early, and this is the release that delivers them.
  
  - **Diff Preview shows a change's own diff.** Choose an active change and the
    tab shows what git reports for its folder against HEAD, staged edits and
    new files included, from a new token-gated `POST /api/change-diff`. A
    change with nothing uncommitted says so; a workspace that is not a git
    repository says that. The tab used to show a hard-coded two-line sample.
  - **A tab that is reading says so.** A moving bar, a spinner and one sentence
    name what is being read, with the seconds elapsed once the wait passes
    three; the tab's controls are held until the reading returns; and the tab's
    label keeps a small spinner, so a tab left while it reads still shows it is
    busy. The animation stands still for a person who prefers reduced motion.
  - **The theme control is a switch.** Its name stays "Dark theme", its state
    is `role="switch"` with `aria-checked`, and its knob slides and carries a
    sun or a moon.
- fe3bdfc: A Pipeline card's name no longer runs over its state. Once the icon font
  drew the icon beside a card's name, the icon took a line of its own and
  pushed the name down over "RUNNING" or "FURTHER ALONG", since a card's height
  does not grow. The icon and the name now share one line, and a long name
  ends in an ellipsis.
- Updated dependencies [ce7bbd3]
- Updated dependencies [fe3bdfc]
  - @openspec-ui/core@0.91.0
  - @openspec-ui/webui@1.53.0
  - @openspec-ui/server@1.28.0

## 0.59.3

### Patch Changes

- a359373: Metro now draws the parts of a panel and a timeline that the screens name. A
  panel's title has its icon slot and its caption padding, so an icon no longer
  touches the border, and a timeline has its time and text columns. The derived
  Metro copy had dropped those rules, so the screens looked as they did before.
- 69e1644: The OpenSpec view summary opens in a few seconds instead of minutes. For
  every archived change it used to read the whole workspace again, all at once:
  on a repository with 250 archived changes that step took 157 seconds, held
  several cores and could run out of file handles. It now summarises every
  archived change from the one reading the request already made, in about
  100 ms there, with the same counts.
- 5a84e07: The icons the redesigned screens promised now show. The icon stylesheet was
  generated but never carried into the page, so every icon rendered as an
  empty, zero-width span — in the standalone shell and in every webview. Each
  screen that draws Metro now carries it, and an icon keeps a small gap from
  the word beside it.
- Updated dependencies [a359373]
- Updated dependencies [69e1644]
- Updated dependencies [5a84e07]
  - @openspec-ui/webui@1.52.1
  - @openspec-ui/core@0.90.1
  - @openspec-ui/server@1.27.1

## 0.59.2

### Patch Changes

- 2ecff71: The screens of the shell spend the Metro families the frame already carries.
  Harness Settings is a titled panel with an icon in the title's own slot. The
  Timeline tab draws its tasks as a real timeline, and the multi-change history
  becomes a day grid — an event sits in the column of the day it happened,
  rather than at a log-scaled percentage, so two changes archived the same day
  line up. The summary counts become tiles, a change's state word becomes a
  badge that keeps its state class, and the Processes and Pipeline controls
  carry an icon before a label that does not change.
- Updated dependencies [2ecff71]
  - @openspec-ui/webui@1.52.0

## 0.59.1

### Patch Changes

- 48c7c74: The standalone shell says what it is doing. Diff Preview shows the real diff
  of a change you choose, from a new token-gated `POST /api/change-diff`,
  instead of the two-line sample it has always shown; a change with nothing
  uncommitted says so, and a workspace that is not a repository says that. A
  tab that reads when it opens now shows one status line naming what it is
  reading, so a slow screen no longer looks like a broken one. The theme
  control is a switch: its visible name stays "Dark theme", and its state is
  carried by the switch's role and an icon.
- Updated dependencies [48c7c74]
  - @openspec-ui/webui@1.51.0
  - @openspec-ui/server@1.27.0

## 0.59.0

### Minor Changes

- 324ed92: The Pipeline panel keeps answering while the Agentic Harness runs a chain.
  With the optional local server enabled, the panel now shows the standalone
  shell's Pipeline tab, so the cards are read by the server's process instead of
  the editor's, which is busy running the chain. Opening a change from a card
  still opens it in the editor, and Stop still goes through the same signed
  route. With the server disabled, the panel works exactly as before.

### Patch Changes

- 902599d: The web UI's screens use what ADR 0032 brought in. Harness Settings is a set
  of panels, each with its name and an icon in the title. A change's history
  reads as a timeline, and several changes read as one picture over a single
  axis of days rather than a log-scaled lane. The summary shows tiles with an
  icon, a change's state word is a badge, and repeated actions carry an icon
  before their label.
- 902599d: The web UI's copy of Metro UI now carries panels, cards, badges and Metro's
  timeline, with every one of their variables mapped to the editor's own theme
  for the VS Code panels (ADR 0032). Icons ship as a subset of the pinned Metro
  icon set, inlined in the stylesheet, so a host that refuses another origin
  still draws them, and a screen names what it means rather than a glyph.
  
  A hue that holds a label now declares the ink used on it, and a test computes
  the contrast of every pair. No screen changes yet; the screens follow.
- Updated dependencies [324ed92]
- Updated dependencies [902599d]
- Updated dependencies [902599d]
  - @openspec-ui/webui@1.50.0

## 0.58.2

### Patch Changes

- 2369d23: Artifact labels in the Changes tree read better with custom OpenSpec schemas.
  An id that is a known term is written as that term, so `asyncapi` reads
  AsyncAPI. A file a glob matched names its artifact and itself, such as
  "Specs: landing-page.md".
  
  A spec file outside a capability folder, such as `specs/landing-page.md`, is
  now marked "not applied on archive". OpenSpec's archive merges only
  `specs/<capability>/spec.md` and drops such a file without a warning.
- Updated dependencies [2369d23]
  - @openspec-ui/core@0.90.0
  - @openspec-ui/server@1.26.5
  - @openspec-ui/webui@1.49.3

## 0.58.1

### Patch Changes

- dbcbeb9: A change's artifact list now includes only files inside that change's own
  folder. Some OpenSpec schemas point outside the change, for example
  `spec-driven-with-adr` as published between May and June 2026, whose ADR
  artifact covered the repository's whole `adr/` folder. With such a schema,
  every ADR of the repository used to appear under every change. A link inside
  a change that points elsewhere no longer brings files in either.
- Updated dependencies [dbcbeb9]
  - @openspec-ui/core@0.89.1
  - @openspec-ui/server@1.26.4
  - @openspec-ui/webui@1.49.2

## 0.58.0

### Minor Changes

- 290e09d: Changes now list the artifacts their OpenSpec schema declares.
  
  - **Nested delta specs.** A delta spec kept in an area folder, such as
    `specs/web/dashboard-foundation/spec.md`, shows as
    "Spec: web/dashboard-foundation". It used to show as "Spec: web — missing".
  - **Custom schemas.** A project schema's own artifacts appear in the order the
    schema lists them, for example an ADR added to proposal, specs, design and
    tasks.
  - **Agent runs and the parallel-readiness report** use the same list, so an
    agent sees every file a change's schema declares.
  - **A schema that cannot be found or read.** The change shows a warning row
    that says why, above the default spec-driven artifacts.

### Patch Changes

- Updated dependencies [290e09d]
  - @openspec-ui/core@0.89.0
  - @openspec-ui/server@1.26.3
  - @openspec-ui/webui@1.49.1

## 0.57.0

### Minor Changes

- 20c8e4c: The web UI now uses Metro UI 5.1 controls. Buttons, fields, selects,
  textareas and tables are drawn by Metro, from a trimmed copy kept in the
  repository, so nothing is loaded from a CDN.
  
  - **Colours.** The main action on each form stands out, and actions that
    stop or discard something are marked in an alert colour.
  - **Standalone.** The shell has a dark theme. It follows the operating
    system until you choose one with the new toggle in the header, and then
    remembers your choice.
  - **Inside VS Code.** Every Metro colour comes from your editor theme,
    whether light, dark, high contrast or third-party, and the panels follow
    a theme switch without reopening.

### Patch Changes

- Updated dependencies [20c8e4c]
  - @openspec-ui/webui@1.49.0
  - @openspec-ui/server@1.26.2

## 0.56.0

### Minor Changes

- cc67d90: The owl marks the app. It stands at the left of the standalone shell's headline and of the editor's AI panel, and it is the standalone page's browser-tab icon. In VS Code it is the extension's icon, and a monochrome owl is its Activity Bar icon.

### Patch Changes

- Updated dependencies [cc67d90]
  - @openspec-ui/webui@1.48.0
  - @openspec-ui/server@1.26.1

## 0.55.0

### Minor Changes

- 352b8a6: A run in another worktree can be asked to stop, through ADR 0028's signed channel.
  
  - A request to stop is a file of its own in `.agent-messages`, beside the status and roster directories and inside no working directory. `askRunToStop` seals it with the asker's machine key. `readStopRequests` opens each envelope before parsing it, and gives a run each request addressed to it either to act on or refused as unverified, stale or already read. A request that does not check out is attributed to no run; `openspec-ui-cli status` reports it by file name.
  - A run reads its requests at each renewal of its status record. A verified, fresh and new request stops it where its work is sound, as a card's Stop would: the host's `onStopRequested` calls `requestStop` with the enrolled person as `by`, and a chain's ending entry carries the request's `messageId`. A refused request is said once in the run's activity and recorded as an audit message. The server's socket runs, the delegated item run, the CLI's run and the extension's runs all read requests, and the sweep removes request files long past their window.
  - `openspec-ui-cli stop <instanceId> --reason <text>` asks a live run to stop and prints the message id.
  - A Pipeline card offers Stop on a run held elsewhere only when its verified record is signed by the person this host's key is enrolled as. It then says it is waiting for the run to read the request, and later that the run has not. Any other run held elsewhere states whose it is, or that it is not verified. The standalone server answers `POST /api/runs/ask-to-stop`, and the editor's Pipeline panel `openspec-ui/ask-to-stop`; both ask only a run they read as live.

### Patch Changes

- fd742f7: A Pipeline card opens to its tasks.
  
  - A checklist item records the `## ` section it is listed under. The survey carries every item of a change's task list as a row, with its number, section and who may close it. `describeTaskRows` gives each row one word: done, in hand, probably next, open, only a person can close it, or delegated to an agent.
  - `Show tasks` and `Hide tasks` open a card to list its rows under their headings. A thin rail joins each row to the next, and the row a run is on stands out in words and weight. `Open all` and `Close all` sit above the picture, and a legend says what each kind of line means.
  - An open card's height is derived (`pipelineOpenCardHeight`), and `layoutChanges` stacks each column by the cards' heights. Opening a card moves only the cards below it, and every edge still meets a card at its head.
  - The picture zooms through 75%, 90%, 100%, 125% and 150%, and every length on a card scales with it. Each host remembers the zoom and the open cards: the standalone shell in `localStorage`, and the editor's Pipeline panel in its webview state.
- 27694fb: A running chain's row in the Processes tree offers Cancel Process again, and a Pipeline card's Continue and permission answers reach a chain in the editor. The editor had sent them through the chain runner's agent runner, which answers neither, so pressing Continue did nothing; they now go to the chain runner itself, as the standalone server's socket does. The command is titled "OpenSpec UI: Cancel Process", no longer "Cancel Implementation Session", since a chain's row offers it too.
- Updated dependencies [fd742f7]
- Updated dependencies [3c79199]
- Updated dependencies [352b8a6]
  - @openspec-ui/core@0.88.0
  - @openspec-ui/webui@1.47.0
  - @openspec-ui/server@1.26.0

## 0.54.0

### Minor Changes

- 4dc31fa: A change is run from its Pipeline card.
  
  - Start opens the run dialog for that change. In the standalone app, the dialog and the chain it starts are shown on the Pipeline tab, with focus moved into them and back to Start when they close. In the editor, the Pipeline panel runs `openspec-ui.runWithHarness`, which now accepts a change name and refuses one that is not an active change.
  - On a run this host holds, the card answers a checkpoint (`Continue to <stage>`), a permission (`Allow`, `Deny`), and offers `Stop`, which asks for a reason, and `Stop now` once a stop has been asked. A run held elsewhere offers only its folder path to copy, and a waiting run says it is answered where it was started.
  - A new `stop` command asks a run to stop where its work is sound: at a checkpoint at once, on a permission by denying it, and inside a stage at the next task marker naming another task or the next ticked task. Both `HarnessChainRunner` and the agent runner use one rule, in `stop-boundary.ts`. A `stopRequested` event says the stop was asked, the status record states it, and the chain's ending audit entry carries `stopRequest` with the reason and who asked.
  - Each host keeps a `LiveRuns` registry of the runs it holds. The server answers `/api/live-runs`, and the editor's Pipeline panel answers `pipeline/live-runs`.
  - A run waiting here that this host does not hold reads `Waiting in <label>`, as ADR 0029 words it.
  - Cancelling a chain from the Processes tree now cancels the chain. The chain's event log in `HarnessChainPanel` is reachable by keyboard.

### Patch Changes

- Updated dependencies [4dc31fa]
  - @openspec-ui/core@0.87.0
  - @openspec-ui/webui@1.46.0
  - @openspec-ui/server@1.25.0

## 0.53.0

### Minor Changes

- 107524d: A Pipeline card says what its change is doing. Core derives one card per change from readings the hosts already take (`describeChangeCards`, `describeChangeCard`), with facts from the change's own worktree where it has one. Each card gives:
  
  - its state: waiting, running, failed or stopped at a stage, blocked, done or ready;
  - the task a live run is on, in the agent's own words, the task it was given, or a marked guess;
  - what the run is doing or waiting on, and how long ago it said so;
  - how many tasks are done, and how many only a person can close or are delegated;
  - how the last run ended, what it cost where that was reported, and why a stopped run stopped.
  
  Its word is `describeChangeState`'s, read against the same standings as the Changes list, so the two never disagree. Runs a card shows are no longer repeated in the run lines above the picture.
  
  A chain now writes one audit entry as it ends, saying how, at which stage and why, and every counter of runs skips it. `readLastRuns` reads each change's last ended run from every worktree's audit log, and parses a log again only when it changes. The server answers `/api/change-last-runs`, and the editor's Pipeline panel answers `pipeline/last-runs` and `pipeline/standings`.
- f25c29a: A change says where it stands. Core reads each change across this checkout, every working directory, `main`, the change's own branch and, where `gh` can read it, its pull request (`readChangeStandings`). It also says how fresh each of those sources is. `describeChangeState` gives the one word every surface shows: Running, Waiting, Archived on main, Merged in #N, Deleted on main, Further along, Failed or Stopped at a stage, Done, Blocked, or Ready. The lines beneath the word name their sources, and a colour agrees with the word.
  
  Where the word shows:
  
  - The VS Code Changes tree and the standalone Changes list show it, and `openspec-ui-cli ready` prints it.
  - The run dialog in both hosts leads with it, and asks before starting a change that is running, settled on `main` or merged.
  - The Changes list and the Pipeline gain a Refresh that fetches refs now.
  
  A delegated run now records its request and its reply in the audit log, and the waiting-on inbox shows the latest reply beneath its item. The delegated prompt asks the agent to answer within its turn.
- 604e575: A run is signed by its person. Each person gets an Ed25519 key per machine, made on first need under `~/.openspec-ui/identity`. A run seals its status record's exact bytes with that key, and a reader verifies them before it parses anything. Every record reads as one of three states: verified (signed by an enrolled person), unverified, or does not check out. A record that does not check out shows nothing from its contents, and the sweep keeps it.
  
  A key that signs a live run and is not enrolled waits in the Human-Only Inbox of both hosts with "It was me". It is also listed by `openspec-ui-cli enrol`. `status` and the Pipeline's run lines say whose a run is, as far as its signature shows.

### Patch Changes

- Updated dependencies [107524d]
- Updated dependencies [f25c29a]
- Updated dependencies [604e575]
  - @openspec-ui/core@0.86.0
  - @openspec-ui/webui@1.45.0
  - @openspec-ui/server@1.24.0

## 0.52.2

### Patch Changes

- Updated dependencies [65ea319]
  - @openspec-ui/core@0.85.0
  - @openspec-ui/webui@1.44.2
  - @openspec-ui/server@1.23.7

## 0.52.1

### Patch Changes

- Updated dependencies [a36e5a1]
  - @openspec-ui/core@0.84.0
  - @openspec-ui/webui@1.44.1
  - @openspec-ui/server@1.23.6

## 0.52.0

### Minor Changes

- d6e5368: The Pipeline opens in VS Code.
  
  **OpenSpec UI: Open Pipeline**, also in the Changes view's title bar, opens the same Pipeline picture the standalone shell draws, in a panel of its own: this directory's changes, what can start alongside what, and every other working directory with what its runs say. Choosing a change's card reveals it in the Changes tree and opens its `proposal.md`.
  
  The panel does not poll. While it is visible, the editor watches `openspec/changes` and the directory the runs' status records are written to, and tells the picture which reading is out of date; events within a second become one message, and a reading every minute covers what raises no file event. A status record changing re-reads the records alone, without running git. The ages a run's line states keep counting between readings.
  
  - Core gains `readPipelineReadiness`, the readiness report with its suggestions, which the standalone server's route now calls instead of assembling the payload itself; `refreshSurveyRuns` and `attachRunsToDirectories`, which lay freshly read status records over a survey; and `activityAt`/`heartbeatAt` on a status report and a surveyed run. `describeRun` and `describeDirectoryRuns` take an optional clock.
  - `PipelineView` takes an optional `subscribe`: a host that knows when a reading is out of date says so, and the view reads on its word and on a one-minute backstop. Without it the view polls as before.

### Patch Changes

- Updated dependencies [d6e5368]
  - @openspec-ui/core@0.83.0
  - @openspec-ui/webui@1.44.0
  - @openspec-ui/server@1.23.5

## 0.51.0

### Minor Changes

- b7b98df: A change is configured from the change.
  
  "Configure Harness for this Change" opened a view that showed the global settings first, a change name field under the global save button, and nothing else: the panel learned the change's name after the view had mounted, and the view read its name only once. Global settings and a change's own settings are now two views, each about one file, and each opened where it belongs.
  
  - The global view has no change name field and nothing about any one change. Beside its autonomy level it says that `autonomous` is set for a single change.
  - A change's view reads the change's name as it is given, loads that change's `harness.json` with nothing typed, and names on each inherit option the value it resolves to and where from. In the standalone app it is the Change Editor's new **Harness** tab; in VS Code, "Configure Harness for this Change" opens a panel of its own per change, titled `Harness: <change>`, and "Configure Harness Settings" opens one for the global file. The AI panel no longer mounts a settings view.
  - In both views the save is disabled until a field differs from what was loaded, and "Unsaved changes" says so while one does. The named configuration block and the fields are separate sections, drawn apart.
  - Named configurations are chosen from one list, in both views and in the run dialog: a select, the chosen configuration's description beneath it, and **Apply**. What applying did is said beside the button; in VS Code the run dialog no longer raises a notification for it.
  - A recommendation drawn from past runs can be applied: the run dialog offers "Use `<agent>` for every stage". Core gains `agentForEveryStageToWrite`, which sets every stage to the agent and drops an effort, budget unit or custom agent the new agent does not accept.

### Patch Changes

- Updated dependencies [b7b98df]
  - @openspec-ui/core@0.82.0
  - @openspec-ui/webui@1.43.0
  - @openspec-ui/server@1.23.4

## 0.50.14

### Patch Changes

- 4128158: A delegated run says what happened.
  
  Handing a task to an agent through the delegated-item route could fail without saying why, and could not be seen while it ran. A marker that named its agent in backticks — ``**Delegated to `claude-cli`**``, the way every delegated item had been written — named no agent at all; it now names the same agent as the bare id, while a backtick on one side only still names nothing. A run that stopped reported only the agent's exit code; its result now carries the last lines the agent wrote to stderr, bounded, and its message quotes the last of them ("claude exited with code 1. It last said: …"). The standalone inbox shows the whole tail in a disclosure beneath the row's outcome, and VS Code shows a stopped run as a warning with a "Show output" action that writes the tail to the OpenSpec UI output channel. And a delegated run now keeps the same status record as any other run, so `openspec-ui-cli status`, the survey and the Pipeline tab see it, whichever host started it.
- Updated dependencies [4128158]
- Updated dependencies [43a3b82]
  - @openspec-ui/core@0.81.0
  - @openspec-ui/webui@1.42.0
  - @openspec-ui/server@1.23.3

## 0.50.13

### Patch Changes

- Updated dependencies [1241027]
  - @openspec-ui/core@0.80.0
  - @openspec-ui/server@1.23.2
  - @openspec-ui/webui@1.41.2

## 0.50.12

### Patch Changes

- Updated dependencies [8a71bd3]
  - @openspec-ui/core@0.79.1
  - @openspec-ui/server@1.23.1
  - @openspec-ui/webui@1.41.1

## 0.50.11

### Patch Changes

- Updated dependencies [4c9f332]
  - @openspec-ui/core@0.79.0
  - @openspec-ui/server@1.23.0
  - @openspec-ui/webui@1.41.0

## 0.50.10

### Patch Changes

- Updated dependencies [82d5021]
  - @openspec-ui/core@0.78.0
  - @openspec-ui/server@1.22.4
  - @openspec-ui/webui@1.40.4

## 0.50.9

### Patch Changes

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
- e0edfbe: A running agent now says what it is doing: which file it reads or edits, which command it runs, and which call failed.
  
  While `claude-cli-acp` worked, the AI panel repeated `agent update: assistant` and the terminal printed nothing but the agent's final words. The adapter forwarded Claude's own stream under ACP's name, so nothing downstream could read it, and no surface showed a tool call or a plan from any agent. The adapter now translates Claude's stream into ACP's own session updates — the agent's text, each tool call titled by what it acts on (`Edit packages/core/src/index.ts`, `Bash: npm test`), and each result as completed or failed. Core gains `describeAcpUpdate`, which reads an ACP update into one line and knows no particular agent; the AI panel, the chain panel, the VS Code output channel and the terminal all show that line. An update with nothing in it a person can read — Claude's own bookkeeping lines, a usage figure, a tool call that simply completed — is no longer listed by its kind in either panel or the output channel; it still reaches the event stream and the JSON output.
- Updated dependencies [b69f3c6]
- Updated dependencies [e0edfbe]
  - @openspec-ui/core@0.77.0
  - @openspec-ui/server@1.22.3
  - @openspec-ui/webui@1.40.3

## 0.50.8

### Patch Changes

- 93f371d: The editor pictures now show what their captions say.
  
  Looked at beside its caption, one of the nine was false — the Repository Setup picture named three generators and showed none — and three more had fallen behind: the archive menu has ten actions where its caption named four, the expanded overview promised change artifacts and process entries it did not show, and the compact overview left out the Human-Only Inbox. Each capture now asserts what its caption claims before the picture is taken, and no picture can be taken with the account name on screen.

## 0.50.7

### Patch Changes

- 7bcd7f1: The editor pictures are taken by a spec, like every other one.
  
  Nine pictures of the editor's own views were hand-taken, on the recorded reason that no agent can drive them or capture the window. Playwright drives Electron, VS Code is Electron, and both were already here: `packages/extension/e2e` now launches the editor with the extension loaded against a fixed fixture workspace and captures all nine.
  
  `scripts/screenshot-baseline.json` is empty, and the mechanism stays — deleting it would make the next hand-taken picture legal by silence. The `editor-native` reason is retired, being the one that turned out not to be a reason.
  
  One caption was corrected against its fresh picture: the archived change's context menu was described as four actions and has ten.

## 0.50.6

### Patch Changes

- Updated dependencies [7fc5535]
  - @openspec-ui/core@0.76.1
  - @openspec-ui/server@1.22.2
  - @openspec-ui/webui@1.40.2

## 0.50.5

### Patch Changes

- Updated dependencies [15363ee]
  - @openspec-ui/core@0.76.0
  - @openspec-ui/server@1.22.1
  - @openspec-ui/webui@1.40.1

## 0.50.4

### Patch Changes

- Updated dependencies [f6b9389]
- Updated dependencies [4940254]
- Updated dependencies [ee31b4d]
  - @openspec-ui/core@0.75.0
  - @openspec-ui/server@1.22.0
  - @openspec-ui/webui@1.40.0

## 0.50.3

### Patch Changes

- Updated dependencies [e411f9a]
  - @openspec-ui/core@0.74.0
  - @openspec-ui/server@1.21.0
  - @openspec-ui/webui@1.39.0

## 0.50.2

### Patch Changes

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
- Updated dependencies [394d426]
  - @openspec-ui/core@0.73.0
  - @openspec-ui/server@1.20.7
  - @openspec-ui/webui@1.38.4

## 0.50.1

### Patch Changes

- Updated dependencies [e02c596]
  - @openspec-ui/core@0.72.0
  - @openspec-ui/server@1.20.6
  - @openspec-ui/webui@1.38.3

## 0.50.0

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

### Patch Changes

- Updated dependencies [8f574fe]
  - @openspec-ui/core@0.71.0
  - @openspec-ui/server@1.20.5
  - @openspec-ui/webui@1.38.2

## 0.49.5

### Patch Changes

- Updated dependencies [4385179]
  - @openspec-ui/core@0.70.0
  - @openspec-ui/server@1.20.4
  - @openspec-ui/webui@1.38.1

## 0.49.4

### Patch Changes

- Updated dependencies [824b784]
  - @openspec-ui/webui@1.38.0

## 0.49.3

### Patch Changes

- Updated dependencies [261a2df]
  - @openspec-ui/core@0.69.0
  - @openspec-ui/server@1.20.3
  - @openspec-ui/webui@1.37.3

## 0.49.2

### Patch Changes

- Updated dependencies [296802b]
  - @openspec-ui/core@0.68.0
  - @openspec-ui/server@1.20.2
  - @openspec-ui/webui@1.37.2

## 0.49.1

### Patch Changes

- Updated dependencies [300b79d]
  - @openspec-ui/core@0.67.0
  - @openspec-ui/server@1.20.1
  - @openspec-ui/webui@1.37.1

## 0.49.0

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

### Patch Changes

- Updated dependencies [91f9ad7]
- Updated dependencies [9c2c7d5]
  - @openspec-ui/core@0.66.0
  - @openspec-ui/server@1.20.0
  - @openspec-ui/webui@1.37.0

## 0.48.1

### Patch Changes

- Updated dependencies [e0a0e99]
  - @openspec-ui/core@0.65.0
  - @openspec-ui/webui@1.36.0
  - @openspec-ui/server@1.19.1

## 0.48.0

### Minor Changes

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
  - @openspec-ui/webui@1.35.0
  - @openspec-ui/server@1.19.0

## 0.47.0

### Minor Changes

- be28986: A task that needs a live check can name the agent that performs it.
  `**Delegated to <agent-id>**` sits beside `**Human-only**`: the first
  means another agent can make the check, the second that none can. The
  inbox in both hosts now carries both kinds and says who each item waits
  on, naming an agent id the registry does not carry rather than treating
  it as assigned.
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
- 683fef4: A change row rebuilt to answer "what is this element's parent" now
  carries the state the tree drew, instead of `draft` written in. VS Code
  restores the tree's selection through that chain after a window reload
  and draws what it returns, so a change with every task done could read
  `draft` until the next refresh.
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
  - @openspec-ui/webui@1.34.0
  - @openspec-ui/server@1.18.0

## 0.46.1

### Patch Changes

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
- Updated dependencies [93b544d]
  - @openspec-ui/core@0.62.0
  - @openspec-ui/server@1.17.0
  - @openspec-ui/webui@1.33.0

## 0.46.0

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
  - @openspec-ui/server@1.16.0
  - @openspec-ui/webui@1.32.0

## 0.45.1

### Patch Changes

- Updated dependencies [6abc8fa]
  - @openspec-ui/core@0.60.1
  - @openspec-ui/server@1.15.1
  - @openspec-ui/webui@1.31.1

## 0.45.0

### Minor Changes

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
- Updated dependencies [24925a7]
- Updated dependencies [f4beaaf]
- Updated dependencies [8987e8b]
- Updated dependencies [432769d]
- Updated dependencies [8b7f4b8]
- Updated dependencies [09a49fd]
  - @openspec-ui/core@0.60.0
  - @openspec-ui/webui@1.31.0
  - @openspec-ui/server@1.15.0

## 0.44.2

### Patch Changes

- Updated dependencies [8f2ed11]
- Updated dependencies [a107503]
- Updated dependencies [cba553e]
- Updated dependencies [d1e15ca]
  - @openspec-ui/core@0.59.0
  - @openspec-ui/server@1.14.0
  - @openspec-ui/webui@1.30.0

## 0.44.1

### Patch Changes

- Updated dependencies [94a295e]
- Updated dependencies [9f323c1]
  - @openspec-ui/core@0.58.0
  - @openspec-ui/server@1.13.27
  - @openspec-ui/webui@1.29.1

## 0.44.0

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
- Updated dependencies [a21392c]
- Updated dependencies [9836f84]
- Updated dependencies [ec0d6ac]
- Updated dependencies [dea1dc4]
  - @openspec-ui/webui@1.29.0
  - @openspec-ui/core@0.57.0
  - @openspec-ui/server@1.13.26

## 0.43.0

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
  - @openspec-ui/webui@1.28.0
  - @openspec-ui/server@1.13.25

## 0.42.0

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

- Updated dependencies [2074915]
- Updated dependencies [7aae888]
- Updated dependencies [c26dea5]
- Updated dependencies [878db9c]
- Updated dependencies [ce232d2]
- Updated dependencies [182f22e]
- Updated dependencies [695bf32]
- Updated dependencies [c3963c9]
- Updated dependencies [ea25d08]
- Updated dependencies [13efb9e]
- Updated dependencies [a82b322]
- Updated dependencies [ba09225]
- Updated dependencies [960b489]
  - @openspec-ui/core@0.55.0
  - @openspec-ui/webui@1.27.0
  - @openspec-ui/server@1.13.24

## 0.41.1

### Patch Changes

- Updated dependencies [5b61c75]
  - @openspec-ui/core@0.54.0
  - @openspec-ui/server@1.13.23
  - @openspec-ui/webui@1.26.1

## 0.41.0

### Minor Changes

- 2877f5d: Add "Reveal in Change Graph" (on a change in Changes/Archive) and "Reveal in Changes" (on a graph row), plus a `openspec-ui.followSelectionInChangeGraph` setting (default `false`) that reveals the graph automatically as the Changes/Archive selection changes. Locating a change with several rows expands and selects every one of them and reports the count; a change that states no relation is reported as such rather than appearing to do nothing. `ChangesTreeProvider`, `ArchiveTreeProvider`, and `ChangeGraphTreeProvider` gain `getParent`, and the Change Graph view now registers via `createTreeView` so it can be revealed into.

## 0.40.0

### Minor Changes

- 53a9f7d: Fix a chain run hanging forever when its agent asks for permission: `HarnessChainRunner` now routes a `"resolvePermission"` command to the runner executing the stage in flight (mirroring how `"cancel"` is already routed), instead of rejecting it as a non-`"chain"` command. Both hosts (`packages/server`'s WebSocket dispatcher and the VS Code extension's webview message handler) gain the matching routing branch, and `HarnessChainPanel` gains the Allow/Deny control needed to answer. A permission request raised under `autonomyLevel: "autonomous"` — where there is no confirmation channel — now fails the stage with a stated reason and ends the underlying process, instead of waiting on a promise nothing can resolve.

### Patch Changes

- Updated dependencies [53a9f7d]
  - @openspec-ui/core@0.53.0
  - @openspec-ui/webui@1.26.0
  - @openspec-ui/server@1.13.22

## 0.39.0

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

### Patch Changes

- Updated dependencies [12b730b]
  - @openspec-ui/core@0.52.0
  - @openspec-ui/server@1.13.21
  - @openspec-ui/webui@1.25.2

## 0.38.0

### Minor Changes

- 1339604: Run this repository's own `typecheck`/`test`/`lint` checks from the editor —
  three new commands, shown in the Changes view title and Command Palette only
  when the open workspace actually declares a script for them. Resolution
  prefers an `openspec-ui.checks` setting, then an `osui-<name>` script (for a
  workspace that wants to expose something faster or narrower to the editor
  than its own), then the bare `<name>`; a workspace declaring neither is
  offered no command rather than one that fails. Each run reports through the
  same `runMechanicalCheck` the Agentic Harness's `verify` stage already uses,
  so a failure states the command and its output. Also adds a Show Change
  Comparison Timeline entry to the Changes view title menu.

## 0.37.3

### Patch Changes

- 6c2a6ad: Refresh the workbench screenshots so they show the Change Graph view, and
  drop the notes that apologised for their absence.

## 0.37.2

### Patch Changes

- 9d4c55d: Describe what shipped. The CLI README said it "intentionally supports only
  `validate`" while the package had gained `change-graph` and
  `release-manifest`; all three are now documented. The extension README
  gains the Change Graph view, the command that walks a change back to what
  it follows, and the recorded spend and ceilings that were only described
  in LIMITS.md.

## 0.37.1

### Patch Changes

- e6cf843: Point at the project site. Both manifests gain a `homepage`, so the
  Marketplace and npm listings link to https://openspec-ui.dev, and the
  READMEs a reader lands on say where it is.

## 0.37.0

### Minor Changes

- f3214ab: Show the relation between changes in the editor. A read-only Change Graph
  view nests each change under the ones it follows, marks archived changes
  and any waiting on a blocker that has not landed, and shows a cycle rather
  than letting the subgraph vanish. A new command on a change — Show What
  This Change Follows — lists what it grew out of and opens any of them. The
  Changes list is unchanged: it is where changes are acted on, and each
  appears there exactly once.

## 0.36.1

### Patch Changes

- bfad445: Stop showing finished runs as still working. A run that reported progress
  kept that value after finishing, and the Processes view printed it beside
  the state — `usage-from-acp · completed · Running`. The marker that
  produced it is no longer reported, a terminal row no longer shows a live
  field, and journal load drops that marker from records already written.
  The lease-reclamation note, which nothing else records, is preserved.
- Updated dependencies [e78face]
- Updated dependencies [bfad445]
  - @openspec-ui/core@0.51.0
  - @openspec-ui/server@1.13.20
  - @openspec-ui/webui@1.25.1

## 0.36.0

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
- Updated dependencies [9353534]
- Updated dependencies [a61bfbe]
- Updated dependencies [ae78a82]
  - @openspec-ui/core@0.50.0
  - @openspec-ui/webui@1.25.0
  - @openspec-ui/server@1.13.19

## 0.35.1

### Patch Changes

- 499fbf6: Deliver a cancellation to the runner that owns the run.
  
  - The VS Code panel remembers which agent each run was started against, so a cancel no longer falls back to the default agent — cancelling any agent other than `claude-cli` had never reached the run.
  - A cancel no longer registers a `WorkbenchProcess`. It is a signal about a run, not a run, and the entry it created waited forever for a terminal event a cancel does not emit.
  - The chain path posts `cancelling` when it accepts a cancel, instead of returning silently.

## 0.35.0

### Minor Changes

- 2ec29df: Report cancellation when it happens, not when it is requested.
  
  - New non-terminal `cancelling` event. `cancelled` is now emitted only once the agent's process has actually exited; a process that outlives the request produces a `failed` naming that, not a `cancelled` that did not happen.
  - `terminateProcessTree` reports whether the kill could be issued instead of swallowing the result, and treats POSIX `ESRCH` as success.
  - The Cancel control stays available while a run is still producing output after a cancellation, and accepts a second press.

### Patch Changes

- Updated dependencies [2ec29df]
  - @openspec-ui/core@0.49.0
  - @openspec-ui/webui@1.24.0
  - @openspec-ui/server@1.13.18

## 0.34.1

### Patch Changes

- Updated dependencies [4e59bdf]
- Updated dependencies [4e59bdf]
  - @openspec-ui/core@0.48.0
  - @openspec-ui/webui@1.23.3
  - @openspec-ui/server@1.13.17

## 0.34.0

### Minor Changes

- eca84bc: Bound retained checkpoints on their own limit and stop reading every one at startup.
  
  - `WorkbenchRunJournal.load()` returns checkpoint references with a `loadCheckpoint()` reader instead of reading and parsing every payload. On this repository that read was 531 MB on every activation.
  - New `maxCheckpointSessions` (default 10), separate from `maxProcesses`: a process entry is tens of bytes, a checkpoint tens of megabytes, and one limit over both is not a limit.
  - Retention is by recency, never by process state — `canRollback` covers completed and failed runs, so evicting them by state would withdraw a rollback the product offers.

### Patch Changes

- Updated dependencies [eca84bc]
- Updated dependencies [d161b50]
  - @openspec-ui/core@0.47.0
  - @openspec-ui/server@1.13.16
  - @openspec-ui/webui@1.23.2

## 0.33.1

### Patch Changes

- Updated dependencies [348ee61]
- Updated dependencies [348ee61]
  - @openspec-ui/core@0.46.0
  - @openspec-ui/server@1.13.15
  - @openspec-ui/webui@1.23.1

## 0.33.0

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
  - @openspec-ui/webui@1.23.0
  - @openspec-ui/server@1.13.14

## 0.32.0

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
  - @openspec-ui/webui@1.22.0
  - @openspec-ui/server@1.13.13

## 0.31.0

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
  - @openspec-ui/webui@1.21.0
  - @openspec-ui/server@1.13.12

## 0.30.14

### Patch Changes

- 69981ba: Adds "OpenSpec UI: Set Up Agentic Harness", a re-runnable guided first-run flow for the global `openspec/agent-harness.json`: it detects available CLI agents and asks for a control agent (`propose`/`review`/`archive`), an apply agent (`apply`), and an autonomy level (`assisted`/`semi-autonomous` only), writing each answer to disk as soon as it is given so cancelling mid-flow never loses an earlier answer. Successfully running "OpenSpec UI: Initialize Workspace" now offers a dismissible suggestion to run this flow when no global harness config exists yet. Choosing `claude-cli` for either role also checks the already-detected CLI version against the version this project's `claude-cli` ACP translation layer was last verified against, showing a dismissible warning (not a block) on a mismatch.

## 0.30.13

### Patch Changes

- 5cddc4d: Adds ACP (Agent Client Protocol, agentclientprotocol.com) support: a shared session driver in `@openspec-ui/core` speaks ACP JSON-RPC to whichever ACP-capable subprocess it is pointed at, and four new, additional agent adapters — `copilot-cli-acp`, `gemini-cli-acp`, `codex-cli-acp`, `claude-cli-acp` — translate an agent's structured `session/update` progress into the protocol's new `agentUpdate` event and, where the underlying agent genuinely supports it, `session/request_permission` into a new `permissionRequest` event, answerable by a new `resolvePermission` command. These are additive, separately selectable entries alongside today's five raw-text adapters — none of them change. `@openspec-ui/webui`'s AI panel renders `agentUpdate` content and shows an explicit Allow/Deny control for a `permissionRequest`; `claude-cli-acp`'s picker entry states up front that it provides progress detail only, with no permission gate (Claude's CLI has no documented interactive-permission callback in this mode). `openspec-ui-vscode` gains matching event descriptions for its own event log. `codex-cli-acp` depends on an externally installed `codex-acp` binary, detected on `PATH` like every other CLI this project already shells out to — never bundled as an npm dependency, to avoid pulling in `@openai/codex`'s native platform binary for every contributor regardless of use.
- Updated dependencies [5cddc4d]
  - @openspec-ui/core@0.42.0
  - @openspec-ui/webui@1.20.0
  - @openspec-ui/server@1.13.11

## 0.30.12

### Patch Changes

- 144e13b: A workbench process can now suspend itself to wait on an external system without holding the workspace's mutation lock. `WorkbenchProcessState` gains `"suspended"`, and `WorkbenchProcess` gains an optional `waitingFor` reason. `ProcessExecutionContext` gains `suspend(reason, { timeoutMs })`, which releases the in-process mutation lock and, where a `WorkspaceLeaseManager` is configured, the cross-host lease too — letting another mutating process run in its place. `WorkbenchProcessScheduler.resumeProcess(id)` returns a suspended process to the queue (never directly to `"running"`, so two processes suspended at once still serialize), where it re-admits under the existing lock/lease rules. Every suspension is bounded: on timeout the process fails, naming what it waited for and for how long; cancelling a suspended process ends it as `"cancelled"` immediately. A suspended process persisted across a host restart is recovered as `"interrupted"`, matching `"queued"`/`"running"`, since the poller and the in-memory wait belonged to the host that is gone. New `external-waiter.ts` provides a generic, lock-free poller for a future consumer to build on. The Processes views in both the VS Code extension and the standalone webui render a suspended process as waiting, with its wait reason, distinctly from running. This ships the mechanism only — no stage in this repository suspends yet.
- Updated dependencies [144e13b]
  - @openspec-ui/core@0.41.0
  - @openspec-ui/webui@1.19.2
  - @openspec-ui/server@1.13.10

## 0.30.11

### Patch Changes

- ed9e4c9: Audit records now survive a host restart. `FileAuditLog` (packages/core/src/security.ts) gains a bounded, rotating JSONL file (oldest entries dropped first, never the whole file) and a `readEntries()` to read them back. Both `packages/server` (`cli.ts`, and `optional-server.ts` on the extension side) and `packages/extension`'s direct-import mode (`extension.ts`) now construct a `FileAuditLog` under the workspace's `.openspec-ui/audit.jsonl` and share it between the runners it audits and `HarnessChainRunner`'s `listAuditEntries`, so a configured spending ceiling sums a change's persisted history across restarts rather than resetting on every editor close. `core` also exports `auditLogPath(workspaceRoot)`, the one place this file's location is decided. No change to what is recorded, to `buildUsageReport`, or to the budget's comparison logic — only to whether the records outlive the process that wrote them.
- Updated dependencies [ed9e4c9]
  - @openspec-ui/core@0.40.0
  - @openspec-ui/server@1.13.9
  - @openspec-ui/webui@1.19.1

## 0.30.10

### Patch Changes

- 80a097b: A `stepAgents` entry can now set a reasoning effort and a spending cap, resolved through the same global/per-change merge as `model`. `HarnessStepAgent`'s object form gains `effort?: HarnessEffort` and `budget?: { maxCostUsd?: number; maxAiCredits?: number }` — the spending cap stays in each agent's own unit rather than one shared field, since the CLIs do not share a unit. `HARNESS_AGENT_CAPABILITIES` (`packages/core/src/harness-step-agent.ts`) is the single table both `harness-config.ts`'s validator and each adapter read: `claude-cli` and `copilot-cli` render `--effort`/`--max-budget-usd`/`--max-ai-credits`; `codex-cli` renders `-c model_reasoning_effort="<level>"` and nothing for budget; `gemini-cli` has neither mechanism. A stage entry setting a value its agent cannot express is refused when the configuration resolves, naming the agent and the accepted values, rather than being silently ignored or failing minutes into a run. `default-runners.ts`'s allowlist matcher generalizes from a single optional `--model` pair to an ordered, closed set of validated optional pairs. The webui's Harness Settings view and the VS Code extension's per-change customization wizard both offer effort/budget per stage, limited to what that stage's selected agent accepts. An entry without the new fields produces a byte-identical command line to before this change.
- Updated dependencies [80a097b]
  - @openspec-ui/core@0.39.0
  - @openspec-ui/webui@1.19.0
  - @openspec-ui/server@1.13.8

## 0.30.9

### Patch Changes

- 56a7c37: A run started from the AI panel can now be cancelled from it: a Cancel button next to Run appears while a run is in flight, sending a `cancel` command on the active `runId` through the same transport the run was started on — the only cancel affordance previously existed for `HarnessChainPanel`'s chain runs, unreachable at `autonomyLevel: "assisted"`, so a single-stage run (available at every autonomy level) could not be cancelled from the UI at all. `openspec-ui.cancelProcess`'s contributed title is renamed to "OpenSpec UI: Cancel Implementation Session" to say what it actually cancels — an implementation session via `deps.implementationSessions.cancel(...)`, not a harness run; its command id, `when` clause, and behavior are unchanged.
- Updated dependencies [56a7c37]
  - @openspec-ui/webui@1.18.0

## 0.30.8

### Patch Changes

- Updated dependencies [d0be00e]
  - @openspec-ui/core@0.38.0
  - @openspec-ui/server@1.13.7
  - @openspec-ui/webui@1.17.7

## 0.30.7

### Patch Changes

- Updated dependencies [8f60b09]
  - @openspec-ui/core@0.37.0
  - @openspec-ui/server@1.13.6
  - @openspec-ui/webui@1.17.6

## 0.30.6

### Patch Changes

- dc71cec: Added a `verify` stage to the Agentic Harness chain, running after `apply` and before `archive`, per `docs/adr/0018-event-driven-harness-orchestration.md` gap 1. It reviews the implementation against `tasks.md` and the change's spec delta, and unchecks any task whose stated verification does not actually hold — the existing archive gate (which already refuses to archive a change with unchecked tasks) is what stops the chain, not a new outcome or gate.
  
  `CommandKind` gains an additive `"verify"` member; `commandInstruction("review")` is reworded to describe reviewing the change's proposal (its actual job at chain position 2), resolving the standing contradiction with its old "review the current implementation" wording. `HarnessStage`/`STAGES` gain `"verify"` between `"apply"` and `"archive"`; `HarnessChainRunner`'s `CHAIN_STAGES` and `determineStartStage()` are updated to match — a change whose tasks are all checked but isn't yet archived now resumes at `verify`, not `archive` directly. `stepAgents.verify` resolves through the same global/per-change merge as every other stage.
  
  `security.ts`'s `AgentPromptContextOptions` gains an optional `verifiedDelta` field; when present, `prepareAgentContext()` adds a labelled section carrying the verified run's changed files, truncated with a visible count if oversized, and never sourced from `GitWrapper.diff()` (which would leak a concurrent session's unrelated uncommitted work). `HarnessChainRunner` sources this from a checkpoint captured around the `apply` stage, best-effort — a chain with no delta available (or one that never captures a checkpoint) produces the exact same prompt as before this change.
  
  `packages/extension`/`packages/webui`: the hand-maintained stage lists in the per-change harness config wizard (`commands.ts`) and the Harness Settings view (`HarnessSettingsView.tsx`) now include `verify` in chain order.
- Updated dependencies [dc71cec]
  - @openspec-ui/core@0.36.0
  - @openspec-ui/webui@1.17.5
  - @openspec-ui/server@1.13.5

## 0.30.5

### Patch Changes

- 6ed2d1a: Added accounting plumbing for a run's resource usage and observed agent version, and an optional cost/token budget for Agentic Harness chains.
  
  `AuditEntry` (security.ts) gains optional `usage`, `agentVersion`, and `changeDir` fields — all optional, so audit lines written before this change stay valid. `agent-detection.ts` now captures a best-effort agent version from the `--version` probe it already runs (no second spawn) via a new `detectAvailableAgentsDetailed()` export; the existing `detectAvailableAgents()` boolean-map contract is unchanged. New `agent-usage.ts` defines the adapter-agnostic `AgentUsage` shape; new `usage-report.ts` aggregates recorded usage by agent, by model, and by change, distinguishing unmeasured runs from zero cost. New `verified-agent-versions.ts` holds the single `claude` CLI version this project's structured-output parsing was verified against.
  
  `HarnessConfig` gains an optional `budget` (`maxCostUsd`/`maxTokens`); `HarnessChainRunner` checks it before starting each stage of a chain and refuses to continue once recorded usage reaches it, naming the budget as the reason. A run already in progress is never interrupted. `WorkbenchProcess` gains an optional `usage` field so a run's recorded cost can be shown in the Processes view (extension tree, webui table) when present — never as `$0.00` when absent.
  
  No adapter is changed by this commit: nothing yet produces `AuditEntry.usage`, so the budget stays inert until a future change (`acp-agent-adapters`) adds a producer.
- Updated dependencies [6ed2d1a]
  - @openspec-ui/core@0.35.0
  - @openspec-ui/webui@1.17.4
  - @openspec-ui/server@1.13.4

## 0.30.4

### Patch Changes

- Updated dependencies [d15f4cb]
  - @openspec-ui/core@0.34.1
  - @openspec-ui/server@1.13.3
  - @openspec-ui/webui@1.17.3

## 0.30.3

### Patch Changes

- db0e717: Tree-scoped commands now act on the row highlighted in the tree when they are invoked without one. The Command Palette always invokes a command with no arguments — only a tree's own right-click menu passes the clicked item — so running "OpenSpec UI: Archive Change" from the palette with a change highlighted reported `select a change in the tree first`, telling the user to do what they had already done. The Changes, Archive and Templates views are now registered with `createTreeView`, whose handle exposes `selection`, and each command falls back to that selection when exactly one row of the kind it expects is highlighted in the view that owns it. Several rows, a row of another kind, or nothing selected all still refuse, because picking one of them would be a choice the user never made; the state checks and the modal confirmations each command already performs are unchanged. The warning now names the right-click menu as the alternative.
- Updated dependencies [6b13d58]
- Updated dependencies [6b13d58]
- Updated dependencies [d9084ab]
- Updated dependencies [db0e717]
- Updated dependencies [6b13d58]
  - @openspec-ui/core@0.34.0
  - @openspec-ui/webui@1.17.2
  - @openspec-ui/server@1.13.2

## 0.30.2

### Patch Changes

- 09ab8bf: Fix 15 tree-scoped commands (`archiveChange`, `unarchiveChange`, `deleteChange`, `deleteTask`, `revealTask`, `runWithHarness`, and 9 others) silently doing nothing when invoked via the Command Palette with no tree item selected. They now show an explicit warning naming the kind of item required, matching the existing `reviewDiff` behavior.

## 0.30.1

### Patch Changes

- Updated dependencies [5ce55ae]
  - @openspec-ui/core@0.33.2
  - @openspec-ui/server@1.13.1
  - @openspec-ui/webui@1.17.1

## 0.30.0

### Minor Changes

- 211c001: Add "OpenSpec UI: Create Change Template" — creates an OpenSpec change and,
  in the same flow, optionally walks through configuring that change's
  per-change Agentic Harness override (which agent handles each stage, the
  autonomy level, the review gate) instead of requiring a separate
  "configure harness" step afterward. Declining customization, or leaving
  every question at its default, writes no per-change `harness.json` —
  identical to a change created without ever running this command.
  
  See `openspec/changes/agentic-harness-change-template/` for the full
  design.

### Patch Changes

- Updated dependencies [b21d2f4]
  - @openspec-ui/core@0.33.0

## 0.29.0

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

### Patch Changes

- Updated dependencies [be47425]
- Updated dependencies [be47425]
  - @openspec-ui/core@0.32.0
  - @openspec-ui/server@1.13.0
  - @openspec-ui/webui@1.17.0

## 0.28.0

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

### Patch Changes

- Updated dependencies [3a93782]
- Updated dependencies [cc7fc8a]
- Updated dependencies [da70d78]
- Updated dependencies [47b2fc4]
- Updated dependencies [fcd2f15]
  - @openspec-ui/core@0.31.0
  - @openspec-ui/server@1.12.0
  - @openspec-ui/webui@1.16.0

## 0.27.0

### Minor Changes

- Add a cross-host workspace lease (docs/adr/0010-cross-host-workspace-lease.md) so at most one host process — a VS Code extension or a standalone server, pointed at the same workspace — can run a mutating operation at a time. A blocked host gets an immediate, actionable error naming the other host instead of racing it or queuing forever. The standalone server's own `implement` execution is now routed through the same mutation lock and lease (it previously bypassed the scheduler entirely), closing a pre-existing same-host gap alongside the cross-host one.

### Patch Changes

- Updated dependencies
  - @openspec-ui/core@0.30.0
  - @openspec-ui/server@1.11.0

## 0.26.0

### Minor Changes

- Add "OpenSpec UI: Generate Sprint Report (PDF)" Command Palette command: pick a date range and one or more changes, then save a generated PDF sprint report and optionally open it.

## 0.25.0

### Minor Changes

- Add stale-pending-task detection: a pending task untouched (per git
  blame) longer than a configurable threshold (default 14 days) is now
  flagged in the Change Timeline view. Configurable via a number input in
  the standalone Timeline tab and the new `openspec-ui.staleTaskThresholdDays`
  VS Code setting.

### Patch Changes

- Updated dependencies
  - @openspec-ui/core@0.28.0
  - @openspec-ui/webui@1.14.0

## 0.24.1

### Patch Changes

- Fix the change timeline webview showing "No timeline data" for every
  user: its CSP blocked the inline script that embeds the fetched data
  (the bundle's own external script tag still loaded, masking the
  failure instead of erroring). Fixed via a per-panel CSP nonce.

## 0.24.0

### Minor Changes

- Add a "compare changes" timeline: a new global command
  (`openspec-ui.showAllChangesTimeline`) and a standalone Timeline-tab
  mode that show several changes as parallel lanes on a shared,
  log-scaled time axis (verified against real archived-change data
  before choosing the log-scale direction). Also adds the CSS the
  single-change timeline view needed but was missing, and fixes archived
  dates plotting before same-day created/task timestamps.

### Patch Changes

- Updated dependencies
  - @openspec-ui/webui@1.13.0

## 0.23.0

### Minor Changes

- Add a "Show Change Timeline" context-menu command (active and archived
  changes) and a standalone "Timeline" tab: proposal/design/spec content
  followed by tasks positioned by best-effort git-derived completion
  date, with pending/undated tasks shown distinctly. The extension
  computes the timeline directly (no HTTP, no message bridge) and opens
  it in a new webview tab per change.

### Patch Changes

- Updated dependencies
  - @openspec-ui/webui@1.12.0

## 0.22.0

### Minor Changes

- Add an archive-time Changesets reminder to the VS Code extension. When a
  workspace has adopted Changesets (`.changeset/config.json` exists) and no
  changeset is currently pending, archiving a change now offers to run
  `npx changeset` in an integrated terminal. Silent for workspaces that
  have not adopted Changesets, and never affects the archive operation's
  own result.

### Patch Changes

- Updated dependencies
  - @openspec-ui/core@0.26.0

## 0.21.0

### Minor Changes

- Notify when a `plan`/`implement`/`review` run finishes while you're not
  watching the Processes view or the AI panel. The VS Code extension shows a
  native notification (with a "View" action that opens the Process
  Dashboard); the standalone app shows a browser notification, once
  permission is granted. `status`/`list`/`show`/`validate` (near-instant) and
  `cancelled`/`interrupted`/`rolled-back` runs are not notified.

### Patch Changes

- Updated dependencies
  - @openspec-ui/webui@1.10.0

## 0.20.2

- Fixed: every screenshot in the "Details" tab (Extensions view and
  Marketplace) was broken. `vsce package` rewrites relative README image
  paths to `https://github.com/<repo>/raw/HEAD/<original-path>`, but does
  not account for this package's `repository.directory`
  (`packages/extension`) and does not collapse `..` segments — the
  previous `../../docs/images/extension/*.png` paths became a literal,
  unresolvable `HEAD/../../docs/images/extension/*.png` URL. Screenshot
  links now use absolute `raw.githubusercontent.com` URLs, which `vsce`
  leaves untouched and which resolve correctly.

## 0.20.1

- Docs only: the Marketplace description and the root README's Delivery
  Capability Matrix now mention the built-in template catalog's actual
  size (16 templates across 9 categories) — previously the catalog's
  growth across four merged changes today was reflected only in
  `CHANGELOG.md` entries and archived OpenSpec changes, not in either
  user-facing README.

## 0.20.0

- Added a built-in template in a new `configuration` category: "Validate
  environment configuration at startup instead of failing on first use" —
  a schema-validated config module that crashes immediately with a clear
  error on a missing or invalid environment variable, instead of failing
  later at whatever code path first reads it.

## 0.19.0

- Added a built-in template: "Migrate a Create React App project to Vite"
  (`framework-migration`) — closes a gap where that category only had a
  Python backend example (Flask to FastAPI), despite JavaScript being
  named as its own target language for the catalog.

## 0.18.0

- Added two built-in templates in a new `observability` category:
  "Add structured JSON request logging to a Node.js/TypeScript HTTP API"
  and "Add a per-request correlation ID to logs and responses" (language-
  agnostic). The two are independent and complementary — neither requires
  the other.

## 0.17.0

- Added three ASP.NET Core built-in templates: "Add Entity Framework Core
  and migrations to an ASP.NET Core project" (`data-layer`), "Add an
  xUnit testing baseline to an ASP.NET Core project" (`testing`), and
  "Add JWT bearer authentication to an ASP.NET Core API" (`auth`) —
  closing a gap where ASP.NET Core, one of this product's four
  originally-targeted languages, had zero built-in templates.

## 0.16.3

- The per-command instruction text sent to CLI agents (`plan`/`implement`/
  `review`/`status`/`cancel`) is now in English instead of Russian, for
  consistency with the other command kinds and this repository's
  English-only policy. No change to which commands are available or how
  they behave beyond the language of that instruction text.

## 0.16.2

- Fixed: mutating operations such as archive no longer fail checkpoint limits
  because of ignored project output. Checkpoint capture now honors root and
  nested `.gitignore` rules, `.git/info/exclude`, and global Git excludes while
  retaining tracked and negated files. Mandatory `.env`, virtual-environment,
  and generated-cache exclusions remain active, and historical journals are
  sanitized on workspace activation without deleting project files.

## 0.16.0

- Templates tree and the standalone Templates tab now group templates
  by category instead of a flat per-origin list. VS Code: "Built-in" and
  "Project" each gain an alphabetically-sorted category subgroup level —
  a template is never a direct child of the origin group anymore.
  Standalone: table rows are sorted by category with a subheader row per
  category boundary. Presentation-only — no change to the underlying
  catalog data or to customize/insert/delete actions.

## 0.15.2

- Docs only: Marketplace description now leads with the built-in
  Claude/Copilot/Codex/Gemini agents instead of generic "native OpenSpec
  workflow" wording — no code changes.

## 0.15.1

- Docs only: added a Screenshots section to the root README (sidebar
  overview, Changes/Tasks nesting, Archive context menu, Repository
  Setup, Specs, Templates) — no code changes.

## 0.15.0

- Fixed: task checklist items in the Changes and Archive trees rendered
  flush with the "Tasks" artifact instead of nested under it — reported
  live twice, since the previous fix (`0.13.1`) addressed a real but
  separate bug (unstable tree-item identity) that turned out not to be
  the actual cause. `tasks.md`'s artifact entry is now its own
  collapsible node; expanding it — not the Change directly — is what
  reveals the individual checklist items. Clicking "Tasks" still opens
  the file, unchanged.

## 0.14.0

- Added "Rollback Change" on a Change item (in either the Changes or
  Archive tree): rolls back every process ever run against that Change,
  restoring every touched file to its state before the earliest of those
  runs — works identically for active and archived changes. Same fail-
  closed behavior as single-process rollback: any file changed outside
  what the system knows about refuses the entire restore.
- Added `openspec-ui.checkpointRetentionDays` setting (default `0` =
  keep forever, unchanged from prior versions). A positive value prunes
  process/checkpoint history older than that many days once, on the next
  window reload — pruning permanently removes Rollback availability for
  the pruned processes, disclosed in the setting description and in this
  README.

## 0.13.1

- Fixed: task items in the Changes and Archive trees could render flush
  with their parent Change instead of nested under it, and lose
  collapse/expand behavior — none of this codebase's `TreeItem`
  subclasses set an explicit `.id`, so VS Code fell back to a
  label-derived identity that can desync once items are recreated on
  every refresh (which they always are here). Also fixed the identical,
  not-yet-reported defect in the Templates tree's built-in/project
  groups.

## 0.13.0

- Added a "Repository Setup" node to the Changes tree, right after
  "OpenSpec Configuration": expanding it lists "Generate Agent
  Instructions", "Configure Dependabot", and "Generate Path-Scoped
  Copilot Instructions" as clickable items. These commands already
  existed (0.12.0) but were Command Palette-only with no tree presence —
  this makes them discoverable without knowing the exact command name to
  search for.

## 0.12.1

- "Delete Task" is no longer offered for a task marked done, even in an
  active (non-archived) change — matching the guard already in place for
  archived changes. A completed checklist line records that the work
  happened; the fix for a wrongly-checked task is unchecking it, not
  deleting the record.

## 0.12.0

- Added three Command Palette commands to bootstrap repository files
  from a built-in, project-type-keyed registry (seed types: Node.js/
  TypeScript, Python): "Generate Agent Instructions" (writes identical
  content into `CLAUDE.md` and `AGENTS.md`), "Configure Dependabot"
  (writes/accumulates `.github/dependabot.yml`), and "Generate
  Path-Scoped Copilot Instructions" (writes
  `.github/instructions/<subtype>.instructions.md` with `applyTo`
  frontmatter). All three leave any pre-existing, not-managed-by-us file
  untouched and report it instead of overwriting.

## 0.11.0

- The Changes and Archive trees now expand each change to also show its
  individual `tasks.md` checklist items, not just its artifacts.
  Selecting a task opens (or reveals, if already open) `tasks.md` at
  that exact line, in both trees. "Delete Task" removes a single
  checklist line from an active change's `tasks.md`, with confirmation —
  archived tasks offer no delete action.

## 0.10.1

- "Customize Template" now opens the created `template.json` after
  success, instead of only showing a notification and silently
  refreshing the tree — found via live testing: the tree refresh alone
  gave no visible feedback unless "Project" was already expanded.

## 0.10.0

- Added "Delete Project Template" to the Templates view, scoped to
  project-level templates only (with confirmation) — built-in templates
  are never deletable through the UI.
- Added three built-in templates: Flask→FastAPI migration, a
  language-agnostic flat-to-hexagonal-architecture migration, and a
  Node.js/TypeScript Vitest + ESLint testing baseline.

## 0.9.0

- The AI panel's agent picker now shows a best-effort detected/not-detected
  annotation per agent, refreshed automatically every time the panel is
  opened in the default message-bridge dashboard. This never hides or
  disables an option — it only annotates presence, not authentication.

## 0.8.0

- Added a Templates view (Built-in and Project groups) to the OpenSpec UI
  activity bar.
- Added "Customize Template" to fork a built-in template into
  `openspec/templates/<id>/` in the workspace, with a backlink to the
  built-in version it was forked from.
- Added "Insert Template Into…" to render a template's variables and
  insert the result into a picked non-archived change's proposal, design,
  and tasks files.
- Added JSON Schema validation for `openspec/templates/*/template.json`.

## 0.7.0

- Added an agent picker to the Process Dashboard's AI panel: `plan`,
  `implement`, and `review` can now run through a selectable CLI agent
  (Claude CLI, GitHub Copilot CLI, Codex CLI, Gemini CLI, or a local
  OpenAI-compatible LLM), in both the default message-bridge dashboard
  and the optional local-server mode. This is independent of, and does
  not change, the existing `@openspec` Chat Participant and "Implement
  with VS Code Agent" native Chat/Agent path.

## 0.6.0

- Added "Copy Tasks as Template Into…" to the Archive tree: copies an
  archived change's tasks (checkboxes reset to unchecked) into a picked
  non-archived change's tasks file.

## 0.5.0

- The optional local-server dashboard (`openspec-ui.transport.localServer.enabled`)
  now shows only the "Run a Command" panel — Diff Preview, Processes and
  Recovery, OpenSpec view summary, and Change Editor are already covered
  by native VS Code UI (diff editor, tree views, file editing) and are no
  longer duplicated inside the embedded Webview.

## 0.4.3

- Added actionable compatibility diagnostics when OpenSpec CLI JSON output no
  longer matches fields consumed by the workbench.

## 0.4.2

- Added actionable, fail-closed diagnostics when persisted run journals or
  checkpoints require a newer OpenSpec UI version.

## 0.4.1

- Authenticated optional local-server sessions with an ephemeral token passed
  to the embedded standalone UI through a URL fragment.

## 0.4.0

- Initialized Process Dashboard workspace and change-directory fields from the
  active VS Code workspace instead of stale browser storage.
- Updated an already-open dashboard when it is revealed with new change
  context.
- Added extension-only styling based on VS Code semantic theme variables for
  light, dark, high-contrast, and custom themes.

## 0.3.0

- Added a workspace-local, versioned run journal with atomic updates.
- Added recovery of process history and interrupted implementation checkpoints
  after extension reload.
- Added persisted rollback for deterministic lifecycle mutations, including
  failed operations.
- Serialized all workspace mutations to prevent cross-change checkpoint
  contamination while preserving concurrent read-only work.
- Added explicit checkpoint coverage for files omitted by size limits.
- Renamed the Marketplace display name to OpenSpec Workbench.

## 0.2.0

- Added hierarchical navigation for configuration, change artifacts, delta
  specs, archive, and canonical specs with actionable empty states.
- Added create, validate, archive, unarchive, and guarded delete workflows.
- Added a Processes view backed by per-change mutation scheduling.
- Added the native `@openspec` Chat participant for plan, implement, review,
  status, and validation workflows.
- Added checkpointed VS Code Agent implementation sessions with conflict-safe
  rollback.
- Replaced stale agent-CLI documentation and command names.

## 0.1.0

- Added the initial local extension with Changes, Archive, and Specs views.
- Added direct OpenSpec status, list, show, and validation commands.
- Added native markdown, Git, and diff integration.
- Added the optional local-server transport mode.
