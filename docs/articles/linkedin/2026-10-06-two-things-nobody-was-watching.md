# LinkedIn post: two things nobody was watching

## Post

Neither of these bugs was code doing the wrong thing. Both were something already true that nothing had been asked to look at.

First: a working directory removal that fails halfway leaves the files that could not be deleted, and every later cleanup pass only looks at directories git still lists - which this one no longer was. A 54 MB leftover (a downloaded copy of VS Code, held open by a test run at the exact wrong moment) sat there for a full day before anyone noticed. The fix: stop asking "is this directory empty" and start asking "is this ours" - a shell named after a change we know, with no .git of its own, gets cleared regardless of what's inside it.

Second: DeepSeek's CLI reports no cost, no tokens, nothing you can put a spending ceiling on. But it does send one number the whole time: how full its context window is. Nobody was reading it. Now a ceiling on that number stops a run mid-stage before it starts paying the tax of re-sending its whole conversation on every turn - cancelled, not failed, the same honest distinction this project already makes for time limits.

Full write-up, with the live test messages: https://openspec-ui.dev/articles/two-things-nobody-was-watching/

What's a number your own tooling has been sending you the whole time, that nothing was reading?

## First comment

The code, the issues and the extension: https://github.com/VeryComplexAndLongName/OpenSpec-UI
(The product is OpenSpec Workbench. The repository and packages are still called OpenSpec-UI.)

---

## Not for posting

Everything below the line stays out of the post and the comment.

### When, and what to attach

Publish on 2026-10-10: a few days after the site page (2026-10-06), not the same day.
No image is required; a bare link produces an auto-generated preview card from the cover.
Put the repository link in the first comment, not in the post.

### Where each claim comes from

- The leftover shell and the fix: the archived change
  `the-sweep-comes-back-for-what-it-left`.
- The context ceiling and the live cancellation message: the archived
  change `a-run-can-outgrow-its-context`.
- The article itself: `docs/articles/site/2026-10-06-two-things-nobody-was-watching.md`.
