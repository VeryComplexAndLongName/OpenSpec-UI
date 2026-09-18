## ADDED Requirements

### Requirement: The Archive, Specs and Change Graph views can be narrowed

Each of the Archive, Specs and Change Graph views SHALL offer a filter: a
command in its title bar that asks for text and narrows the view to the
rows that match, and a command that clears it, offered only while a filter
is set.

A view holding hundreds of rows cannot be read by scrolling. This
repository's archive holds 269 changes; the reader who reported it keeps a
roadmap whose numbers do not appear in the names, so finding one change
means reading the list.

A narrowed view SHALL say what it is narrowed by and how many rows it is
showing of how many, so an empty view and an emptied one are never the same
sight.

The predicate SHALL be the one the standalone lists use, from core, so a
word that finds a change in one host finds it in the other.

#### Scenario: Narrowing a view

- **WHEN** the reader runs the filter command on the Archive, Specs or
  Change Graph view and types part of a name
- **THEN** the view shows the rows that match, says what it is filtered by,
  and says how many of how many it is showing

#### Scenario: Clearing it

- **WHEN** a filter is set and the reader runs the clear command
- **THEN** every row is shown again and the message goes

#### Scenario: Nothing matches

- **WHEN** a filter matches no row
- **THEN** the view says so with the text it was given, rather than looking
  like a view with nothing in it

### Requirement: The Change Graph folds a branch whose every change has landed

The Change Graph SHALL fold away a root and everything that follows it
where every change in that branch is archived, and SHALL state how many
such branches it is hiding. One action SHALL show them again.

A graph that keeps drawing finished clusters buries the part being decided
now. Two of them were named in the report that asked for this.

A change that is archived SHALL still be drawn where a change that is not
follows it: what a live change follows is the reason it exists. The same
holds where a change that is not archived is waiting on one in a finished
branch: a row saying what it waits on needs that change in the view to
point at.

The count SHALL cover only branches the view was drawing. A change that
states no relation is not in this view at all, so counting it as hidden
would promise rows that showing them could never produce.

Where a filter matches a change inside a folded branch, that branch SHALL
be shown for that reading.

#### Scenario: A finished cluster

- **WHEN** a root and every change that follows it are archived
- **THEN** the view does not draw them, and says how many branches it is
  hiding

#### Scenario: Showing them again

- **WHEN** the reader acts on that row
- **THEN** the folded branches are drawn, and the view says nothing is
  hidden

#### Scenario: A live change that follows an archived one

- **WHEN** an archived change is followed by a change that is not archived
- **THEN** both are drawn, folded away by nothing

#### Scenario: A finished branch something is waiting on

- **WHEN** every change in a branch is archived and a change that is not
  archived is blocked by one of them
- **THEN** that branch is drawn rather than folded

#### Scenario: What the count covers

- **WHEN** the workspace holds archived changes that state no relation
- **THEN** they are not counted as hidden, since the view was not drawing
  them

#### Scenario: A filter reaching into a folded branch

- **WHEN** a filter matches a change in a folded branch
- **THEN** that branch is shown for that reading, with the filter's message
  saying what was found
