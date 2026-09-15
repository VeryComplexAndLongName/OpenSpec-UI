The documentation shows what 0.44 to 0.55 added, with pictures taken by
specs, and an article and teaser on the same releases.

## 1. Pictures

- [x] 1.1 `packages/server/e2e/pipeline.spec.ts`, in "starts a chain from its
  card, answers it there, and asks it to stop": once the card states the
  request, capture `standalone/pipeline-stop.png`. The card and its reason
  must be in the picture.

  Found on the first capture, 2026-09-14:
  - **The identity.** The card read "asked to stop by" and the machine's
    own git identity. A stop names who asked by the run directory's git
    identity, and the fixture repository had none of its own. The fixture
    now sets `user.email` to `fixture@example.com`, and the test asserts
    that is what the card says.
  - **The reason.** It did not fit. A card draws each detail on one line
    and cuts it at the card's width, so the reason stayed only in the DOM
    and the card's title. The reason is therefore pictured where it is
    given: `standalone/pipeline-stop-ask.png`, the "Ask to stop" form with
    the reason typed, taken before it is sent. `pipeline-stop.png` shows the
    whole Pipeline section with the card stating the request.
  - **A path inside the card.** The account guard of 1.5 then failed on the
    stop picture. The run's card carries `in C:\Users\<account>\AppData\
    Local\Temp\openspec-ui-pipeline-run-…` among its details. It sat beyond
    the card's "+2", so it was not drawn, but it was in the page, and
    opening or widening the card draws it. Card details naming a known
    fixture path are now masked. The guard drops those lines by the path
    they name, never by whether they hold the account name.

  Done on 2026-09-14: `npx playwright test e2e/pipeline.spec.ts` passed 4 of
  4.
  - **`pipeline-stop-ask.png`.** The form "Why should pipeline-run stop?"
    with "wrong branch" typed, and Ask to stop and Cancel.
  - **`pipeline-stop.png`.** The Pipeline section read from branch main,
    with the card `pipeline-run` RUNNING, "asked to stop by
    fixture@example.com: …" and Stop now.
  - Neither picture carries a path or the account name.
- [x] 1.2 `packages/extension/e2e/editor-screenshots.spec.ts`: capture
  `extension/pipeline-panel.png` from "OpenSpec UI: Open Pipeline". Wait for
  the fixture's cards, not for the panel's title.

  Done on 2026-09-14. The suite passed 13 of 13.
  - **The picture.** The panel "OpenSpec UI: Pipeline" in the editor's dark
    theme, read from branch main in `openspec-workbench`. It shows two cards,
    `a-change-in-progress` (READY, 2 of 4 tasks done) and
    `a-change-not-started` (READY, 0 of 1), each with Start and Show tasks,
    and "Worth doing" with the `worktree add` command for each. No path or
    account name is on it.
  - **How the suite ran.** From VS Code 1.137.0, through a junction from
    this worktree's `.vscode-test` to the primary checkout's
    `packages/extension/.vscode-test`, since `findEditor` reads the
    repository root.
  - **The environment.** It ran from Bash with `env -u` on every
    `ELECTRON_*` and `VSCODE_*` variable this session inherits. Clearing
    them from PowerShell left `Code.exe` refusing every flag
    ("bad option"), three times.
- [x] 1.3 The same spec: capture `extension/changes-standings.png`, the
  Changes tree with each change's state word visible beside its name.
  Assert each word before the shutter.

  The tree shows a word only where it can read standings, and
  `changes-tree.ts` lists a change without one when it cannot. The picture
  fixture is not a git repository today, so it becomes one, committed once,
  with no remote. Check that the existing nine pictures still show what
  their captions say.

  Done on 2026-09-14. The fixture commits once through `gitIsolationArgs`,
  and the suite passed 13 of 13 twice.
  - **The first capture** cut the first row's word to "in-progress — Re…".
    The side bar's default width did not hold it, and the row's text was
    whole, so no text assertion could see the cut.
  - **The capture now** widens the side bar to 560 pixels by its sash, and
    asserts each row's label fits before the shutter.
  - **The picture** shows `a-change-in-progress` "in-progress — Ready" and
    `a-change-not-started` "draft — Ready", whole, beside Repository Setup
    and Harness Settings. No path or account name is on it.
- [x] 1.5 `standalone/pipeline.png` publishes the account name, and has since
  it was first captured. Its "Other working directories" lines show each
  directory's full temporary path, `C:/Users/<account>/AppData/…`, in the
  copy on `main` too. The capture now masks every
  `pipeline-directory-N-where` line. Before each Pipeline picture, it
  asserts that no unmasked text in the section carries the account name.

  Done in the same run as 1.1. In the new `pipeline.png` the "branch — path"
  lines of `pipeline-unrelated` and `proposals` are grey bars, and the guard
  passed. The rest of the picture is as before: the headline now has the
  owl, and the version line reads core 0.88.0, server 1.26.0 and
  webui 1.47.0.
- [x] 1.4 Run both capture suites.

  **So far.** The editor suite rewrote all eleven existing editor pictures.
  Two were looked at: `overview-expanded.png` and `nested-tasks.png`.
  - What changed on them is the Activity Bar, which now shows the owl icon
    `the-owl-marks-the-app` shipped. Now that the fixture is a git
    repository, the status bar also reads `main*` and Source Control
    carries a count.
  - They are kept rather than restored: the product's look changed, and
    these pictures are of the product.

  Done on 2026-09-14.
  - **The editor suite** passed 13 of 13 on its last run.
  - **The standalone Pipeline spec** passed 4 of 4.
  - **What is committed:**
    - the three new standalone pictures, and `pipeline.png` with its paths
      masked;
    - the two new editor pictures, and all eleven existing editor pictures
      retaken with the owl.

    No picture was restored.
  - **`lint:screenshots`** reports 28 pictures, all 28 captured, none
    listed as hand-taken. Look at every new picture beside its
  caption, and record what each shows. Restore any existing picture the
  run rewrote that this change does not mean to update.

## 2. Documents

- [x] 2.1 `README.md`, "CI CLI (merge gate)": list every command
  `openspec-ui-cli --help` prints, each with one line. Give `status`,
  `stop` and `enrol` a paragraph each, with their exit codes.
- [x] 2.2 `README.md`, "Status": link the new article.
- [x] 2.3 `packages/server/README.md`: a Pipeline section, with
  `pipeline.png` and `pipeline-stop.png` and what each shows.
- [x] 2.4 `packages/extension/README.md`: the Pipeline panel, the state
  word in the Changes tree, and asking a run to stop, each with its picture.
- [x] 2.5 `docs/how-to/stop-a-run.md`: a run held here (Stop and Stop now),
  a run held elsewhere (signed, the same person), and
  `openspec-ui-cli stop`. Link it from `docs/how-to/`'s neighbours where
  they mention a run.
- [x] 2.6 Check every claim in 2.1–2.5 against the code or a run, and
  record where each was checked.

  **Written so far, 2026-09-14.** Each claim is checked against:
  - **README's command table and the `status`, `stop` and `enrol`
    paragraphs:** the `USAGE` text in `packages/cli/src/main.ts`, which is
    what `--help` prints, and the return codes in `stop-command.ts`,
    `status-command.ts` and `enrol-command.ts`. The CLI has thirteen
    commands in seventeen forms. "It has one command, `validate`" is gone.
  - **The state words** in both READMEs: `describeChangeState` in
    `packages/core/src/change-state-word.ts`. There is no bare "Waiting":
    it is "Waiting for you" where this host holds the run, and
    "Waiting in <checkout>" otherwise. The extension README had that wrong
    in its first draft and was corrected.
  - **Hovering a change shows where each part was read from:** the tooltip
    in `packages/extension/src/tree/changes-tree.ts`, which is the word
    plus each line with its source.
  - **"Open Pipeline" in the Changes view's title bar, Start, Continue,
    Allow, Deny, Stop, Stop now, and Stop elsewhere only for the same
    enrolled person:** the 0.52.0, 0.54.0 and 0.55.0 entries in
    `packages/extension/CHANGELOG.md`, and `pipeline.spec.ts`, which drives
    Start, Continue and Stop on a card.
  - **A stop's sound points:** `stop-boundary.ts`, as described in the
    0.54.0 entry: a checkpoint at once, a permission by denying it, and
    inside a stage at the next task marker naming another task or the next
    ticked task.
  - **Every 5 seconds and 60 seconds:** `AGENT_STATUS_RENEW_INTERVAL_MS`,
    which is `WORKSPACE_LEASE_RENEW_INTERVAL_MS` = 5000 in
    `workspace-lease.ts`, and `STOP_MESSAGE_STALE_AFTER_MS` = 60000 in
    `agent-messages.ts`. The refusals `unverified`, `stale` and `seen` are
    the `StopRequestRefusal` type there.
  - **The worktree root in `run-changes-side-by-side.md`:** the `--path`
    help in `main.ts`, `<root>/<repo>/<change>` with the root from
    `OPENSPEC_UI_WORKTREE_ROOT`, then `~/.openspec-ui/settings.json`, then
    `<repo's parent>/.worktrees`. The page's old example,
    `../my-repo.worktrees/my-change`, predated that and was corrected.

## 3. The article and teaser

- [x] 3.1 `docs/articles/2026-09-14-what-you-can-see-and-stop-0-44-to-0-56.md`:
  a LinkedIn Article on `openspec-ui-vscode` 0.44.0 → 0.56.0, with 0.44–0.50
  in full, since it was never published. Each section names the archived
  change it comes from. Under 125,000 characters; record the count.

  The range ends at 0.56.0, not 0.55.0 as first planned. The owner asked
  for the changes "up to the latest version", and 0.56.0 was released on
  2026-09-14 while this change was being written.

  Done: 20,730 characters, 3,313 words.
  - **Sections.** Four parts (running more than one, seeing, whose run it
    is, acting on it), a section for 0.56, and where the settings live.
    Every section names its archived changes, and every name was checked
    against `openspec/changes/archive/`.
  - **`a-working-directory-is-disposable`** was checked against its
    proposal, which is where the one worktree root and the audit merge
    before removal come from.
  - **The versions line** matches `package.json` on `main` at 7c9644c: core
    0.88.0, server 1.26.1, webui 1.48.0, cli 0.14.0 and `openspec-ui-vscode`
    0.56.0.
  - **The facts of 0.50–0.56** come from those releases' entries in
    `packages/extension/CHANGELOG.md` and `packages/core/CHANGELOG.md`, and
    from the code facts recorded under 2.6.
  - **The 0.44–0.50 part** is rewritten from the unpublished article of
    2026-09-12, which cites the same changes.
- [x] 3.2 The teaser, `docs/articles/2026-09-14-teaser-0-56.md`, under 3,000
  characters; record the count.

  Done: 1,631 characters, 285 words. It covers the same three steps and
  includes `pipeline.png`. It links to the project site, as the 0.50
  teaser did, and the owner points it at the article once that is
  published.
- [x] 3.3 A 1920 × 1080 cover beside the article, showing no screen of the
  product. Record how it was made.

  Done: `docs/articles/2026-09-14-what-you-can-see-and-stop-0-44-to-0-56-cover.png`,
  1920 × 1080, 1,155,006 bytes.
  - **How it was made.** An HTML page was rendered by Playwright's Chromium
    with a 1920 × 1080 viewport at scale 1, clipped to that size. The page
    holds the owl logo, cut of its light rim as in `the-owl-marks-the-app`
    1.1, on a dark navy gradient.
  - **What it shows.** Beside the owl: "OpenSpec Workbench", the title
    "What you can see, and stop", "Twelve releases, 0.44 → 0.56", three
    outlined chips with the product's words "Running", "Waiting for you"
    and "Asked to stop: wrong branch", and `openspec-ui.dev`.
  - **No screen of the product** is on it, and it was looked at before it
    was staged. The rendering script is not committed: the cover is made
    once per article.
- [x] 3.4 Every picture the article and the teaser include is under
  `docs/images/`, and `lint:screenshots` names its capture.

  Done. Each image link was resolved against the file tree, and each
  exists.
  - **The article's five product pictures:** `standalone/pipeline.png`,
    `extension/pipeline-panel.png`, `extension/changes-standings.png`,
    `standalone/pipeline-stop-ask.png` and `standalone/pipeline-stop.png`.
  - **The teaser's one:** `standalone/pipeline.png`.
  - **The checks.** `lint:screenshots` reports all 28 pictures under
    `docs/images/` as captured. The cover is the only image outside it, as
    the requirement allows.

## 4. Checks

- [x] 4.1 `openspec validate the-docs-catch-up-to-0-55 --strict`,
  `lint:english` after `git add`, and `lint:screenshots` pass.

  Done on 2026-09-14, on the final stage. Every file of the change was
  staged, nothing was untracked, and neither `.vscode-test` nor
  `node_modules` was staged. All of these passed:
  - `openspec validate --strict`;
  - `lint:english`;
  - `lint:screenshots` (28 pictures, 28 captured, none listed as
    hand-taken);
  - `lint:source-text`, `lint:changesets` and `lint:openspec-config`.
- [x] 4.2 The whole standalone browser suite and the editor picture suite
  pass.

  Done on 2026-09-14.
  - **The standalone browser suite.** `npm run test:browser -w
    @openspec-ui/server`, from this worktree, passed 20 of 20 in 4.2
    minutes, 17:14 to 17:18. Two earlier runs were cut off when VS Code
    restarted, since they ran under this session's extension host. They are
    not counted.
  - **The editor picture suite** passed 13 of 13, as recorded under 1.4.
  - **What the suite rewrote.** The standalone pictures `diff-preview`,
    `harness-checkpoint`, `harness-settings`, `processes`, `view-summary`,
    `pipeline` and `pipeline-stop` were all rewritten, and all are kept.
    `processes.png` and `harness-settings.png` were looked at: the owl is
    in the headline where a picture has one, and neither shows a path or
    the account name. The others are masked by their specs as before.
- [x] 4.3 `npm run verify` passes, run unpiped.

  Done on 2026-09-14, 17:21 to 17:27, exit 0, with every file of the change
  staged and a CPU load of 22% before it began. Typecheck and lint passed.
  The tests:
  - the root scripts: 4, 11, 10, 9 and 4, all passed;
  - cli: 161 in 16 files;
  - core: 1453 in 103 files, then the `core-git-subprocess` project, 4 in
    2 files;
  - extension: 376 in 28 files;
  - server: 100 in 4 files;
  - webui: 472 in 51 files.

  All passed. The run kept going while the owner used "Extensions: Check for
  Extension Updates" in the same VS Code, which reloads no window.
- [ ] 4.4 CI's "Standalone browser and accessibility" passes on this change's
  pull request.

  **The first CI run on #513 failed** at ec93811, run 34916198901. "starts a
  chain from its card, answers it there, and asks it to stop" failed the
  same way twice, with its retry: step 2's loop gave up after 60 seconds,
  waiting for `pipeline-stop-pipeline-run`. The other 19 tests passed.
  - **What the trace shows.** In both attempts the DOM snapshots hold
    `pipeline-stop-pipeline-run` once and `pipeline-ask-stop-pipeline-run`
    never. The run was held by the host throughout, and the card offered its
    own Stop, but only after the loop's last pass. The failure screenshot
    shows the card RUNNING, "checking the change — said 55s ago", with Stop.
  - **The cause.** Each pass switches tabs to read the Pipeline again, which
    redraws the card without controls until the live runs are read back.
    On the loaded Linux runner that took longer than the 3-second wait per
    pass. It is not the fixture's git identity from 1.1: a run held here is
    decided by run id alone, in `describeChangeCards`.
  - **The fix.** The wait per pass is now 10 seconds, the loop's budget 90
    seconds, and the test's timeout 240 seconds.
