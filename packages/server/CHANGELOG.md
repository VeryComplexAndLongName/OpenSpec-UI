# @openspec-ui/server

## 1.41.4

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

## 1.41.3

### Patch Changes

- Updated dependencies [99923cf]
  - @openspec-ui/core@0.119.0

## 1.41.2

### Patch Changes

- Updated dependencies [ffd38c0]
  - @openspec-ui/core@0.118.0

## 1.41.1

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

## 1.41.0

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

## 1.40.0

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

## 1.39.0

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

## 1.38.0

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

## 1.37.0

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

## 1.36.2

### Patch Changes

- 5eb31fa: A sprint's changes are picked from a list you can read
  
  "Changes in this sprint" was a selection list two rows high over every
  change in the workspace. It is now a scrolling checklist, with changes
  under way first and archived ones newest first. It has a search box, and
  one button ticks every change archived in the report's range together
  with those still under way. All, None and a count of what is chosen come
  with it.

## 1.36.1

### Patch Changes

- c3f4a84: The sweep no longer leaves half-removed working directories
  
  When git could not delete part of a finished working directory, for
  example a path too long for it on Windows, the sweep said so and left the
  rest behind, where nothing looked at it again. It now removes what git
  left and has git forget the worktree. The pass that archives landed
  changes also refuses to push a branch that archives nothing.
- Updated dependencies [c3f4a84]
  - @openspec-ui/core@0.112.1

## 1.36.0

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

## 1.35.5

### Patch Changes

- Updated dependencies [a0102c6]
  - @openspec-ui/core@0.111.1

## 1.35.4

### Patch Changes

- Updated dependencies [628069d]
  - @openspec-ui/core@0.111.0

## 1.35.3

### Patch Changes

- ef790ed: Everything now says OpenSpec Workbench
  
  The Command Palette, notifications, panel titles, the standalone's
  headline, the server's startup line and the settings schemas said
  "OpenSpec UI", the product's old name. They now say "OpenSpec Workbench".
  Command ids, settings, keybindings and stored state keep their names, so
  nothing needs to be set up again.
- Updated dependencies [ef790ed]
  - @openspec-ui/core@0.110.3

## 1.35.2

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

## 1.35.1

### Patch Changes

- Updated dependencies [9815e34]
  - @openspec-ui/core@0.110.1

## 1.35.0

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

## 1.34.3

### Patch Changes

- Updated dependencies [fee5511]
  - @openspec-ui/core@0.109.0

## 1.34.2

### Patch Changes

- Updated dependencies [99015a0]
  - @openspec-ui/core@0.108.0

## 1.34.1

### Patch Changes

- Updated dependencies [c4550cc]
  - @openspec-ui/core@0.107.0

## 1.34.0

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

## 1.33.3

### Patch Changes

- Updated dependencies [a65ce77]
  - @openspec-ui/core@0.105.0

## 1.33.2

### Patch Changes

- Updated dependencies [209578a]
  - @openspec-ui/core@0.104.0

## 1.33.1

### Patch Changes

- Updated dependencies [478ae8f]
  - @openspec-ui/core@0.103.0

## 1.33.0

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

## 1.32.2

### Patch Changes

- Updated dependencies [a0520c9]
  - @openspec-ui/core@0.101.1

## 1.32.1

### Patch Changes

- Updated dependencies [dac06ce]
  - @openspec-ui/core@0.101.0

## 1.32.0

### Minor Changes

- 84bbb26: Review in Processes answers where it was pressed: a run's details, its
  changed files and its rollback control open under that run's own row
  instead of in a panel at the foot of the tab, which with a hundred rows
  put the answer five screens below the button. A second press folds it,
  opening another run closes the first, and the list can be narrowed by a
  word.

## 1.31.0

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

## 1.30.1

### Patch Changes

- Updated dependencies [48bf1a1]
  - @openspec-ui/core@0.99.0

## 1.30.0

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

## 1.29.3

### Patch Changes

- Updated dependencies [b361b2d]
  - @openspec-ui/core@0.97.0

## 1.29.2

### Patch Changes

- Updated dependencies [b8fdb6f]
  - @openspec-ui/core@0.96.0

## 1.29.1

### Patch Changes

- Updated dependencies [26a3e14]
  - @openspec-ui/core@0.95.0

## 1.29.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [86b4c79]
  - @openspec-ui/core@0.94.0

## 1.28.5

### Patch Changes

- Updated dependencies [5c2dd79]
  - @openspec-ui/core@0.93.0

## 1.28.4

### Patch Changes

- Updated dependencies [87d2236]
  - @openspec-ui/core@0.92.1

## 1.28.3

### Patch Changes

- Updated dependencies [65847f0]
  - @openspec-ui/core@0.92.0

## 1.28.2

### Patch Changes

- Updated dependencies [b8871aa]
  - @openspec-ui/core@0.91.2

## 1.28.1

### Patch Changes

- Updated dependencies [6cb2d6c]
  - @openspec-ui/core@0.91.1

## 1.28.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [ce7bbd3]
  - @openspec-ui/core@0.91.0

## 1.27.1

### Patch Changes

- 69e1644: The OpenSpec view summary opens in a few seconds instead of minutes. For
  every archived change it used to read the whole workspace again, all at once:
  on a repository with 250 archived changes that step took 157 seconds, held
  several cores and could run out of file handles. It now summarises every
  archived change from the one reading the request already made, in about
  100 ms there, with the same counts.
- Updated dependencies [69e1644]
  - @openspec-ui/core@0.90.1

## 1.27.0

### Minor Changes

- 48c7c74: The standalone shell says what it is doing. Diff Preview shows the real diff
  of a change you choose, from a new token-gated `POST /api/change-diff`,
  instead of the two-line sample it has always shown; a change with nothing
  uncommitted says so, and a workspace that is not a repository says that. A
  tab that reads when it opens now shows one status line naming what it is
  reading, so a slow screen no longer looks like a broken one. The theme
  control is a switch: its visible name stays "Dark theme", and its state is
  carried by the switch's role and an icon.

## 1.26.5

### Patch Changes

- Updated dependencies [2369d23]
  - @openspec-ui/core@0.90.0

## 1.26.4

### Patch Changes

- Updated dependencies [dbcbeb9]
  - @openspec-ui/core@0.89.1

## 1.26.3

### Patch Changes

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
- Updated dependencies [290e09d]
  - @openspec-ui/core@0.89.0

## 1.26.2

### Patch Changes

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

## 1.26.1

### Patch Changes

- cc67d90: The owl marks the app. It stands at the left of the standalone shell's headline and of the editor's AI panel, and it is the standalone page's browser-tab icon. In VS Code it is the extension's icon, and a monochrome owl is its Activity Bar icon.

## 1.26.0

### Minor Changes

- 352b8a6: A run in another worktree can be asked to stop, through ADR 0028's signed channel.
  
  - A request to stop is a file of its own in `.agent-messages`, beside the status and roster directories and inside no working directory. `askRunToStop` seals it with the asker's machine key. `readStopRequests` opens each envelope before parsing it, and gives a run each request addressed to it either to act on or refused as unverified, stale or already read. A request that does not check out is attributed to no run; `openspec-ui-cli status` reports it by file name.
  - A run reads its requests at each renewal of its status record. A verified, fresh and new request stops it where its work is sound, as a card's Stop would: the host's `onStopRequested` calls `requestStop` with the enrolled person as `by`, and a chain's ending entry carries the request's `messageId`. A refused request is said once in the run's activity and recorded as an audit message. The server's socket runs, the delegated item run, the CLI's run and the extension's runs all read requests, and the sweep removes request files long past their window.
  - `openspec-ui-cli stop <instanceId> --reason <text>` asks a live run to stop and prints the message id.
  - A Pipeline card offers Stop on a run held elsewhere only when its verified record is signed by the person this host's key is enrolled as. It then says it is waiting for the run to read the request, and later that the run has not. Any other run held elsewhere states whose it is, or that it is not verified. The standalone server answers `POST /api/runs/ask-to-stop`, and the editor's Pipeline panel `openspec-ui/ask-to-stop`; both ask only a run they read as live.

### Patch Changes

- Updated dependencies [fd742f7]
- Updated dependencies [3c79199]
- Updated dependencies [352b8a6]
  - @openspec-ui/core@0.88.0

## 1.25.0

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

## 1.24.0

### Minor Changes

- 107524d: A Pipeline card says what its change is doing. Core derives one card per change from readings the hosts already take (`describeChangeCards`, `describeChangeCard`), with facts from the change's own worktree where it has one. Each card gives:
  
  - its state: waiting, running, failed or stopped at a stage, blocked, done or ready;
  - the task a live run is on, in the agent's own words, the task it was given, or a marked guess;
  - what the run is doing or waiting on, and how long ago it said so;
  - how many tasks are done, and how many only a person can close or are delegated;
  - how the last run ended, what it cost where that was reported, and why a stopped run stopped.
  
  Its word is `describeChangeState`'s, read against the same standings as the Changes list, so the two never disagree. Runs a card shows are no longer repeated in the run lines above the picture.
  
  A chain now writes one audit entry as it ends, saying how, at which stage and why, and every counter of runs skips it. `readLastRuns` reads each change's last ended run from every worktree's audit log, and parses a log again only when it changes. The server answers `/api/change-last-runs`, and the editor's Pipeline panel answers `pipeline/last-runs` and `pipeline/standings`.
- 604e575: A run is signed by its person. Each person gets an Ed25519 key per machine, made on first need under `~/.openspec-ui/identity`. A run seals its status record's exact bytes with that key, and a reader verifies them before it parses anything. Every record reads as one of three states: verified (signed by an enrolled person), unverified, or does not check out. A record that does not check out shows nothing from its contents, and the sweep keeps it.
  
  A key that signs a live run and is not enrolled waits in the Human-Only Inbox of both hosts with "It was me". It is also listed by `openspec-ui-cli enrol`. `status` and the Pipeline's run lines say whose a run is, as far as its signature shows.

### Patch Changes

- f25c29a: A change says where it stands. Core reads each change across this checkout, every working directory, `main`, the change's own branch and, where `gh` can read it, its pull request (`readChangeStandings`). It also says how fresh each of those sources is. `describeChangeState` gives the one word every surface shows: Running, Waiting, Archived on main, Merged in #N, Deleted on main, Further along, Failed or Stopped at a stage, Done, Blocked, or Ready. The lines beneath the word name their sources, and a colour agrees with the word.
  
  Where the word shows:
  
  - The VS Code Changes tree and the standalone Changes list show it, and `openspec-ui-cli ready` prints it.
  - The run dialog in both hosts leads with it, and asks before starting a change that is running, settled on `main` or merged.
  - The Changes list and the Pipeline gain a Refresh that fetches refs now.
  
  A delegated run now records its request and its reply in the audit log, and the waiting-on inbox shows the latest reply beneath its item. The delegated prompt asks the agent to answer within its turn.
- Updated dependencies [107524d]
- Updated dependencies [f25c29a]
- Updated dependencies [604e575]
  - @openspec-ui/core@0.86.0

## 1.23.7

### Patch Changes

- Updated dependencies [65ea319]
  - @openspec-ui/core@0.85.0

## 1.23.6

### Patch Changes

- Updated dependencies [a36e5a1]
  - @openspec-ui/core@0.84.0

## 1.23.5

### Patch Changes

- d6e5368: The Pipeline opens in VS Code.
  
  **OpenSpec UI: Open Pipeline**, also in the Changes view's title bar, opens the same Pipeline picture the standalone shell draws, in a panel of its own: this directory's changes, what can start alongside what, and every other working directory with what its runs say. Choosing a change's card reveals it in the Changes tree and opens its `proposal.md`.
  
  The panel does not poll. While it is visible, the editor watches `openspec/changes` and the directory the runs' status records are written to, and tells the picture which reading is out of date; events within a second become one message, and a reading every minute covers what raises no file event. A status record changing re-reads the records alone, without running git. The ages a run's line states keep counting between readings.
  
  - Core gains `readPipelineReadiness`, the readiness report with its suggestions, which the standalone server's route now calls instead of assembling the payload itself; `refreshSurveyRuns` and `attachRunsToDirectories`, which lay freshly read status records over a survey; and `activityAt`/`heartbeatAt` on a status report and a surveyed run. `describeRun` and `describeDirectoryRuns` take an optional clock.
  - `PipelineView` takes an optional `subscribe`: a host that knows when a reading is out of date says so, and the view reads on its word and on a one-minute backstop. Without it the view polls as before.
- Updated dependencies [d6e5368]
  - @openspec-ui/core@0.83.0

## 1.23.4

### Patch Changes

- b7b98df: A change is configured from the change.
  
  "Configure Harness for this Change" opened a view that showed the global settings first, a change name field under the global save button, and nothing else: the panel learned the change's name after the view had mounted, and the view read its name only once. Global settings and a change's own settings are now two views, each about one file, and each opened where it belongs.
  
  - The global view has no change name field and nothing about any one change. Beside its autonomy level it says that `autonomous` is set for a single change.
  - A change's view reads the change's name as it is given, loads that change's `harness.json` with nothing typed, and names on each inherit option the value it resolves to and where from. In the standalone app it is the Change Editor's new **Harness** tab; in VS Code, "Configure Harness for this Change" opens a panel of its own per change, titled `Harness: <change>`, and "Configure Harness Settings" opens one for the global file. The AI panel no longer mounts a settings view.
  - In both views the save is disabled until a field differs from what was loaded, and "Unsaved changes" says so while one does. The named configuration block and the fields are separate sections, drawn apart.
  - Named configurations are chosen from one list, in both views and in the run dialog: a select, the chosen configuration's description beneath it, and **Apply**. What applying did is said beside the button; in VS Code the run dialog no longer raises a notification for it.
  - A recommendation drawn from past runs can be applied: the run dialog offers "Use `<agent>` for every stage". Core gains `agentForEveryStageToWrite`, which sets every stage to the agent and drops an effort, budget unit or custom agent the new agent does not accept.
- Updated dependencies [b7b98df]
  - @openspec-ui/core@0.82.0

## 1.23.3

### Patch Changes

- Updated dependencies [4128158]
- Updated dependencies [43a3b82]
  - @openspec-ui/core@0.81.0

## 1.23.2

### Patch Changes

- 1241027: A stale status is swept.
  
  A run that crashed left its status record behind for good, and a write that died between writing and renaming left its temporary file; the reader walked every one of them on every poll. Core gains `sweepAgentStatuses`, separate from `readAgentStatuses`, which stays a pure reading: it removes a record whose heartbeat is past the staleness window only if it is still past it when read again immediately before removal, removes a record's temporary file once it is older than the same window, never removes a malformed record, and treats a file already gone or momentarily in use as nothing to do. It reports what it removed. The sweep runs where the directory is already being looked at — a status writer as it starts, `openspec-ui-cli status` before it reads (removals are said on stderr), and the Pipeline tab's survey — with no timer of its own. A status record's fields are pinned by a test, so it cannot quietly start keeping history that a sweep would then throw away.
- Updated dependencies [1241027]
  - @openspec-ui/core@0.80.0

## 1.23.1

### Patch Changes

- Updated dependencies [8a71bd3]
  - @openspec-ui/core@0.79.1

## 1.23.0

### Minor Changes

- 4c9f332: The Pipeline tab shows every working directory of the repository, not only the one it was pointed at.
  
  Two agents working at once, one in the primary checkout and one in a working directory beside it, used to leave the tab showing only its own queue — and a checkout sitting on a merged branch reported "no active changes" with nothing on screen naming the branch it had read. The tab now names the branch its reading came from, says what this directory's runs report doing, and shows every other working directory beneath in a recessed section of its own: its label, branch and path, its changes with their task counts laid out against its own queue, who holds it and whether that is a different git author, and what its runs say they are doing and how long ago. A directory where no run reports is said to be one, never called idle. A change present in two directories is called out on both. Other directories' changes carry no action and no line is drawn between directories. Core gains `surveyWorktrees`, which runs one `git worktree list` and reads everything else from the filesystem; the server carries it at `/api/worktree-survey`.

### Patch Changes

- Updated dependencies [4c9f332]
  - @openspec-ui/core@0.79.0

## 1.22.4

### Patch Changes

- Updated dependencies [82d5021]
  - @openspec-ui/core@0.78.0

## 1.22.3

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
- Updated dependencies [b69f3c6]
- Updated dependencies [e0edfbe]
  - @openspec-ui/core@0.77.0

## 1.22.2

### Patch Changes

- Updated dependencies [7fc5535]
  - @openspec-ui/core@0.76.1

## 1.22.1

### Patch Changes

- Updated dependencies [15363ee]
  - @openspec-ui/core@0.76.0

## 1.22.0

### Minor Changes

- 4940254: The readiness report's facts are now offered as suggestions: which ready
  changes can be started alongside each other, which is ready with nowhere
  to run, and which workspace is held by a run that stopped reporting
  itself. Each carries the fact it came from and the exact commands, shown
  in the Pipeline tab and printed by `openspec-ui-cli advise`. They create
  nothing and start nothing, they name every maximal set rather than
  choosing one, and `hints.enabled: false` means they are not computed at
  all.

### Patch Changes

- ee31b4d: Seven standalone documentation pictures are now captured from the running
  application by `e2e/documentation-screenshots.spec.ts` instead of being
  taken by hand, and a repository check refuses any documentation picture
  that neither a capture writes nor a dated list accounts for.
- Updated dependencies [f6b9389]
- Updated dependencies [4940254]
  - @openspec-ui/core@0.75.0

## 1.21.0

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

### Patch Changes

- Updated dependencies [e411f9a]
  - @openspec-ui/core@0.74.0

## 1.20.7

### Patch Changes

- Updated dependencies [394d426]
  - @openspec-ui/core@0.73.0

## 1.20.6

### Patch Changes

- Updated dependencies [e02c596]
  - @openspec-ui/core@0.72.0

## 1.20.5

### Patch Changes

- Updated dependencies [8f574fe]
  - @openspec-ui/core@0.71.0

## 1.20.4

### Patch Changes

- Updated dependencies [4385179]
  - @openspec-ui/core@0.70.0

## 1.20.3

### Patch Changes

- Updated dependencies [261a2df]
  - @openspec-ui/core@0.69.0

## 1.20.2

### Patch Changes

- Updated dependencies [296802b]
  - @openspec-ui/core@0.68.0

## 1.20.1

### Patch Changes

- Updated dependencies [300b79d]
  - @openspec-ui/core@0.67.0

## 1.20.0

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

## 1.19.1

### Patch Changes

- Updated dependencies [e0a0e99]
  - @openspec-ui/core@0.65.0

## 1.19.0

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
- Updated dependencies [3f435c7]
- Updated dependencies [1806701]
  - @openspec-ui/core@0.64.0

## 1.18.0

### Minor Changes

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

### Patch Changes

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
- Updated dependencies [be28986]
- Updated dependencies [9dd0767]
- Updated dependencies [1b67bee]
- Updated dependencies [c679bd4]
- Updated dependencies [ad1a8ae]
  - @openspec-ui/core@0.63.0

## 1.17.0

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

## 1.16.0

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

## 1.15.1

### Patch Changes

- Updated dependencies [6abc8fa]
  - @openspec-ui/core@0.60.1

## 1.15.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [db5e02c]
- Updated dependencies [f4beaaf]
- Updated dependencies [8987e8b]
- Updated dependencies [09a49fd]
  - @openspec-ui/core@0.60.0

## 1.14.0

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

- Updated dependencies [8f2ed11]
- Updated dependencies [cba553e]
- Updated dependencies [d1e15ca]
  - @openspec-ui/core@0.59.0

## 1.13.27

### Patch Changes

- Updated dependencies [94a295e]
- Updated dependencies [9f323c1]
  - @openspec-ui/core@0.58.0

## 1.13.26

### Patch Changes

- Updated dependencies [9836f84]
- Updated dependencies [dea1dc4]
  - @openspec-ui/core@0.57.0

## 1.13.25

### Patch Changes

- Updated dependencies [4115954]
  - @openspec-ui/core@0.56.0

## 1.13.24

### Patch Changes

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

## 1.13.23

### Patch Changes

- Updated dependencies [5b61c75]
  - @openspec-ui/core@0.54.0

## 1.13.22

### Patch Changes

- 53a9f7d: Fix a chain run hanging forever when its agent asks for permission: `HarnessChainRunner` now routes a `"resolvePermission"` command to the runner executing the stage in flight (mirroring how `"cancel"` is already routed), instead of rejecting it as a non-`"chain"` command. Both hosts (`packages/server`'s WebSocket dispatcher and the VS Code extension's webview message handler) gain the matching routing branch, and `HarnessChainPanel` gains the Allow/Deny control needed to answer. A permission request raised under `autonomyLevel: "autonomous"` — where there is no confirmation channel — now fails the stage with a stated reason and ends the underlying process, instead of waiting on a promise nothing can resolve.
- Updated dependencies [53a9f7d]
  - @openspec-ui/core@0.53.0

## 1.13.21

### Patch Changes

- Updated dependencies [12b730b]
  - @openspec-ui/core@0.52.0

## 1.13.20

### Patch Changes

- Updated dependencies [e78face]
- Updated dependencies [bfad445]
  - @openspec-ui/core@0.51.0

## 1.13.19

### Patch Changes

- Updated dependencies [af32105]
- Updated dependencies [a61bfbe]
- Updated dependencies [ae78a82]
  - @openspec-ui/core@0.50.0

## 1.13.18

### Patch Changes

- Updated dependencies [2ec29df]
  - @openspec-ui/core@0.49.0

## 1.13.17

### Patch Changes

- Updated dependencies [4e59bdf]
- Updated dependencies [4e59bdf]
  - @openspec-ui/core@0.48.0

## 1.13.16

### Patch Changes

- Updated dependencies [eca84bc]
- Updated dependencies [d161b50]
  - @openspec-ui/core@0.47.0

## 1.13.15

### Patch Changes

- Updated dependencies [348ee61]
- Updated dependencies [348ee61]
  - @openspec-ui/core@0.46.0

## 1.13.14

### Patch Changes

- Updated dependencies [5271dfe]
  - @openspec-ui/core@0.45.0

## 1.13.13

### Patch Changes

- Updated dependencies [366bb77]
  - @openspec-ui/core@0.44.0

## 1.13.12

### Patch Changes

- Updated dependencies [8a69ea0]
  - @openspec-ui/core@0.43.0

## 1.13.11

### Patch Changes

- Updated dependencies [5cddc4d]
  - @openspec-ui/core@0.42.0

## 1.13.10

### Patch Changes

- Updated dependencies [144e13b]
  - @openspec-ui/core@0.41.0

## 1.13.9

### Patch Changes

- ed9e4c9: Audit records now survive a host restart. `FileAuditLog` (packages/core/src/security.ts) gains a bounded, rotating JSONL file (oldest entries dropped first, never the whole file) and a `readEntries()` to read them back. Both `packages/server` (`cli.ts`, and `optional-server.ts` on the extension side) and `packages/extension`'s direct-import mode (`extension.ts`) now construct a `FileAuditLog` under the workspace's `.openspec-ui/audit.jsonl` and share it between the runners it audits and `HarnessChainRunner`'s `listAuditEntries`, so a configured spending ceiling sums a change's persisted history across restarts rather than resetting on every editor close. `core` also exports `auditLogPath(workspaceRoot)`, the one place this file's location is decided. No change to what is recorded, to `buildUsageReport`, or to the budget's comparison logic — only to whether the records outlive the process that wrote them.
- Updated dependencies [ed9e4c9]
  - @openspec-ui/core@0.40.0

## 1.13.8

### Patch Changes

- Updated dependencies [80a097b]
  - @openspec-ui/core@0.39.0

## 1.13.7

### Patch Changes

- Updated dependencies [d0be00e]
  - @openspec-ui/core@0.38.0

## 1.13.6

### Patch Changes

- Updated dependencies [8f60b09]
  - @openspec-ui/core@0.37.0

## 1.13.5

### Patch Changes

- Updated dependencies [dc71cec]
  - @openspec-ui/core@0.36.0

## 1.13.4

### Patch Changes

- Updated dependencies [6ed2d1a]
  - @openspec-ui/core@0.35.0

## 1.13.3

### Patch Changes

- Updated dependencies [d15f4cb]
  - @openspec-ui/core@0.34.1

## 1.13.2

### Patch Changes

- Updated dependencies [6b13d58]
- Updated dependencies [d9084ab]
- Updated dependencies [db0e717]
- Updated dependencies [6b13d58]
  - @openspec-ui/core@0.34.0

## 1.13.1

### Patch Changes

- Updated dependencies [5ce55ae]
  - @openspec-ui/core@0.33.2

## 1.13.0

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

## 1.12.0

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

### Patch Changes

- Updated dependencies [3a93782]
- Updated dependencies [da70d78]
  - @openspec-ui/core@0.31.0

## 1.11.0

### Minor Changes

- Add a cross-host workspace lease (docs/adr/0010-cross-host-workspace-lease.md) so at most one host process — a VS Code extension or a standalone server, pointed at the same workspace — can run a mutating operation at a time. A blocked host gets an immediate, actionable error naming the other host instead of racing it or queuing forever. The standalone server's own `implement` execution is now routed through the same mutation lock and lease (it previously bypassed the scheduler entirely), closing a pre-existing same-host gap alongside the cross-host one.

### Patch Changes

- Updated dependencies
  - @openspec-ui/core@0.30.0

## 1.10.0

### Minor Changes

- Add a downloadable sprint summary PDF report: for a user-picked date
  range and set of changes, who authored each one (from git), what it
  was, task completion, plus aggregate statistics (total changes, tasks
  completed in range, a per-author breakdown). New "Sprint report" mode
  in the standalone Timeline tab.

### Patch Changes

- Updated dependencies
  - @openspec-ui/core@0.29.0

## 1.9.0

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
