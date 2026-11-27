## Why

Workspace diagnosis checks whether OpenSpec is installed. A project that
expects a particular CLI version and reviewed instructions cannot see when a
different machine uses mismatched inputs. ADR 0001 puts workspace checks in
Core so the VS Code and terminal diagnosis use the same evidence.

## What Changes

- Let a repository declare an expected OpenSpec version and instruction file
  fingerprints in `openspec/workbench-tools.json`.
- Report mismatches, missing files, and invalid declarations in the existing
  Diagnose Workspace report.

## Capabilities

### New

- `workspace-toolchain`: compare a team's declared versions and instructions
  with the current workspace.

### Modified

None.

## Changelog

Affected deliveries: VS Code extension and npm CLI.

- Diagnose Workspace reports a project-pinned OpenSpec version that does not
  match this machine and instruction files that differ from the project's
  declared fingerprints.
