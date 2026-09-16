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
`{ diff: string, files: string[] }` from `GitWrapper.diff` over the change's
own folder, `openspec/changes/<changeName>`.

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

### A panel says it is working, in one shared way

`PanelStatus` renders `<p role="status" className="openspec-shell-note">` with
the sentence a screen gives it, and nothing when the screen is settled. Each
tab that fetches on mount renders it until its first reading settles or fails:
Diff Preview, Processes and Recovery, the summary, the Change Editor,
Templates, the Timeline. The Pipeline keeps its own line, which already says
this.

- **Why `role="status"`.** A screen reader announces it without stealing
  focus, and the browser suite can assert one node rather than a spinner's
  frames.
- **Why not a spinner.** A spinner says "something is happening"; the
  sentence says which reading is outstanding, which is what a person waiting
  on a slow git walk actually wants.

Rejected: putting the line in `TabPanel` itself. The panel does not know what
its children fetch, and a tab with nothing to fetch would then have to say it
is ready.

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
- **One more shared component.** `PanelStatus` is small, and the alternative —
  each screen writing its own sentence — is what produced today's uneven
  behaviour.
