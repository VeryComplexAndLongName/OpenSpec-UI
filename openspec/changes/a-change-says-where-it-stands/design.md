# Design

See the amendments of 2026-09-13 to
`docs/adr/0026-other-working-directories-are-observed-never-touched.md`
("where a change stands, wherever it is") and
`docs/adr/0028-agents-coordinate-beside-the-repository.md` ("a request has
a reply, and both are kept").

## Context

- **What is read today.**
  - `readChangeReadiness` reads this checkout's active changes.
  - `surveyWorktrees` reads every working directory's changes, task counts,
    leases and status records, with one `git worktree list` and one
    identity read.
  - Nothing reads a ref.
  - `GitWrapper.pathExistsInRef` exists, and is the only ref-aware read.
- **How branches are named.** ADR 0022 names a change's branch after the
  change, and `change-worktrees.ts` already recognises it.
- **What `gh` is used for.** `createPullRequestGateway` creates, polls and
  merges a pull request, but reads no pull request's state.
- **What a delegated run keeps.** `runDelegatedItem` returns the tail of
  stderr on failure, and a sentence. Its audit entries are `started` and
  `completed`, with no text. `collectHumanOnlyInbox` lists open items, and
  knows nothing of their runs.

## Decisions

### One reading, the facts kept apart from the words

`readChangeStandings(workspaceRoot, options)` in `change-standing.ts`
returns, for every change name found in any source:

- **here**: this checkout's copy, with `done` and `total`, or absent;
- **directories**: each other working directory's copy, with its label,
  branch and counts, and any run a status record says is on it;
- **main**: active with counts, archived with the archive directory's
  name, or absent, read from the main ref;
- **branch**: the change's own branch, local and on the remote, with its
  counts where it carries the change;
- **pullRequest**: its number and state, where one exists and `gh` was
  read;
- **sources**:
  - which ref was read as `main`;
  - when refs were last fetched;
  - whether the last fetch failed;
  - whether `gh` was read, and if not, why.

`describeChangeStanding(facts)`, in the browser-safe
`change-standing-facts.ts`, turns one change's facts into a word and lines.

- **Rejected: a word computed in each host.** ADR 0025's reason holds: two
  derivations drift, and both look plausible.

### One state word for a change, everywhere

ADR 0029's amendment defines one closed set for every surface, and this
change supplies its words from the standing. The set, in precedence
order:

1. **Now:** Running, Running in `label`, Waiting for you, Waiting in
   `label`.
2. **Settled elsewhere:**
   - **Archived on main**: `main` has the change under `archive`, and no
     active copy.
   - **Merged in #N**: the change's pull request is merged, and `main`
     still has it active.
   - **Deleted on main**: `main` had it at the merge base, and has it no
     longer, active or archived.
3. **Ahead elsewhere:** **Further along in `label`** or **on branch
   `name`**, where another copy has more tasks done than this one.
4. **The last run here:** Failed at `stage`, Stopped at `stage`.
5. **Next here:** Done, Blocked, Ready.

`describeChangeState(facts)` in the browser-safe `change-state.ts` is the
one function that picks the word.

- The facts are the standing from this change, and the readiness and last
  run that `a-card-says-what-its-change-is-doing` adds.
- A fact that is not yet read, such as the last run before that change
  lands, simply takes no part.
- The Changes tree, the standalone Changes list, the card and the terminal
  all call it.
- Whatever else applies becomes a line beneath the word, naming its
  source: "7 of 10 done in `label`, 3 of 10 here", "only here", "behind
  the copy in `label`".

The colour follows the precedence group. The word is always present, so
colour never carries the state alone.

| Group | Colour |
| --- | --- |
| Settled elsewhere | light green |
| Ahead elsewhere | yellow |
| Now | blue |
| Failed or stopped | red |
| Deleted | grey |
| Next here | none |

- **Rejected: a standing word beside a separate card word.** Two words for
  one change on two surfaces is the confusion the owner ruled out on
  2026-09-13.

- **Rejected: deciding "deleted" from absence alone.** A change that was
  never on `main` is absent from it too. Only a change that the merge base
  had and `main` no longer has is called deleted.

### Refs are read in this repository, and their age is stated

`GitWrapper` gains:

- `listTreeNames(ref, path)`;
- `showFile(ref, path)`;
- `refExists(ref)`;
- `fetch(remote)`;
- `lastFetchedAt()`, the modification time of `FETCH_HEAD` in the
  repository's common git directory.

All of them run against this repository, as ADR 0026 requires.

- **The main ref** is the remote's `main` where it exists, otherwise the
  local `main`. The reading names which one it used.
- **The fetch.**
  - It runs while a view showing standings is visible, at most every
    `STANDING_FETCH_INTERVAL_MS` (five minutes), and before a run starts.
  - It never runs on every reading.
  - A failed fetch is recorded, and the reading says it. The reading
    carries on from the refs it has, and never retries in a loop.
- **The cache.** A reading is kept until the refs it read, or a watched
  file, change.
- **Rejected: fetching on every reading.** That puts a network call behind
  every repaint.
- **Rejected: trusting local refs silently.** A stale `main` shown as
  current is what ADR 0026's amendment exists to stop.

### A person can ask for a fresh reading at any time

The slow fetch interval keeps a view from touching the network behind
every repaint. It also means a pull request merged a minute ago would show
as not merged until the interval passes. So every surface that shows a
change's state has a **Refresh** control:

- the VS Code Changes tree's existing `openspec-ui.refresh`;
- a new button on the standalone Changes list;
- a new button beside the Pipeline's read-at line, in both hosts.

Refresh re-reads the files and fetches now, then says when refs were last
fetched.

- It is disabled while its fetch is under way, so a second press is not a
  second fetch.
- A failed fetch is said beside it, never swallowed.

### Pull requests come from one `gh` call

`listPullRequestsByBranch` runs `gh pr list --state all --json
number,state,headRefName --limit 200` once per reading, and maps the
result by branch.

Where `gh` is absent, not signed in, or fails, the reading says so. Every
fact that needs a pull request is left out rather than guessed.

- **Rejected: a `gh pr view` per branch.** That is a network call per
  change.

### The run dialog asks before it starts

A standing whose word is Running, Archived on main, Merged, or Deleted on
main makes the run dialog lead with it, and disables every path until a
confirmation is checked. This is the same in both hosts, from one
component.

A refetch happens before the dialog opens, so the question is asked about
fresh refs.

- **Rejected: refusing the run.** ADR 0026 reports conditions and forbids
  nothing. A person may have a reason.

### In VS Code the colour is a file decoration

A `ChangeTreeItem` gains a `resourceUri` in the extension's own scheme,
naming the change. A `FileDecorationProvider` gives that URI:

- a colour from the theme's chart colours;
- a one-letter badge;
- a tooltip of the word.

The tree item's description carries the word itself.

- **Rejected: an icon colour only.** An icon tint is lost in several
  themes and says nothing to a screen reader. The description and tooltip
  carry the words.

### A request and its reply are audit entries

`AuditEntry` gains an optional `message` holding ADR 0028's envelope:

- `id`
- `kind`: `request` or `reply`
- `inReplyTo`
- `from`
- `to`
- `at`
- `body`
- `outcome`

`runDelegatedItem` writes:

- **the request** before the agent starts: `from` is the host's git
  author, and `to` is the agent's id and the run's status instance;
- **the reply** when the run ends, with an outcome of `closed`,
  `left-open`, `refused` or `failed`. Its body is the last 4 000
  characters of the agent's reply text, or of its stdout for a raw
  adapter.

`collectHumanOnlyInbox` attaches to each open delegated item the latest
reply whose request names that change and task.

- **Rejected: a file per message in the status directory.** A reply is
  history, and ADR 0028 keeps history out of that directory. The channel
  uses the same envelope when it carries requests across processes.

### The delegated prompt asks for an answer in the turn

`buildDelegatedItemPrompt` adds a section, "How to answer". It tells the
agent:

- to wait for every command it starts, in the turn it was given;
- that a command left running in the background is never seen again, and
  work handed to later has no later;
- to end the turn with what it did and, where the item is not closed,
  why.

## Protocol

No command or event kind is added. The server gains
`POST /api/change-standings`. The extension answers `changes/standings`
over the bridge.

The audit entry's `message` is optional, so entries written before it
stay valid.

## Non-Goals

- A Pipeline card's state word, which `a-card-says-what-its-change-is-doing`
  derives from this reading.
- Any action on another copy or on `main`.
- Clones that are not working directories of this repository.
- A conversation, threads, or replies to replies.

## Risks / Trade-offs

- **Cost on a large repository.** A reading lists the tree of `main` and
  of each change branch, and reads a `tasks.md` from each ref that has the
  change. Task 9.1 measures it on this repository. If a reading takes more
  than a second, per-ref results are cached by commit id.
- **`gh` limits.** One list call per reading, at most every fetch
  interval, stays well inside `gh`'s rate limits.
- **A fetch touches the network.** It is read-only for working trees, and
  it is visible: the reading says when it last fetched and whether that
  failed.
- **Counting ticks is not the same as done.** "Further along" compares
  counts, not content. The word says counts, and never claims the other
  copy is correct.
