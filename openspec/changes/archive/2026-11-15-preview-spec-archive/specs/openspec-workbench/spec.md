## ADDED Requirements

### Requirement: An operator can preview specification updates before archive

Both hosts SHALL offer Show Archive Preview for an active change. The preview SHALL identify the committed delta and the locally known default branch or explain when those commits cannot be resolved. It SHALL show the specification patch or the exact archive refusal. It SHALL report requirements changed since the common ancestor and requirements also named by another local active change branch. Opening the preview SHALL leave the user's index, files and refs unchanged.

#### Scenario: The archive would update a specification

- **WHEN** a committed delta applies cleanly to the locally known default branch
- **THEN** the preview displays the resulting specification patch.

#### Scenario: Another change modifies the same requirement

- **WHEN** another local active change branch includes the same capability and requirement
- **THEN** the preview names both the requirement and the other change.

#### Scenario: The archive CLI refuses a delta

- **WHEN** the isolated archive refuses the delta
- **THEN** the preview displays the refusal and does not write to the user's repository.
