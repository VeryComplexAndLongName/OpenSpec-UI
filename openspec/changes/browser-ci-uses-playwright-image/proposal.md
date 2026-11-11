## Why

The standalone browser check on PR #954 failed before tests ran. Playwright's dependency installer could not resolve the Ubuntu package mirrors on multiple GitHub-hosted runners. This repeats the installation risk documented in the browser-install-ignores-foreign-repos change, now affecting the repositories that actually supply the dependencies.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ci-cli`: Run the standalone browser suite in Playwright's official image for the installed test version, with Chromium and its libraries already present.

## Impact

Only the standalone browser job's environment changes. The workflow still installs the locked project dependencies, runs the browser and accessibility suite, and uploads its diagnostics on failure.

## Changelog

No public delivery is affected. The change is limited to browser test provisioning in GitHub Actions.
