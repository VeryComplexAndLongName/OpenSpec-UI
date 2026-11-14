# Make Workbench Feedback Easy

## Why

The product handles failed runs locally, as described in ADR 0001. A user who wants help currently has to find the issue tracker and assemble diagnostics by hand.

## What Changes

- Offer **Send Feedback** in VS Code and standalone.
- Offer a diagnostic preview after a failed run and let the user copy it or open a GitHub issue draft.
- Show a Workspace command to diagnose common first-run prerequisites.

## Capabilities

### New Capabilities

- `user-feedback` provides voluntary reports and first-run diagnosis.

### Modified Capabilities

- None.

## Impact

The reports use the existing local detectors. The user controls what is submitted on GitHub.

## Changelog

### VS Code extension and standalone

- Open **Send Feedback** to start a GitHub issue draft. After a failed run, preview and copy a short diagnostic report with the Workbench version, platform and error category.

### VS Code extension

- Use **Diagnose Workspace** from the Workspace view to see prerequisites that need attention and the next steps.
