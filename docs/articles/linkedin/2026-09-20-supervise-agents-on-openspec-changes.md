# LinkedIn post: supervise agents on OpenSpec changes

Publish after the site page is live (see the site article of the same name).
Attach: `docs/images/standalone/tour.gif` (or `tour.webm` for a video upload).
Put the repository link in the first comment, not in the post.

## Post

You can watch an agent write code. Can you watch it build against your spec?

OpenSpec gives a coding agent something to build from: a proposal, a design, a task list. What it does not give you is a way to see the agent while it works, or to stop it where its work is sound.

I read the other OpenSpec interfaces on 2026-09-20. They show a change's documents and where it stands, and they do it well. None of the three I compared starts an agent.

OpenSpec Workbench does. From one card in the Pipeline you can:

- start a run through propose, review, apply, verify, archive and git, with the agent CLI you pick for each stage
- see what the run last said it was doing, and how long ago. It never calls a run "stuck": a long turn and a hang look the same, and that call stays yours
- answer a checkpoint, or ask the run to stop, with a reason

A limit, stated plainly: Claude CLI, Copilot CLI and DeepSeek CLI have been run against the real binaries. Codex and Gemini never have, and the article says so.

The tour and the details are here: https://openspec-ui.dev/articles/supervise-agents-on-openspec-changes/

If you run agents on OpenSpec changes, I would like to know what you would want to see on that card.

## First comment

The code, the issues and the extension: https://github.com/VeryComplexAndLongName/OpenSpec-UI
(The product is OpenSpec Workbench. The repository and packages are still called OpenSpec-UI.)

## Where each claim comes from

Not for posting.

- The other viewers, and that none of the three starts an agent, read on
  2026-09-20: README, "How this differs from the other OpenSpec viewers".
- The stages, the card's actions, the status record and that a run is never
  called stuck: README, "Agentic Harness" and "CI CLI" (`status`, `stop`).
- Which agents have been run against a real binary: README, "Agent Selection".
- The article itself: `docs/articles/site/2026-09-20-supervise-agents-on-openspec-changes.md`.