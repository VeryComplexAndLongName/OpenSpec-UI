## Why

The agent writing the article campaign is about to give `docs/articles/`
one subdirectory per venue - `linkedin/`, `devto/`, `hackernoon/`,
`reddit/`, `community/`, `shared/` - and asked for two things through the
owner on 2026-09-20. Checking them found that one is already true, one is
a real hole, and a third nobody asked about is a hole in the same wall.

**Already true.** `check-articles.mjs` accepts a picture anywhere under
`docs/articles/`, at any depth, so a cover in `shared/` or beside its
article in `linkedin/` passes today.

**The hole.** That same check reads only the `.md` files lying *directly*
in `docs/articles/`. The moment the articles move into subdirectories it
will scan nothing at all - and pass, silently, for ever. A check that
passes because it stopped looking is worse than no check.

**The same hole, one wall along.** The agent asked for the rule "pictures
come from the capture specs, never hand-made" to be written into the
runbook, which is right, and which the picture check already enforces for
`docs/images/`. But `check-screenshots.mjs` knows only `.png`: it neither
lists nor requires a `.gif`. The demo recording that agent is about to
produce would land in `docs/images/` outside every rule this repository
has about pictures. Writing the rule down while the check cannot see the
file is how a rule becomes decoration.

## What Changes

- `scripts/check-articles.mjs` walks `docs/articles/` to any depth, so a
  venue subdirectory is checked like the root, and names an article by its
  path so a message says which venue's it is.
- `scripts/check-screenshots.mjs` covers `.gif` beside `.png`, both in
  what it finds under `docs/images/` and in what it reads a capture as
  producing. A recorded demo is then governed exactly as a screenshot is.
- `openspec/README.md` says, under the editorial section, that a picture
  of the product in an article comes from a capture, never from a
  hand-taken screenshot, and why: a hand-taken one carries whatever was on
  the screen, which has already meant an account name in a published
  picture.

## Capabilities

### New Capabilities

(none - two lint scripts and a runbook section)

### Modified Capabilities

(none)

## Impact

- `scripts/check-articles.mjs`, `scripts/check-screenshots.mjs` and their
  tests; `openspec/README.md`.
- No `packages/*` change and no changeset.

## Explicitly out of scope

- **Creating the venue subdirectories.** They are the article agent's, and
  making them here would be this repository guessing at an editorial
  layout.
- **Recording the demo.** That agent produces the file and the script that
  re-records it; what this change does is make the rules able to see it.
- **Where the demo is linked from.** The README's own change decides that.
