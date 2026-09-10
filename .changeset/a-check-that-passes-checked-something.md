---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"@openspec-ui/server": patch
---

A check that passes checked something.

The standalone shell's "Waiting on somebody" block now says when the
inbox could not be read, and why, in the place the count would have been
— a failed read used to remove the block, which is what a block that has
not loaded yet looks like.

A webview bridge request that gets no reply now fails after ten seconds
with the operation's name, instead of leaving the Harness Settings form
on "Working..." with its save button disabled and nothing said.

Behind those: the changeset lint reads bare and single-quoted package
names as well as double-quoted ones and refuses a frontmatter line it
cannot read; the browser test named for a project's archiving history
asserts the counts that history produced; and the fixtures that build git
histories run git with `commit.gpgsign` and `core.hooksPath` of their own,
so they no longer fail on a machine whose global configuration sets
either.
