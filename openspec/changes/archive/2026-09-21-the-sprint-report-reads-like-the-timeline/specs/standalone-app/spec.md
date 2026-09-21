## ADDED Requirements

### Requirement: The sprint report's tab opens from the click

The standalone SHALL open the sprint report's tab from the click that asks
for it, before it sends the request. The tab SHALL say how many changes are
being read, and SHALL become the report when the answer comes, or show why
the report could not be made.

A browser lets a page open a tab only while it is answering a click. Opened
after a request that takes a minute, the tab is refused, and the wait ends
in nothing.

#### Scenario: The report takes a while

- **WHEN** the user asks for a sprint report and the server has not
  answered yet
- **THEN** the report's tab is already open and says how many changes it
  is reading
- **AND** the button says "Generating..." and cannot be pressed again

#### Scenario: The report arrives

- **WHEN** the server answers with the report
- **THEN** the same tab shows the report, with its print button

#### Scenario: The report fails

- **WHEN** the server answers with an error
- **THEN** the tab shows the error, and the Timeline tab says it too
