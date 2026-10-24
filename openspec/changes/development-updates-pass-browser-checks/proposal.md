## Why

PR #926 updates axe and Playwright. The browser gate reports label-content-name-mismatch on Pipeline controls and EPIPE while encoding the tour. The quality-gates specification requires these checks to remain effective; disabling them would hide regressions.

## What Changes

- Include visible zoom and task text in their accessible names.
- Update the tour encoder to the bundled Playwright ffmpeg interface and preserve useful errors.
- Keep the dependency updates and verify the browser suite.
- Refresh cheerio's nested undici to 6.29.1 for GHSA-xjj6-f33q-929c, which also affects this branch.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- quality-gates: browser checks remain compatible with updated development tools.

## Impact

Pipeline accessibility, its regression tests, and tour recording fixtures. No command/event protocol changes.
