## Why

Asked by the owner on 2026-09-24: the site's standard for pictures is PNG,
and no SVG. Written nowhere, it is a rule the publishing agent can only
remember, and it had not: an article in progress that day carried a
`diagram.svg` beside it.

A rule the writer must remember is a rule that holds until the first
article that forgets it. `docs/articles/` is exempt from the OpenSpec
change rule, so nobody reviews an article against a spec; what is checked
there is what `lint:articles` checks.

## What Changes

- `openspec/README.md`, in the editorial section the publishing agent
  works from: no SVG anywhere under `docs/articles/`; a drawing made as an
  SVG is rendered to PNG and only the PNG is committed.
- `scripts/check-articles.mjs` fails an `.svg` file anywhere under
  `docs/articles/`, whether an article links it or not, and a link to an
  SVG from an article, local or remote.

## Capabilities

### New Capabilities

(none - one lint script and a runbook section)

### Modified Capabilities

(none)

## Impact

- `scripts/check-articles.mjs` and its test; `openspec/README.md`.
- No `packages/*` change and no changeset.

## Explicitly out of scope

- **The pictures already there that are not PNG.** Seven covers are
  `.jpg` and the tour is a `.gif` and a `.webm`, all published. The owner
  chose on 2026-09-24 to forbid SVG only, and to leave those as they are.
- **`docs/images/`.** It holds only what the runs capture, all PNG or
  GIF, and `lint:screenshots` governs it.
- **The article in progress with a `diagram.svg`.** It is the publishing
  agent's, on its own branch; this check will tell it what to change.
