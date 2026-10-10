## ADDED Requirements

### Requirement: A card the editor asks for is shown

The Pipeline SHALL show the card of a change its host asks for: scrolled
into the middle of sight, marked for a moment and given the focus. A card
asked for before it is drawn SHALL be shown once it is, and a change that
has no card SHALL mark nothing.

In the editor, a request made while the Pipeline's page is loading SHALL
wait until the page says it runs, and SHALL be shown once. This SHALL hold
for the Pipeline drawn by the extension and for the standalone page the
extension embeds, where the request SHALL be passed to that page's own
origin alone.

#### Scenario: A card already drawn

- **WHEN** the host asks for the card of a change the Pipeline draws
- **THEN** the card is scrolled to, marked and focused, and no other card is
  marked

#### Scenario: A Pipeline still opening

- **WHEN** the host asks for a card as it opens the Pipeline
- **THEN** the card is shown once the page runs and its cards are drawn,
  and not again when the page is shown later
