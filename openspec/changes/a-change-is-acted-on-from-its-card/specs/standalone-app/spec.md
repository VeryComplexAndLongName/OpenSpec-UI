## ADDED Requirements

### Requirement: A card's actions run in the standalone app

The standalone app's cards SHALL offer the same actions as the editor's,
and SHALL perform each: the server SHALL run it in the directory the change
is worked in, found from the repository's worktree list and never from the
request, and SHALL answer with what to read, what was done, or the
relations to pick from. An action that asks first - Send Message, Stop Run,
Add Relation, Remove Relation - SHALL ask in the page before anything is
sent. Configure Change Harness SHALL open the change's harness settings in
the page, read and written where the change is worked; Open Change Copy
SHALL open the change's tasks page.

Embedded in the editor, a card SHALL hand its action to the editor, which
runs the command a Changes row runs.

#### Scenario: Show Ancestry in the browser

- **WHEN** a person presses Show Ancestry on a card in the standalone app
- **THEN** the changes it follows are listed over the Pipeline, read where
  the change is worked

#### Scenario: Adding a relation

- **WHEN** a person presses Add Relation on a card
- **THEN** the page offers the relation keys and the other changes, and
  writes only the relation picked
