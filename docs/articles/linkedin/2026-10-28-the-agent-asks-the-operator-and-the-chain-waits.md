# LinkedIn post: the-agent-asks-the-operator-and-the-chain-waits

Publish between 2026-10-28 and 2026-10-30: the site page is live from 2026-10-25,
and this goes out three to five days after it, not on the same day.
Attach: `docs/articles/site/the-agent-asks-the-operator-and-the-chain-waits/cover.jpg`.
Put the repository link in the first comment, not in the post.

## Post

An agent ended its run with four decisions it needed from the operator, and
the product offered no way to answer them. A chain would have gone on to the
next stage with them open.

The fix: questions are caught, the run stops and waits, nothing goes on
without an answer. Answers are kept in the change's `decisions.md` and in the
audit log, and a question is a hard stop regardless of autonomy level.

Questions are answered from the card, the AI panel, the Human-Only Inbox and
the CLI.

Full write-up: https://openspec-ui.dev/articles/the-agent-asks-the-operator-and-the-chain-waits/

Have you had an agent ask a question that nobody could answer?

## First comment

The code, the issues and the extension: https://github.com/VeryComplexAndLongName/OpenSpec-UI
(The product is OpenSpec Workbench. The repository and packages are still called OpenSpec-UI.)
