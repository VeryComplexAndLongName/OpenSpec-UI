## Context

`docs/images/standalone` holds twenty-five pictures, taken by four specs
in `packages/server/e2e`; `docs/images/extension` holds thirteen, taken by
`packages/extension/e2e/editor-screenshots.spec.ts`, which drives the real
editor through Playwright's Electron support.
`scripts/check-screenshots.mjs` reads the capture sources and fails on a
picture nothing takes.

Running either suite rewrites its pictures. That is what makes a change
that touches a screen able to commit the new one - and what makes a
change that touches nothing visible produce a diff of twenty-five binary
files that its author restores with `git checkout --`. Both happened.

## Goals / Non-Goals

**Goals:**

- Every committed picture is the one its capture takes from the product as
  it is now.
- A screen a reader is sent to look at has a picture of it.
- The documents say what their pictures actually show.
- The next change that redraws a screen is told, by the spec, to bring its
  picture with it.

**Non-Goals:**

- **A pixel comparison in CI.** Below, with the reason.
- **Pictures of the editor's own quick-picks in the Marketplace README
  beyond what the capture can reach.** Where the capture cannot hold a
  quick-pick open, the document stands without that picture rather than
  carrying a hand-taken one.
- **Rewriting the documents.** Their prose is read against the new
  pictures and corrected where it disagrees; this is not the place to
  restructure them.

## Decisions

### The pictures are committed by the change that redraws the screen

Stated in the spec, so a review has something to hold a change to. The
mechanism already exists - the suites regenerate - and the missing part
was never a tool but a rule: the diff of twenty-five pictures is the
change's own output, not noise to be discarded before committing.

**Rejected: capturing on a schedule, into a commit by a bot.** It would
keep the pictures fresh and detach them from the change that made them
different, so nobody would ever review a picture against the change that
altered it - which is the one moment somebody knows what it should show.

### No pixel comparison gate

The obvious guard is a CI job that runs the captures and fails where the
result differs from what is committed. It cannot work here: the pictures
in git come from whichever machine last ran the suite, and font rendering
differs between this Windows machine and CI's Ubuntu runner by far more
than any threshold that would still catch a changed screen. A gate that
fails on every machine boundary teaches people to ignore it.

**Rejected: pinning the captures to CI.** Then no one could take a
picture while working on the screen, which is the moment the picture is
worth looking at.

### What gets a new capture

- **The Summary's "Left behind" panel.** The standalone fixture gains a
  directory the sweep clears and one it will not, so the panel draws with
  both lists rather than being absent.
- **A view narrowed by a filter**, in the editor, with its message
  visible - the message is the part a reader cannot guess.
- **The Change Graph folded**, with the "landed relations hidden" row.
- **A relation being stated**, as far as a capture can hold it: the
  pickers are quick-picks, and a quick-pick closes when the window loses
  focus, so the picture is taken with the pick open and nothing else
  touched.
- **The Changes view after a sweep**, saying what it cleared.

Each waits on the text that makes the picture worth having, as
`editor-screenshots.spec.ts` already insists: a picture of a pane that
had not loaded is green to every check and useless to a reader.

### The Marketplace page is read as a page, not as a folder

`packages/extension/README.md` is what somebody sees before installing.
Its pictures are checked in order, and its captions are corrected where
the screen has since gained something the caption does not mention. That
is the one document where a stale picture costs a reader something before
they have the product at all.

## Risks / Trade-offs

- **A binary diff nobody reads.** Thirty-eight pictures change at once,
  and a reviewer cannot diff a PNG. The change says which screens changed
  and why each picture differs; the owner's eye on the result is the
  human-only task.
- **Captures are slower than the checks around them.** The editor suite
  launches a real VS Code per picture group. It is already a separate
  script (`npm run test:pictures`), run by hand rather than in the pull
  request's gate, and that stays true.
- **A picture taken on Windows.** Fonts and window chrome are this
  machine's. The alternative is nobody taking them at all; the pictures
  have always been taken this way, and the documents do not claim a
  platform.
