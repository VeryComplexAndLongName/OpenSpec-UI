## ADDED Requirements

### Requirement: The Pipeline folds what has landed, and can be narrowed

The Pipeline SHALL fold away the cards whose change's work is over -
archived on the default branch, merged in a pull request, or gone from it
after being there - into one row stating how many, which opens them.

A picture of every change ever proposed is a wall. What the Pipeline is
for is what is being worked on now, and it already knows which changes are
over: the word on each card says so.

That row SHALL offer to archive those changes, and archiving SHALL happen
only on that press. Where one cannot be archived, the answer SHALL name it
and the rest SHALL still be archived.

The Pipeline SHALL take a filter over a change's name and its standing
word, using the same predicate every other narrowed view uses, and SHALL
say what it is filtered by and how many of how many it is showing. A
filter matching a change inside the folded group SHALL open that group for
the reading.

#### Scenario: Finished changes are folded

- **WHEN** the Pipeline draws a workspace where some changes have landed
- **THEN** those cards are folded into one row stating how many, and the
  rest are drawn as before

#### Scenario: Archiving what has landed

- **WHEN** the reader presses the row's archive
- **THEN** exactly the folded changes are archived, and one that cannot be
  is named while the rest are

#### Scenario: Narrowing the picture

- **WHEN** the reader filters the Pipeline
- **THEN** only the cards that match are drawn, the picture says what it
  is filtered by and how many of how many, and a match inside the folded
  group opens it
