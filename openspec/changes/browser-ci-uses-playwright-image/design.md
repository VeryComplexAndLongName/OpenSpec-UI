## Context

The browser job installs Chromium with `playwright install --with-deps`, which invokes apt on every run. Removing the unused Google Chrome source addressed an earlier outage. A DNS failure for Ubuntu's own mirrors now stops the check before it can run.

## Non-Goals

- Changing the standalone application, test selection, accessibility rules, or branch protection.
- Changing the runtime pin or diagnostic artifact paths.

## Decisions

- Use the official Playwright Noble container for the browser job. It includes the browser build and the system dependencies Playwright expects. The quality job reads the installed `@playwright/test` version after `npm ci` and passes it to the browser job as an output. The tag follows the tested lockfile on dependency updates.
- Keep the pinned Node.js, npm, and OpenSpec setup, and the same full test command. Give Chromium the host IPC namespace on the dedicated GitHub-hosted runner, as recommended by Playwright for Docker.
- Run the suite as the image's unprivileged `pwuser`, after giving that user ownership of the CI checkout for the build and captures. The first container run used `root`, which the tour's privacy check mistook for a displayed account name because CSS contains `:root`.
- A fresh retry can recover a temporary DNS incident, but it keeps the runtime dependency on apt. Dropping `--with-deps` alone would rely on whichever libraries and fonts the runner already has. A manually pinned Playwright tag would make every lockfile upgrade require a second edit.

## Risks / Trade-offs

The job now depends on Microsoft Artifact Registry delivering the matching image. A missing image fails the required check before tests, so the workflow cannot silently pass with a mismatched browser. The full CI run verifies the container on the GitHub-hosted runner.
