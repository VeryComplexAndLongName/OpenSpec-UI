## Why

The agent running the article campaign asked, through the owner on
2026-09-20, for a README that answers three questions in thirty seconds -
what this is, what it looks like, how to install it - and for the product
to be called **OpenSpec Workbench** in prose. The owner agreed and asked
for it as an OpenSpec change.

Measured against the file as it stands:

- **What it is** takes a paragraph of clauses to say, and never says the
  one thing that distinguishes it: this runs the agents and lets a person
  supervise them.
- **What it looks like** is the picture on line 21, under three paragraphs
  and a link to an article. A reader who scrolls past it sees no product.
- **How to install it** is on line 71, inside `Local Delivery Modes`, and
  it is **wrong**: it tells the reader to download a `.vsix` from a GitHub
  Release and use "Install from VSIX". The extension has been on the
  Visual Studio Marketplace since 0.63.0, and the README's only mention of
  the Marketplace is line 298, about the internal publishing workflow.

The name is not a rename. `packages/extension`'s `displayName` has been
**OpenSpec Workbench** since it was published, so that is already what a
reader sees in the Marketplace; the README is the document out of step.
Nothing else moves: not the repository, the npm packages, `openspec-ui-cli`,
the extension id or publisher, the configuration keys, `openspec-ui.dev`,
the ADRs, the archive or the CHANGELOGs. A line in the README says so, so
that somebody who reads the name can still find the code.

## What Changes

- **`README.md` opens as a shopfront**: the name, one sentence saying it
  runs and supervises coding agents on OpenSpec changes, a picture, and
  installation in two commands with the Marketplace link. Then the line
  saying the repository and the packages are still called OpenSpec-UI.
- **The installation path is corrected.** The Marketplace is how a reader
  installs the extension; the `.vsix` from a Release becomes the offline
  path it is, further down.
- **A section, `How this differs from the other OpenSpec viewers`**,
  beside the existing `Why not just openspec view` and
  `How this differs from BMAD`. It describes three of them in their own
  published words, with the date those words were read, and states the
  difference as a fact about this product: they show and review changes;
  this one also starts a run, says what it is doing, and lets a person
  stop it.
- **The demo recording's place is left ready**, not faked: the first
  picture is the capture that exists today, and the change that adds the
  recording swaps it.

## Capabilities

### New Capabilities

(none - documentation only, no behavior change)

### Modified Capabilities

(none)

## Impact

- `README.md` only.
- No `packages/*` change and no changeset.

## Explicitly out of scope

- **Renaming anything that is not prose.** Named in the proposal above,
  and stated in the README itself.
- **The Marketplace page** (`packages/extension/README.md`), which already
  opens as OpenSpec Workbench and describes the product correctly.
- **The demo recording.** The article agent produces it and the script
  that re-records it; `an-article-directory-per-venue` made the picture
  check able to govern it.
- **Any claim about another project that its own pages do not make.** The
  new section quotes and dates, as the BMAD section does.
