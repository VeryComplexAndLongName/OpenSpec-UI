## Why

Since 2026-09-20 each change is worked in a working directory of its own
(`openspec/README.md`, "Where an agent works"). That convention keeps two
agents out of one index, and it breaks the Changes view in two ways at
once.

**A directory is cut from `main`, so it holds every active change, not
one.** The owner opened a fresh worktree and asked: "In the current branch
I see 2 finished changes and one not. The icons are green. What do I do
with them?" The answer is "nothing, they are somebody else's", and the view
gives no way to know that. Every row is drawn alike, and the two that are
not this directory's business look exactly as actionable as the one that
is - with the mutating menu items on all three.

**The main checkout will look like an empty room.** Once the work has moved
into the directories, the owner's own window shows "No active changes -
Create an OpenSpec change to begin" while four changes are being worked ten
metres away. The one place that should say where everybody is says nothing.

The facts needed are already read: `surveyWorktrees` knows which directory
each change is the worktree of, and, since #625, which agent is reporting
from it and whether its record checks out. The Pipeline's cards use them.
The Changes tree does not.

## What Changes

- **One change is this directory's.** The change the directory's branch is
  named after is drawn first and named in the view's description, so the
  view says what it is for before any row is read.
- **Every other row says whose it is.** A change worked in another
  directory is drawn locked and grey, with the directory and the person in
  its description; a change no directory has taken up says so, and stays
  ordinary.
- **A row that is not this directory's offers nothing that would write.**
  The mutating menu items are hidden on it, and each of those commands
  refuses by name if it is invoked another way.
- **Another directory's copy can be read without leaving this window.** A
  press opens that directory's own `proposal.md`, `design.md` or `tasks.md`
  read-only - what the other agent has actually written, which this
  checkout's copy does not have - and a second press opens the directory
  itself.
- **A picker walks all of them.** One command lists every active change
  with where it is worked, so moving between them is a keystroke rather
  than a path.
- **An empty checkout says where the work is.** Where this directory has
  no change of its own, the view says so and says how many are being worked
  in other directories, with a press to the Pipeline.
- The same reading serves the standalone Changes list: the decision is one
  core function, not two readings that would disagree.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `execution-core` - the reading that says, for one change, where it is
  worked and by whom.
- `vscode-extension` - the Changes tree draws it, hides what would write
  on another's row, opens another directory's copy read-only, and offers
  the picker.
- `shared-ui` - the standalone Changes list says the same thing.

## Impact

- `packages/core/src/change-ownership.ts` (new) and its test.
- `packages/extension/src/tree/changes-tree.ts`, the commands that mutate
  a change, `package.json`'s menus, a read-only document provider.
- `packages/webui/src/components/ChangesList.tsx`.
- A changeset: the extension and the standalone app both change.

## Explicitly out of scope

- **Stopping anybody.** A locked row is a statement, not a lock on the
  filesystem: the files are in this checkout and git will let anyone edit
  them. This is the same position ADR 0028 takes for a stop - a
  recommendation that is loud rather than a gate that can be defeated and
  then trusted.
- **Writing into another directory.** Read-only means read-only. An agent
  that wants to change somebody else's change asks them, through the
  channel #612 added, and this view will not grow a Write button.
- **Deciding ownership from git.** Who works a change is read from the
  status records and the roster, which are signed. A branch name is not
  evidence of a person, and this change does not treat it as one.
- **Hiding other people's changes.** They are drawn, and drawn plainly:
  a view that hid them would recreate the morning two agents spent not
  knowing about each other.
- **The Archive tree.** An archived change is nobody's business to work
  on, so ownership has nothing to say there.
