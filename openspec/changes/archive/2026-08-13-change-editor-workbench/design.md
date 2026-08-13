## Context

Direct OpenSpec mode removed user-facing AI orchestration and made the UI
command-centric. Authoring changes is still possible through terminal and file
editors, but there is no focused in-app flow.

## Decisions

- Introduce a standalone Change Editor section in the browser shell.
- Keep the editor server-driven using explicit REST endpoints:
  - list changes
  - create change
  - read markdown files
  - save markdown files
- Add a guided OpenSpec initialization path in standalone mode:
  - detect whether OpenSpec artifacts already exist
  - if artifacts are missing, offer initialization
  - require explicit AI tools selection for `openspec init --tools`
  - hide initialization action once artifacts exist
- Use markdown as the source of truth and avoid custom proprietary schemas.
- Keep this iteration scoped to standalone/local-server mode.

## Trade-offs

- Extension bridge mode does not yet expose the same editor UX.
- This MVP prefers practical authoring speed over advanced markdown features.
