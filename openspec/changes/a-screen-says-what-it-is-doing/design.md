## Context

What the three reports are, in code.

- **Diff Preview.** `standalone-entry.tsx` renders `<ChangeDiff before={"- [ ]
  task one\n- [ ] task two\n"} after={"- [x] task one\n- [ ] task two\n"} />`.
  `ChangeDiff` then runs `diffLines` in the browser over those literals. The
  panel is a demonstration of a component, wired to nothing.
- **Loading.** `TabPanel`'s `lazy` defers a panel's first mount until its tab
  is opened. What the panel does on mount — a fetch, a poll, a git walk — is
  invisible until it returns. Screens whose work starts from a button already
  say "Loading..."; the Pipeline says "Reading what is running…" through
  `data-testid="pipeline-loading"`.
- **The theme control.** `ThemeToggle` renders a `button` labelled "Dark
  theme" with `aria-pressed`. Its comment records why the name is fixed: WCAG
  2.5.3, the visible label must be part of the accessible name.

What the repository already offers:
- `createGitWrapper().diff(pathspec)` returns a unified diff, and
  `changedFilesBetween(base, branch)` lists a branch's files.
- The server routes are plain checks in `server.ts` —
  `if (req.method === "POST" && req.url === "/api/…")` — behind one token
  gate, with the handler in `rest.ts`.
- The icon set arrived with ADR 0032: `iconFor("…")` and `<Icon>`.

## Goals / Non-Goals

**Goals:**
- A person opening Diff Preview sees their own change's diff, or a sentence
  saying there is nothing to show.
- A person opening any tab can tell working from broken within a moment.
- The theme control looks like it has two states, and still satisfies
  WCAG 2.5.3.

**Non-Goals:**
- **A diff editor.** No editing, no staging, no side-by-side; this is a
  reading surface.
- **History.** Comparing two revisions of an archived change is a separate
  want; this shows what is uncommitted now.
- **Changing what the VS Code extension does.** It delegates diffs to
  `vscode.diff` and keeps doing so.

## Decisions

### The server returns git's own unified diff, not two blobs

`POST /api/change-diff` takes `{ cwd, changeName }` and returns
`{ diff, files, truncated, maxBytes }` from `readChangeDiff` in core, over the
change's own folder, `openspec/changes/<changeName>`.

- **Against `HEAD`, and the untracked files too.** A plain `git diff` shows
  only unstaged edits: a change's new files — most of a new change — and
  anything staged would be missing, and the tab would say "nothing
  uncommitted" about a change full of work. `readChangeDiff` takes
  `git diff HEAD -- <dir>` (the empty tree before a first commit) and adds
  each untracked file under the directory as an added file.
- **In core.** Deciding what "a change's uncommitted work" means is
  behaviour, not transport; the extension could ask the same question.

- **Why git's text.** Git has already decided what changed; re-deriving it in
  the browser from before-and-after blobs invites a second answer that
  disagrees with `git diff` on the same repository.
- **Why the change's folder.** It is the scope a person means when they open a
  change's diff, and it keeps the payload bounded on a dirty workspace.
- **`ChangeDiff` renders that text.** It stops taking `before`/`after` and
  takes `unified`, colouring each line by its first character. Its test moves
  with it.

Rejected: a route that returns the whole workspace diff. On a busy tree that
is megabytes, and the tab would say less, not more.

### What a reading tab looks like

The third screen of the redesign mockup, approved by the owner on 2026-09-16
(https://claude.ai/artifact/AXRHtMxhY2EsznHoAPo19L, "A tab that is reading"):

- **A moving bar** runs along the top of the tab's panel.
- **A spinner and one sentence** name what is being read — "Reading the diff
  of the-web-ui-screens-wear-metro from git…" — and, once the wait passes
  three seconds, the whole seconds elapsed beside it.
- **The tab's controls are disabled** until the reading settles or fails.
- **The tab's label** in the tab row carries a small spinner for as long as
  the tab reads, whichever tab is open.

The owner asked for more than a sentence: an animation, and controls held,
so a person neither wonders whether the tab is alive nor presses a button
into a reading that has not returned.

### Which tab is reading is decided in one place

`tabReadings` in `src/tab-readings.ts` is a pure function from the shell's
loading state to one sentence or `null` per tab. The sentences:

| Tab | Reading while | Sentence |
|---|---|---|
| Summary | the overview loads | Reading the workspace's changes and specs… |
| Diff Preview | a diff loads | Reading the diff of `<change>` from git… |
| Change Editor | a change loads | Reading `<change>`… |
| Templates | the catalog loads | Reading the template catalog… |
| Timeline | one change, a comparison, or a sprint report loads | Reading `<change>`'s history from git… / Reading the history of `<n>` changes from git… / Building the sprint report from git… |
| Processes | its list or a process loads | Reading persisted runs… |
| Harness | the settings load or save | Reading the harness settings… / Saving the harness settings… |
| Pipeline | its first reading has not returned | Reading what is running… |

- **The overview comes first.** The shell reads the overview when it opens,
  and Diff Preview, the Change Editor and the Timeline offer the changes it
  lists. Until it returns those three also read "Reading the workspace's
  changes and specs…", since their pickers are empty for exactly that
  reason — the blank screen the owner reported.
- **Why a function.** `standalone-entry.tsx` is 2,000 lines and has no test;
  a pure function with a table test is where the rule can be checked.
- **Three views report their own reading.** `ProcessesView`,
  `GlobalHarnessSettingsView` and `PipelineView` keep their loading state
  inside, so each gains `onReadingChange(sentence | null)`. The Pipeline
  reports only its first reading: its ten-second polls would otherwise blink
  the tab's spinner forever.
- **Run a Command reports nothing.** A run in flight is not a reading, and
  its own Cancel must stay enabled.

### Three small components carry it

- **`PanelStatus`** renders nothing for `null`. Otherwise, a
  `div.openspec-panel-status` holding the bar and the spinner, both
  `aria-hidden`, and `<p role="status">` with the sentence and, past three
  seconds, the elapsed seconds.
- **`BusyFieldset`** renders `<fieldset disabled aria-busy>` around a tab's
  controls while it reads. A disabled fieldset disables every form control
  inside it natively, so no control has to be remembered, and a screen
  reader hears each as unavailable. Its border, padding and margin are
  reset.
- **`Tabs`** takes a `busy` set of tab ids and draws an `aria-hidden`
  spinner after a busy tab's label; the tab's accessible name does not
  change.

All animation stops under `prefers-reduced-motion: reduce`: the bar and the
spinners stand still, and the sentence alone says the tab is reading.

- **Why `role="status"`.** A screen reader announces it without stealing
  focus, and the browser suite asserts the one node rather than a spinner's
  frames.
- **Why a spinner as well, reversed from this change's first draft.** The
  draft held that the sentence alone was enough. The owner, looking at a tab
  that stood blank for a minute, disagreed: motion answers "is it alive" at a
  glance, before anyone reads a word. Both are kept — the spinner for that
  glance, the sentence for what is outstanding.

Rejected: putting the line in `TabPanel` itself. The panel does not know what
its children fetch, and a tab with nothing to fetch would then have to say it
is ready.

Rejected: disabling each control by hand. Eight tabs have dozens of controls,
and a missed one is a button pressed into a reading.

### The theme control becomes a switch, and keeps its name

`ThemeToggle` renders `role="switch"` with `aria-checked`, the same visible
text "Dark theme", and an `<Icon>` that changes with the state. The stylesheet
draws the track and the knob from the shell's own tokens.

- **WCAG 2.5.3 still holds:** the visible label is unchanged, so a voice
  command naming the button still reaches it.
- **Why a switch and not a renamed button.** "Light theme" as a label would
  change the accessible name with the state, which is the rule's exact
  failure; a switch states the state in its role instead.

## Risks / Trade-offs

- **A large diff.** A change whose folder holds a rewritten `tasks.md` can
  produce a few hundred lines. The panel scrolls, and the route caps what it
  returns at a stated size, saying so when it truncates.
- **A workspace that is not a git repository.** The route says that plainly
  rather than returning an empty diff that reads as "no changes".
- **Three more shared components.** Each is small, and the alternative —
  each screen writing its own sentence and disabling its own buttons — is
  what produced today's uneven behaviour.
- **A reading that never returns holds its controls forever.** Every reading
  here already ends in success or an error; a fetch that hangs is a server
  defect, and the elapsed seconds make it visible rather than hiding it.
- **A second `role="status"` region.** Specs that look up a status node by
  role alone would match more than one; the browser suite runs whole, and
  each new node carries a `data-testid`.
