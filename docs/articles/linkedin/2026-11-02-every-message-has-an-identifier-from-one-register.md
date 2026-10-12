# LinkedIn post: every-message-has-an-identifier-from-one-register

Publish between 2026-11-02 and 2026-11-04: the site page is live from 2026-10-30,
and this goes out three to five days after it, not on the same day.
Attach: `docs/articles/site/every-message-has-an-identifier-from-one-register/cover.jpg`.
Put the repository link in the first comment, not in the post.

## Post

What the product says to a person - a failure's reason, a refusal, a CLI
error - was written where it is said, as a sentence. Nobody could look up a
message they saw.

A new register says every message as `<level> OSW-<GROUP>-<NNN>: <message>`,
from one place. `docs/messages.md` is generated from it: search for the code
you saw and find what it means, why it was said, and what to do.

Events and the CLI's JSON carry `code` beside the words. The words themselves
do not change - the goal is traceability, not rewriting.

Full write-up: https://openspec-ui.dev/articles/every-message-has-an-identifier-from-one-register/

What is the one error message you wish you could look up by code?

## First comment

The code, the issues and the extension: https://github.com/VeryComplexAndLongName/OpenSpec-UI
(The product is OpenSpec Workbench. The repository and packages are still called OpenSpec-UI.)
