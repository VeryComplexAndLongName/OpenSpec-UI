## Why

ADR 0033's third step. With the frame in place (#544), the owner compared the
running summary with the approved mockup on 2026-09-16 and found two different
sites: the mockup "neat and beautiful", the shell "a drunk typesetter". The
summary still draws everything inside one large panel; its change and archive
rows are browser-default grey buttons with raw ISO timestamps; the waiting
list, the root line, the tiles and the lists follow one another without the
mockup's panels. The owner's instruction: it has to look like the mockup.

## What Changes

- **The summary is laid out as the mockup's first screen**, in panels on the
  page rather than inside one:
  - four tiles — Changes, Archived, Specs, Waiting on you — each with a note
    under its figure: "active", "latest <day>", "<n> requirements", and how
    many items wait on a person;
  - a **Changes** panel with its search in the head and one row per change:
    the name, the state as a badge, a progress bar with "done / total", and
    the day it was last modified;
  - beside each other, a **Specs** panel listing the six specs with the most
    requirements, and a **Recently archived** panel listing the five latest,
    each opening to the full list;
  - **Refresh** in the page head, where Load summary was.
- **What the mockup does not draw is kept, below it**, in the same panels:
  the full archive with its search, every spec, and "Waiting on somebody"
  with its run controls and enrolment requests. Where the workspace was read
  from is the fine print under the Changes panel.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `standalone-app`: the OpenSpec view summary is laid out as ADR 0033's
  mockup lays it out.

## Impact

- `packages/webui`: `src/components/PageHead.tsx` (an action),
  `src/components/ChangesList.tsx`, `src/components/ArchiveList.tsx`,
  `src/components/SummaryPanels.tsx` (new), `src/summary-figures.ts` (new),
  `src/standalone-entry.tsx`, `src/shell-ui.ts`, and their tests.
- `packages/server/e2e`: specs that press Load summary press the page head's
  Refresh; the summary is captured beside the mockup.
