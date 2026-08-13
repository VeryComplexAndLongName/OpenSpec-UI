# Change: Add Release Quality Gates

## Why

The repository has comprehensive local scripts but no remote checks. A branch
can be merged without typechecking, tests, delivery builds, extension-host
integration, or package verification.

## What Changes

- Add GitHub Actions jobs for workspace validation and delivery builds.
- Run the VS Code Extension Development Host integration suite under Xvfb.
- Package and retain the VSIX artifact.
- Add dependency review and scheduled dependency updates.
- Provide one root verification command matching CI.

## Impact

- Affected spec: `release-quality`
- Affected areas: root scripts, GitHub Actions, dependency automation
- No runtime package contract changes
