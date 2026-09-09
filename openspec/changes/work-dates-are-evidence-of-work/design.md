# Design

## Decision: a ticked task, not a written line

`ChangeTimelineTask` already distinguishes the two: `date` is set only
for a checked task, `lastTouchedDate` for any line. The first is
evidence that something was finished; the second is evidence that a file
exists.

`buildChangeDates` takes the first one now. The rename in the evidence
type says which — `taskLineDates` becomes `taskDoneDates` — so a caller
cannot pass the wrong set without noticing.

## Decision: the earliest evidence still wins, but the sources are now comparable

`firstWorked` is still the earliest of the ticked-task dates and the
audit timestamps. What changes is that both can now win: a run recorded
before the first tick reports the run, which is what "work started here"
means when an agent ran before anyone checked a box.

## Rejected: keeping both, as separate fields

A `firstTouched` beside a `firstWorked` would be two fields where one is
the proposal date wearing a different name. The proposal date is already
carried, by `proposed`.

## Rejected: inferring a start from the proposal date

"Work probably started when it was proposed" is a guess that would plot
as a measurement. The whole point of carrying a source is not to do
that.
