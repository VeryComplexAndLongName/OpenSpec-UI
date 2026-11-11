## 1. Browser test provisioning

- [x] Update `.github/workflows/quality.yml` to use the official Playwright image selected from the installed test version, while retaining the full test command and failure artifacts.
- [x] Validate this change with `openspec validate browser-ci-uses-playwright-image --strict`, parse the workflow YAML, and confirm the configured registry tag resolves for the lockfile version.
- [x] Confirm that no public delivery needs a changeset for this CI-only change.
