## Why

Static HTTP and DOM-unit tests do not execute the standalone bundle. They can
pass while browser startup, authentication wiring, user workflows, or semantic
accessibility are broken.

## What Changes

- Add Playwright coverage for the built standalone application in Chromium.
- Exercise an authenticated Change Editor load and save journey against a real server.
- Scan the loaded workbench with axe and fail on serious accessibility violations.
- Give the Change Editor selector an accessible name identified by the new scan.
- Add the browser suite as a required CI job after the workspace quality gate.

## Impact

- `packages/server`: browser test configuration and end-to-end suite.
- `packages/webui`: accessible Change Editor selector naming.
- `.github/workflows/quality.yml`: Chromium installation and browser quality job.
- Root lockfile: development-only browser testing dependencies.