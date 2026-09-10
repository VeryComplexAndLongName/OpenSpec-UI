# Design

## Decision: the changeset lint parses names, not quotes

The frontmatter of a changeset is a list of `name: bump` lines where
the name may be bare, single-quoted or double-quoted. The lint reads all
three with one expression and refuses a line it cannot read, naming the
file and the line. Still not a YAML parser: the format has three shapes
and a parser dependency for three shapes remains the larger risk.

## Decision: the chart test asserts the fixture's shape

The fixture already documents two, one, zero, one across four days. The
test reads the per-day table rows and asserts exactly that, so a zero
where a count belongs fails. The screenshot stays; it is for the
documentation, not the assertion.

## Decision: the fixture isolates git

Every `git` call in the fixture passes `-c commit.gpgsign=false -c
core.hooksPath=<empty temp dir>` beside the existing author and
committer environment, so a developer's global configuration cannot
reach it. The same pattern is applied to any other fixture that commits.

## Decision: a failed read is a message, not an absence

The inbox state distinguishes not loaded, loaded, and failed with a
reason; the block renders in the failed state with the reason, in the
same place the count would have been.

## Decision: a bridge request times out with a named reason

`bridgeRequest` rejects after a stated interval with "the host did not
reply within N seconds to <op>". The settings view shows that message and
re-enables what it disabled. The interval is generous — a resolve over a
large workspace takes well under a second — and sized in the module with
the measurement beside it, as the test budgets are.
