# LinkedIn post: a viewer is not a cockpit

Publish between 2026-09-23 and 2026-09-25: the site page is live from 2026-09-20, and this goes out three to five days after it, not on the same day.
Attach: `docs/articles/site/a-viewer-is-not-a-cockpit/cover.jpg`.
Put the repository link in the first comment, not in the post.

## Post

A run that hangs tells you less than one that fails.

An agent asked for permission in the middle of a chain. Nothing in the system could answer. The run did not fail and did not time out. It waited.

That was one of three mistakes I made building OpenSpec Workbench, and they taught the same lesson: showing an OpenSpec change is a solved problem. Supervising the agent that builds it is not.

- A limit that cannot act reads as protection. A spending ceiling counts only what an agent reports, and six of the ten supported agents report nothing.
- Silence is not a diagnosis. A quiet agent might be thinking or might be hung, and from outside they look the same. So the tool never says "stuck".

A cockpit has to say what it will do, say what it is doing, stop where the work is sound, and say why it stopped. The article, including what the tool still cannot do: https://openspec-ui.dev/articles/a-viewer-is-not-a-cockpit/

Have you had an agent wait forever on something nobody could answer?

## First comment

The code, the issues and the extension: https://github.com/VeryComplexAndLongName/OpenSpec-UI
(The product is OpenSpec Workbench. The repository and packages are still called OpenSpec-UI.)

## Where each claim comes from

Not for posting.

- The permission request that waited, and that a chain run fully autonomously now
  fails the stage with a reason: `docs/articles/2026-09-09-what-a-run-tells-you-0.40-to-0.44.md`, 0.40.
- Six of the ten agents report no usage, and that a spending ceiling counts only what
  an agent reports: `LIMITS.md`, "At a glance" and "Which agents report usage".
- That a status never says "stuck", and that a stop is signed and needs a reason: README, "CI CLI" (`status`, `stop`).
- The article itself: `docs/articles/site/2026-09-20-a-viewer-is-not-a-cockpit.md`.