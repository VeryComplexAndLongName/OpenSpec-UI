# Design

## Decisions

- Use 1600x1000 SVG files so each image is crisp in a LinkedIn post and can be
  edited without a raster export step.
- Use the existing dark VS Code-inspired visual language, with the repository's
  yellow accent for human attention and red for failed or misleading evidence.
- Render simplified product surfaces from verified labels and states in the
  existing extension and web UI rather than copying a screenshot with stale data.

### Rejected alternatives

- Reusing unrelated extension screenshots was rejected because they do not show
  the four scenes described by the teaser.
- Adding screenshot dependencies or a browser capture workflow was rejected
  because this editorial change needs stable assets, not a runtime feature.

## Non-Goals

- No application code, UI behavior, or package version changes.
- No update to the external Obsidian markdown file.
- No claim that the SVGs are live screenshots of a running instance.

## Risks / Trade-offs

The graphics are intentionally illustrative, so they should be presented as
editorial visuals rather than product screenshots. The fixed canvas is optimized
for the requested teaser and may need a separate crop for other social formats.