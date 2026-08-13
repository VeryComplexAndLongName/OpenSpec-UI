## 1. Browser Harness

- [x] 1.1 Add Playwright and axe development dependencies and server test configuration.
- [x] 1.2 Start the real server with a temporary workspace and generated access token.
- [x] 1.3 Exercise Change Editor load/edit/save in Chromium.

## 2. Accessibility and CI

- [x] 2.1 Scan the loaded standalone workbench for serious and critical axe violations.
- [x] 2.2 Add a browser E2E job after the workspace quality job.
- [x] 2.3 Retain Playwright diagnostics when the browser job fails.

## 3. Verification

- [x] 3.1 Run the browser suite locally with managed Chromium.
- [x] 3.2 Run workspace verify/build and strict OpenSpec validation.
- [x] 3.3 Confirm the browser job passes on the pull request.