## ADDED Requirements

### Requirement: A column's cards stand in the order the viewer picks

The Pipeline SHALL stack the cards within each column of its picture in
one of three orders, picked with a Sort control beside the arrangement:

- **Name**, the default: names compared as a person reads them, digits as
  numbers and case aside, so "change-2" stands before "change-10";
- **Progress**: the change with the largest share of its tasks done first;
- **Recently changed**: the change worked on last first, by the later of
  its task list's last change and its last run's end, or, archived, by
  the day it was archived.

A card without the fact an order compares SHALL stand after the cards that
have it. Cards equal in an order, and cards without its fact, SHALL stand
in name order.

The order SHALL apply within every column of both arrangements, and in the
pictures of the other working directories. It SHALL NOT move a card to
another column.

The order picked SHALL be kept with the zoom and the arrangement, and an
order the view does not know SHALL be read as Name.

Names compared as strings put "change-10" before "change-2", and a person
who numbers changes to find them faster found the column out of order.

#### Scenario: Numbered names

- **WHEN** a column holds "change-10", "change-2" and "change-1"
- **THEN** they stand as change-1, change-2, change-10

#### Scenario: By progress

- **WHEN** the viewer picks Progress, and one change has four of five
  tasks done, another one of five, and a third has no task list
- **THEN** the four-of-five change stands first and the one without a task
  list last

#### Scenario: By what was worked on last

- **WHEN** the viewer picks Recently changed, and one change's task list
  changed today while another's last run ended days ago
- **THEN** the change whose task list changed today stands first

#### Scenario: The order is kept

- **WHEN** the viewer picks Recently changed and opens the Pipeline again
- **THEN** the Sort control reads Recently changed and the columns stand in
  that order
