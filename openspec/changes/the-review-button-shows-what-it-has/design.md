## Context

`ProcessesView.tsx` renders a table of persisted runs and, when one is
inspected, a details panel as the **last** section of the tab. With a short
list this reads as a master-detail layout. With this repository's hundred
runs the detail is 5000 px below the control that opens it.

The reading itself is sound: `inspect` calls `api.details(processId)`,
reports a failure into the tab's message line, and sets the panel's state.
Nothing about the data path needs changing.

## Goals / Non-Goals

**Goals:**

- A press is answered where the reader is looking.
- A second press on another row is visibly a different answer.
- The run to review can be found without scrolling a hundred rows.

**Non-Goals:**

- Changing what the details say, or how they are read.
- Rewriting the table as a virtualised list. A filter is the cheaper answer
  to a hundred rows, and the list is not growing without bound: the tab
  already offers `Clean old history`.

## Decisions

### The details open under their own row

The panel becomes a row that follows the one it belongs to, spanning the
table. The reader's eye does not move: the answer arrives under the
question.

**Rejected: scrolling the existing panel into view.** It answers the
letter of the complaint - something visibly happens - and leaves the reader
five screens away from the row they were comparing against, with the way
back being a scroll through ninety-nine other runs.

**Rejected: a modal.** A run's details are read against its neighbours -
which of these interrupted runs touched this file - and a modal hides
exactly that.

### One open row at a time

Each press reads from the host, so several open rows would mean several
readings held in memory and re-read on every refresh for no gain: nobody
compares two checkpoint deltas side by side in a table. The open row is
state, and opening another closes the first.

### The press has a visible state before the answer arrives

`aria-expanded` on the button, and while the reading is in flight the open
row says it is reading. The existing tab-wide reading line stays, because
the shell's status line uses it; it is no longer the only sign.

### The list takes the shared filter

`matchesFilter` from core, over the operation, the change name, the agent
id and the state - the same predicate the Changes views and the Pipeline
use, so a word that finds a run in one place finds it in another. The tab
says what it is filtered by and how many of how many it shows, as the
Pipeline does.

## Risks / Trade-offs

- **A row that expands changes the table's height as the reader works.**
  That is what an expansion is for; the alternative was a fixed panel
  nobody found.
- **The picture is retaken.** `docs/images/standalone/processes.png` shows
  the old layout, and the screenshot lint would keep it honest anyway.
