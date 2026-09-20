## ADDED Requirements

### Requirement: The Timeline tab opens a sprint report for printing

The system SHALL offer, within the Timeline tab, a mode where the user
picks a date range and multiple active and/or archived changes, and then
opens the generated sprint report as a page, from which the browser's own
print prepares a PDF.

`POST /api/sprint-report` SHALL return that page as `text/html`.

#### Scenario: User generates a sprint report

- **WHEN** the user selects a date range and one or more changes in the
  Sprint report mode and asks for the report
- **THEN** the report opens as a page in the product's own look, and the
  browser's print is offered for it

#### Scenario: User has not selected a range or any changes

- **WHEN** the user attempts to generate a report without a complete
  date range or without selecting any change
- **THEN** the system reports what is missing rather than attempting
  to generate an empty or partial report

## REMOVED Requirements

### Requirement: The Timeline tab offers a downloadable sprint report

**Reason**: The report was drawn by a PDF library in a look this product
uses nowhere else, and that library was a dependency of `core` plus a
bundling special case for the extension. A browser renders HTML to PDF,
honours print rules and paginates, so the page is the product's own and
the PDF is one keystroke from it.

**Migration**: The behaviour is described by "The Timeline tab opens a
sprint report for printing": the same picker and the same figures, opened
as a page rather than downloaded as a file.
