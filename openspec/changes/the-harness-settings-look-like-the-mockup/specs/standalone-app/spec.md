## ADDED Requirements

### Requirement: Harness Settings is laid out as ADR 0033's mockup

The standalone shell's Harness Settings tab SHALL present, in this order: the
named configurations as a segmented choice with a control that applies the
chosen one to the form and a description under them; what the configuration
cannot do, where there is anything, as a warning callout; and a settings
panel whose stages are rows of a table — number and name, agent, model,
effort and max cost — with the mechanical stages as rows that say they run
without an agent, followed by the autonomy level, the review gate and the
run budget side by side, and Save and Discard at its foot.

The page head SHALL offer the global file, showing what Save would write.

Nothing the tab offered before — custom agents and what is said about them,
the findings, the unsaved-changes note, where the file is saved — SHALL be
removed.

#### Scenario: The tab on a configured workspace

- **WHEN** Harness Settings is opened on a workspace whose global file names
  an agent for each configurable stage
- **THEN** each of propose, review, apply and verify is one row with its
  agent, model, effort and max cost, archive and git are rows that run
  mechanically, and the autonomy level, review gate and run budget are side
  by side under them

#### Scenario: The file

- **WHEN** the page head's file action is used
- **THEN** the JSON that Save would write is shown on the tab
