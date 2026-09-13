## ADDED Requirements

### Requirement: A change's harness settings open in a panel of their own

Configuring the harness for a change SHALL open a panel for that change,
titled with the change's name. Configuring the same change again SHALL show
that panel rather than open another.

The global harness settings SHALL open in a panel of their own.

The process dashboard SHALL NOT host the harness settings.

#### Scenario: Configuring a change

- **WHEN** the command is run on a change in the Changes tree
- **THEN** a panel titled with that change's name shows that change's
  settings, already loaded

#### Scenario: Configuring it again

- **WHEN** the command is run on the same change while its panel is open
- **THEN** that panel is shown, and no second panel opens
