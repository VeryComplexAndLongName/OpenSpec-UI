Three reports from the owner on 2026-09-16, taken together because they are
one complaint: a screen that does not say what it is doing, or shows
something that is not the person's own work.

## 1. The server can answer for a change's diff

Amended on 2026-09-16, before implementation: the first draft had the
server call `GitWrapper.diff(pathspec)`, which is a plain `git diff` and
shows only unstaged edits. A change's new files, which are most of a new
change, and anything staged would never have appeared. The reading moves to
core, where business logic lives.

- [x] 1.1 `packages/core/src/change-diff.ts` exports
  `readChangeDiff(workspaceRoot, changeName, { maxBytes })`, answering
  `{ kind: "diff", diff, files, truncated, maxBytes }`: the change
  directory's diff against `HEAD` (against the empty tree before the first
  commit), followed by each untracked file under it rendered as an added
  file, a binary one as a single line.
- [x] 1.2 The same function answers `{ kind: "not-active", message }` for a
  name that is not an active change of that workspace, and
  `{ kind: "not-a-repository", message }` where the workspace is not a git
  repository.
- [x] 1.3 The same function caps the diff at `maxBytes` (default
  `CHANGE_DIFF_MAX_BYTES`, 200,000), cutting back to the last whole line
  and setting `truncated`.
- [x] 1.4 `packages/core/src/change-diff.test.ts`, against real temporary
  repositories, covers: an edited committed `tasks.md`, a staged edit, an
  untracked new file, nothing uncommitted, a name that is not active, a
  workspace that is not a repository, and a cut at a small `maxBytes`.
- [x] 1.5 `packages/core/src/index.ts` exports the module.
- [x] 1.6 `handleChangeDiffRequest` in `packages/server/src/rest.ts` takes
  `{ cwd, changeName }` behind the usual cwd authorization and answers the
  diff with 200, a name that is not active with 404, and a workspace that is
  not a repository with 409, each refusal as `{ error }` carrying core's
  sentence.
- [x] 1.7 `packages/server/src/server.ts` routes
  `POST /api/change-diff` to it, inside the existing token gate.
- [x] 1.8 `packages/server/src/server.test.ts` covers the three answers of
  1.6 through the route.

  Done on 2026-09-16. Core reads the diff against `HEAD` and adds the
  untracked files; the server answers 200, 404 and 409 with core's own
  sentences.
  - **Checks:** `change-diff.test.ts` passes, 7 tests against real temporary
    repositories, the staged and untracked cases among them;
    `server.test.ts`'s three change-diff tests pass; core and server
    typecheck and server lint pass.

## 2. Diff Preview shows a real diff

- [x] 2.1 `packages/webui/src/change-diff-client.ts` posts to
  `/api/change-diff` and returns the payload, the way
  `change-readiness-client.ts` does.
- [x] 2.2 `packages/webui/src/components/ChangeDiff.tsx` takes
  `unified: string` instead of `before`/`after`, and renders each line
  coloured by its first character. It keeps `data-testid="change-diff"`.
- [x] 2.3 `packages/webui/src/components/ChangeDiff.test.tsx` covers an added
  line, a removed line, a context line, and an empty diff.
- [x] 2.4 The Diff Preview tab in `packages/webui/src/standalone-entry.tsx`
  offers the active changes by name, loads the chosen one's diff, and shows
  it. The two hard-coded sample strings go.
- [x] 2.5 The same tab says "This change has nothing uncommitted." for an
  empty diff, and shows the route's own sentence for an error.
- [x] 2.6 The same tab says when a diff was truncated, and names the size it
  was cut to.

  Done on 2026-09-16. Choosing a change in the picker reads its diff at
  once, Refresh reads it again, and a reply for a change since left behind
  sets nothing. `ChangeDiff` no longer imports the `diff` package; the
  dependency stays in `package.json`, since removing it rewrites the lock
  file and belongs to a change of its own.

  `documentation-screenshots.spec.ts` photographed the old sample. Its
  fixture is now committed first, so the two files it writes afterwards are
  the change's uncommitted work, and the spec waits on
  "+- [x] 1.1 Write the proposal." before taking `diff-preview.png`.
  - **Checks:** `ChangeDiff.test.tsx` passes, 3 tests; webui and server
    typecheck, webui lint pass; `documentation-screenshots.spec.ts` passes
    alone, and the picture shows the fixture's real two-file diff.

## 3. A tab says it is reading, and holds its controls

Rewritten on 2026-09-16, before any of it was implemented, to the third
screen of the redesign mockup the owner approved: a moving bar, a spinner,
the sentence with elapsed seconds, disabled controls, and a spinner on the
tab's label. The first draft had only the sentence.

- [x] 3.1 `packages/webui/src/tab-readings.ts` exports `tabReadings(state)`,
  a pure function from the shell's loading state to a sentence or `null` for
  each tab id, with the sentences of design.md's table, including the
  overview's sentence on Diff Preview, the Change Editor and the Timeline
  until the overview has returned once.
- [x] 3.2 `packages/webui/src/tab-readings.test.ts` asserts every row of that
  table, that a settled shell gives `null` for every tab, and that Run a
  Command never reads.
- [x] 3.3 `packages/webui/src/components/PanelStatus.tsx` takes
  `reading: string | null` and a `testId`, renders nothing for `null`, and
  otherwise a `div.openspec-panel-status` with an `aria-hidden` bar and
  spinner and `<p role="status">` holding the sentence and, past three
  seconds, "· <n> s".
- [x] 3.4 `packages/webui/src/components/PanelStatus.test.tsx` asserts
  nothing renders for `null`, the sentence is in the status node, the bar
  and spinner are hidden from assistive technology, and the elapsed seconds
  appear only after three seconds, with fake timers.
- [x] 3.5 `packages/webui/src/components/BusyFieldset.tsx` renders
  `<fieldset className="openspec-busy-fieldset">` with `disabled` and
  `aria-busy` set while `busy` is true.
- [x] 3.6 `packages/webui/src/components/BusyFieldset.test.tsx` asserts a
  button and a select inside are disabled while busy and enabled after.
- [x] 3.7 `Tabs` in `packages/webui/src/components/Tabs.tsx` takes an optional
  `busy: ReadonlySet<string>` and draws an `aria-hidden`
  `span.openspec-tab-spinner` after a busy tab's label.
- [x] 3.8 `packages/webui/src/components/Tabs.test.tsx` asserts the spinner is
  on the busy tab only, and that every tab's accessible name is the same
  with and without it.
- [x] 3.9 `shellThemeCss` in `packages/webui/src/shell-ui.ts` draws
  `.openspec-panel-status`, `.openspec-tab-spinner` and
  `.openspec-busy-fieldset` from the shell's tokens, and stops every
  animation among them under `prefers-reduced-motion: reduce`.
- [x] 3.10 `packages/webui/src/shell-ui.test.ts` asserts those rules exist,
  that their colours are tokens, and that the reduced-motion block names
  each animated rule.
- [x] 3.11 `ProcessesView` in `packages/webui/src/components/ProcessesView.tsx`
  takes `onReadingChange?: (reading: string | null) => void` and reports
  "Reading persisted runs…" while it loads.
- [x] 3.12 `GlobalHarnessSettingsView` in
  `packages/webui/src/components/GlobalHarnessSettingsView.tsx` takes the
  same callback and reports its load and its save.
- [x] 3.13 `PipelineView` in `packages/webui/src/components/PipelineView.tsx`
  takes the same callback and reports "Reading what is running…" until its
  first reading returns, and never for a later poll.
- [x] 3.14 The three views' tests —
  `ProcessesView.test.tsx`, `GlobalHarnessSettingsView.test.tsx`,
  `PipelineView.test.tsx` — assert the callback is called with the sentence
  and then with `null`, and the Pipeline's not again on its next poll.
- [x] 3.15 `packages/webui/src/standalone-entry.tsx` computes `tabReadings`,
  passes the busy tabs to `Tabs`, and renders `PanelStatus` and
  `BusyFieldset` in every tab but Run a Command.
- [x] 3.16 `packages/server/e2e/tab-reading.spec.ts` holds the overview
  response, opens the summary, and asserts the status sentence, a disabled
  control and the tab's spinner; then releases it and asserts all three are
  gone. It also asserts the Summary tab's spinner stays while the Harness tab
  is open.

  Done on 2026-09-16, with three deviations from the tasks as written.

  - **3.3: the seconds sit beside the status node, not in it.** Inside
    `role="status"` a screen reader would announce the whole sentence again
    every second. They are an `aria-hidden` sibling; the status node holds the
    sentence alone.
  - **3.13 and 3.15: the Pipeline gets the tab spinner and nothing else.** It
    already says "Reading what is running…" in its own place, now from the
    exported `PIPELINE_FIRST_READING`; a `PanelStatus` above it would say it
    twice. Its tab is not wrapped in `BusyFieldset` either: before the first
    report there are no card controls to hold.
  - **3.11: Processes names each of its four readings**, not only the list:
    "Reading persisted runs…", "Reading the run's details…", "Rolling the
    run's files back…", "Removing old history…".

  `BusyFieldset` is `display: contents`, so wrapping a tab in it moves nothing
  on screen, and a disabled fieldset still disables every control inside it.
  - **Checks:** `tab-readings.test.ts` 15, `PanelStatus.test.tsx` 4,
    `BusyFieldset.test.tsx` 1, `Tabs.test.tsx` 11, `shell-ui.test.ts` 10, and
    the three views' files 99 in all, pass; webui typecheck and lint pass;
    `e2e/tab-reading.spec.ts` passes alone — with the overview request held
    open, the summary shows the sentence, its fieldset is `aria-busy` with a
    disabled button inside, its tab keeps the spinner while Harness Settings
    is open, and all of it goes when the request is released.
- [x] 3.17 `packages/webui/src/shown-readings.ts` exports
  `useShownReadings(readings)`, which shows a reading only once it has lasted
  `READING_SHOWN_AFTER_MS` (400) and stops showing it the moment it returns;
  `standalone-entry.tsx` drives the status line, the held controls and the
  tab spinners from it, and `.openspec-tab-spinner` is laid over the tab's
  corner instead of taking room beside its label.
- [x] 3.18 `packages/webui/src/shown-readings.test.tsx` asserts a reading
  shorter than the delay is never shown, a longer one is shown and hidden at
  once on return, and a new sentence is followed at once;
  `shell-ui.test.ts` asserts the tab spinner takes no room.

  Added on 2026-09-16 from the owner's look at the running shell: every
  row's Review in Processes and Recovery made the screen jerk. Three things
  moved it: the status line appearing and going for a reading of a few
  hundred milliseconds, the spinner widening its tab, and — older than this
  change — the Refresh button reading "Loading..." during any reading, a
  Review included, which changed its width and moved every control after
  it. `ProcessesView.tsx` now keeps the label "Refresh" in every state.
  - **Checks:** `shown-readings.test.tsx` 3, `Tabs.test.tsx` 11,
    `shell-ui.test.ts` 10 pass; webui typecheck and lint pass. Live, in
    Chromium against this branch's server on this repository, pressing a
    row's Review: the browser's layout-shift total was 0, Clean old history,
    the Pipeline tab and the Review button itself moved by 0 px, the first
    button's label stayed "Refresh", and no status line appeared.

## 4. The theme control is a switch

- [x] 4.1 `packages/webui/src/components/ThemeToggle.tsx` renders
  `role="switch"` with `aria-checked`, the visible text "Dark theme"
  unchanged, and an `<Icon>` whose meaning follows the state.
- [x] 4.2 `shellThemeCss` in `packages/webui/src/shell-ui.ts` draws the
  switch — track, knob and focus ring — from the shell's own tokens, with no
  literal colour.
- [x] 4.3 `packages/webui/src/components/ThemeToggle.test.tsx` asserts the
  accessible name stays "Dark theme" in both states, that `aria-checked`
  follows the theme, and that the icon changes.

  Done on 2026-09-16, with one deviation: the sun and the moon are drawn as
  inline SVG in `ThemeToggle.tsx`, not taken through `<Icon>`. The icon
  font's subset carries neither glyph, and cutting a new subset for one
  control is more than the control is worth.

  `standalone.spec.ts` looked the control up as a button with `aria-pressed`;
  it now finds the switch by the same name and reads `aria-checked`. Its wait
  for Metro's colour transitions to finish, before the dark axe run, now
  waits on CSS transitions only: a reading tab's spinner is an animation that
  never finishes.
  - **Checks:** `ThemeToggle.test.tsx` 3, `standalone-theme.test.tsx` 5 and
    `shell-ui.test.ts` 10 pass; webui and server typecheck, webui lint pass.
- [x] 4.4 `ThemeToggle.tsx` shows the switch alone, with no text beside it;
  its name "Dark theme" moves to `aria-label`, and `ThemeToggle.test.tsx`
  asserts the switch has that name and no visible text.

  Added on 2026-09-16: the owner read the label beside the switch as
  meaningless, since the sun or the moon on the knob already says it. With
  no visible label WCAG 2.5.3 no longer constrains the name, and the name
  still does not change with the theme.
  - **Checks:** `ThemeToggle.test.tsx` 3 and `standalone-theme.test.tsx` 5
    pass; `standalone.spec.ts` finds the switch by the same name.

## 5. Checks

- [x] 5.1 `openspec validate a-screen-says-what-it-is-doing --strict` passes.
- [x] 5.2 `npm run verify` passes, run unpiped. Record each package's count.
  Do not pipe it: a pipe reports the pipe's exit code.
- [x] 5.3 A changeset: `@openspec-ui/webui` minor, `@openspec-ui/server`
  minor, `openspec-ui-vscode` patch. Its text says plainly that these
  features arrive in this release: the proposal's own changeset was released
  early, in extension 0.59.0 and 0.59.1, server 1.27.0 and webui 1.51.0,
  whose entries describe them before they existed. The owner chose on
  2026-09-16 to correct that forward rather than rewrite those entries.
- [x] 5.4 `lint:english` after `git add`, `lint:changesets`,
  `lint:test-budgets` and `lint:source-text` pass.
- [x] 5.5 The whole standalone browser suite passes, including the axe WCAG AA
  run in both themes. Record the spec count.

  Done on 2026-09-16.

  - **5.1:** "Change 'a-screen-says-what-it-is-doing' is valid".
  - **5.2:** run with its output redirected to a file, not piped. Typecheck
    and lint pass in every package. Tests: cli 161, core 1,487 (plus 4 in
    its scripts), extension 379, server 103, webui 532 of 533, and the root
    script suites. The one webui failure, `build-metro-icons.test.mjs`,
    compares a module stored with LF against its CRLF checkout on Windows;
    it fails identically on an untouched main and passes on the Linux
    runner, and it makes verify exit 1 here.
  - **5.3:** `.changeset/a-screen-says-what-it-is-doing.md`, which says these
    features arrive in this release. It adds `@openspec-ui/core` minor to
    the three packages named: `readChangeDiff` is new in core.
  - **5.4:** after staging every file by name.
  - **5.5:** `npm run test:browser` in `packages/server`, 21 tests in 10
    spec files, 21 passed in 8.0 minutes, the WCAG 2.1 AA axe runs in light
    and dark among them, and `tab-reading.spec.ts` new. Of the pictures the
    suite retook, only `diff-preview.png` is kept: it now shows the
    fixture's real diff, and the others differed in their timestamps alone.
- [ ] 5.6 **Delegated to claude-cli.** A live check against a real server in a
  real repository: open Diff Preview for a change with an edited file, for a
  change with nothing uncommitted, and switch to a tab whose reading is slow.
  Evidence to record: the first three lines of the diff shown, the sentence
  shown for the empty change, the text of the `role="status"` node caught
  while a reading was outstanding, whether a control of that tab was
  disabled at that moment, and the screenshot paths.
- [x] 5.7 **Human-only.** Whether the theme switch reads as a switch, and
  whether the waiting sentence answers the question a person actually has
  while looking at a slow tab.

  Done on 2026-09-17 by the owner: "The theme switch is visible as a
  switch." And of the slow tabs they had seen: "they answer that question."
