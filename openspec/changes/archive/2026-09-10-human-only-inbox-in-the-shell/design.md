# Design

## Decision: the collector moves to core, the tree keeps its rendering

`HumanOnlyInboxTreeProvider` walked the workspace itself. That walk is
the answer to a question both hosts have, so it moves to
`collectHumanOnlyInbox`, and the tree becomes what it should have been:
a rendering of an answer.

Its tests move with the behaviour. What the tree asserts now is what it
does with a list; what the list contains is asserted where it is built.

## Decision: read beside the summary, and fail separately

The shell loads it when it loads the overview — the same click, the same
question. A failure to read the task files does not clear the summary:
a workspace whose files cannot be read still has a summary worth showing,
and losing that to this would be the worse trade.

## Decision: active changes only

Archiving requires every task ticked, so an archived change has nothing
waiting by construction. Reading this repository's 178 archived changes
to confirm that would cost a page load to learn nothing.

## Decision: the empty state says which empty it is

"Nothing is waiting on a person — 6 active changes read" and "no active
change to look at" are different facts. A blank space is neither.
