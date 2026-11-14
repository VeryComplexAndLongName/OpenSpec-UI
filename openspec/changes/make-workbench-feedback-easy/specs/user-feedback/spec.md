# User feedback

## Purpose

Let users share a reviewable diagnostic report when Workbench cannot complete a run and help new users find prerequisites.

## ADDED Requirements

### Requirement: Feedback is a voluntary action

Workbench SHALL offer an issue draft link and a diagnostic preview after a failed run. The preview SHALL contain available version and platform metadata and a categorized failure. The report SHALL exclude workspace content and raw run output.

#### Scenario: A run fails
- **WHEN** the user opens the diagnostic preview for a failed run
- **THEN** it shows the allowed metadata and the user can copy its text
- **AND** opening the issue draft does not attach any report content

### Requirement: Workspace diagnosis is reachable before a run

VS Code SHALL offer a Workspace command that displays the existing diagnosis findings with their remedies.

#### Scenario: A prerequisite is missing
- **WHEN** the user opens Diagnose Workspace
- **THEN** the report shows available findings and their next steps
