# The docs catch up to 0.55

## Why

The documentation stopped describing the product around 0.44:
- README's CI CLI section says the CLI "has one command, `validate`". Its
  usage lists thirteen commands, seventeen forms counting subcommands, and
  `status`, `stop` and `enrol` appear in no document.
- No README shows the Pipeline: a card's state, its tasks, Start and Stop,
  or the Pipeline panel in VS Code. The Changes tree's state word is not
  mentioned either.
- README's "Status" links an article on 0.44 → 0.50 that was never
  published. The last published one is 0.40 → 0.44.

The owner asked for the documents to show the new features with pictures,
and for a LinkedIn Article from 0.44 to the latest release, 0.56, with a
teaser.

## What Changes

- **New pictures, each taken by a spec:**
  - `standalone/pipeline-stop.png`: a card whose run was asked to stop, with
    the reason;
  - `extension/pipeline-panel.png`: the Pipeline panel in the editor;
  - `extension/changes-standings.png`: the Changes tree with each change's
    state word.
- **README** (root): the CI CLI section lists every command, with `status`,
  `stop` and `enrol` explained. "Status" links the new article.
- **`packages/server/README.md`** gains a Pipeline section with
  `pipeline.png` and `pipeline-stop.png`.
- **`packages/extension/README.md`** gains the Pipeline panel, the state
  word in the Changes tree, and asking a run to stop, with their pictures.
- **`docs/how-to/stop-a-run.md`**: stop a run held here, one held
  elsewhere, and one from a terminal.
- **The article and its teaser**, in `docs/articles/`:
  - a LinkedIn Article on `openspec-ui-vscode` 0.44.0 → 0.56.0, the latest
    release, under 125,000 characters, with a 1920 × 1080 cover;
  - a teaser post, under 3,000 characters.

  The article's pictures are the documentation's own, taken by specs. The
  cover is an illustration, not a picture of the product, so it lives
  beside the article rather than under `docs/images/`.

## Capabilities

### Added

- `openspec-workbench`: an article's pictures of the product are the
  documentation's captured pictures.

## Impact

- `README.md`, `packages/server/README.md`, `packages/extension/README.md`,
  and a new `docs/how-to/stop-a-run.md`.
- `packages/server/e2e/pipeline.spec.ts` and
  `packages/extension/e2e/editor-screenshots.spec.ts` gain captures. The
  editor fixture gains what the new pictures need.
- New files under `docs/images/` and `docs/articles/`.
- No product code changes, so there is no changeset.

## Out of scope

- **Metro UI.** It comes after this change and retakes every picture.
- **Publishing** the article or the teaser. The owner publishes them.
- **The unpublished 0.44 → 0.50 article and teaser.** They stay as written;
  the new article is the one README links.
