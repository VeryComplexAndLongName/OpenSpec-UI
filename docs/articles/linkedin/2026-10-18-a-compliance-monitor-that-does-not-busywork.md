# LinkedIn post: a-compliance-monitor-that-does-not-busywork

Publish between 2026-10-18 and 2026-10-20: the site page is live from 2026-10-15,
and this goes out three to five days after it, not on the same day.
Attach: `docs/articles/site/a-compliance-monitor-that-does-not-busywork/cover.jpg`.
Put the repository link in the first comment, not in the post.

## Post

OpenSpec Workbench initializes repositories and runs agents on changes. It
did not, until now, check that its own runtime files are ignored, or that its
repository rules are consistent.

A compliance monitor has been added to the shared core. Three things matter:
it keeps a versioned catalogue of rules, it runs only when the host reports
idle, and it reports findings without moving or deleting anything.

Each rule accepts `autorepair`, `advice` or `none`. The monitor runs one
bounded batch only after the host reports idle and no mutating run is active.

A companion capability, the process ledger, records a snapshot for every
spawned process and flags orphans as read-only findings. Compliance explains;
recovery acts.

Full write-up: https://openspec-ui.dev/articles/a-compliance-monitor-that-does-not-busywork/

Have you had a tool that checked its own housekeeping?

## First comment

The code, the issues and the extension: https://github.com/VeryComplexAndLongName/OpenSpec-UI
(The product is OpenSpec Workbench. The repository and packages are still called OpenSpec-UI.)
