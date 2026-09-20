## ADDED Requirements

### Requirement: The sprint report is a page of the product

`packages/webui` SHALL render a sprint summary as one complete HTML
document, drawn with the same stylesheets every other surface of this
product is drawn with, and carrying them inline so that the document can
be opened from a file with no server.

The document SHALL state the range, and for each change its author, its
dates, its task counts and its summary excerpt, and the totals with the
per-author breakdown - every figure the summary carries.

Every value that comes from the repository SHALL be escaped: a change
name, a commit author or a summary excerpt is text, never markup.

The document SHALL carry print rules, under which it has white paper, no
shadows, a page margin, and no single change split across a page break.

#### Scenario: A report opened from a file

- **WHEN** the document is opened with no server running
- **THEN** it is drawn in the product's own look, needing nothing else

#### Scenario: A change whose name contains markup

- **WHEN** a change's name, or an author's, contains characters that
  would be read as markup
- **THEN** they appear as the characters they are, and no markup is
  introduced
