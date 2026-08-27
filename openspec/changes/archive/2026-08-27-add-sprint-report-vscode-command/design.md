## Context

Researched directly against this codebase before writing any code.
`packages/extension/src/commands.ts` already has every building block
this command needs except the date-range prompt and the save/open
flow: `pickChangesForTimeline` (multi-select picker, used unchanged),
and `buildSprintReport`/`renderSprintReportPdf` (from
`add-sprint-report-pdf`, already exported by `@openspec-ui/core`'s
Node-only barrel). No prior command in this extension uses
`showSaveDialog`/`workspace.fs.writeFile`/`env.openExternal` — those
are new, standard VS Code APIs, not a gap in an existing pattern.

Critically, `add-sprint-report-pdf` (PR #96) already discovered and
fixed a real bundling hazard: esbuild's CJS bundle of the extension
host could not shim `pdfkit`'s ESM build's `import.meta.url`, and
crashed *all* extension activation the moment `@openspec-ui/core`'s
barrel made `pdfkit` reachable — even though nothing called it yet.
The fix (`packages/extension/scripts/build-options.mjs`, an `alias`
mapping `pdfkit` to its own CommonJS build at bundle time) was verified
by loading the rebuilt `dist/extension.js` in plain Node with a
stubbed `vscode` module and confirming activation no longer throws.
This change is the first to actually call `renderSprintReportPdf` from
within the bundled extension, so it re-verifies that fix under real
use, not just under activation.

## Goals / Non-Goals

**Goals:**
- Match `showAllChangesTimeline`'s established shape exactly:
  Command Palette only, `pickChangesForTimeline` reused unchanged,
  errors reported via the existing `showCommandError` helper.
- A real user-specified sprint start/end date, per the original
  request (the user explicitly asked to set the sprint's start and end
  dates) — not an auto-derived range like `computeDefaultRange`.
- No server/REST dependency for this command — direct in-process core
  calls, per ADR-0001.

**Non-Goals:**
- Not a tree-item context-menu entry — a sprint report spans multiple
  changes by nature (like the comparison timeline), so it has no single
  natural tree item to attach to.
- Not a native date picker — VS Code's own prompt UI has none;
  validated free-text `YYYY-MM-DD` input is standard for this kind of
  extension.
- Not a rebuild of `add-sprint-report-pdf`'s core logic — this change
  is purely a new UI entry point onto already-shipped, already-tested
  `buildSprintReport`/`renderSprintReportPdf`.

## Decisions

### Direct core calls, not the optional local server's REST endpoint

`packages/extension` already imports `@openspec-ui/core` directly for
every other command (`showChangeTimeline`, `showAllChangesTimeline`,
etc.); the optional local server (`optional-server.ts`) exists only to
embed the standalone webview shell, not as a required dependency for
core operations. **Rejected**: routing through `POST
/api/sprint-report` (the endpoint `add-sprint-report-pdf` added to
`packages/server`) — this would make the command depend on the
optional server being started, and would contradict ADR-0001's
"extension: direct import ... as the primary mode" decision without a
new reason to revisit it.

### Two validated `showInputBox` prompts for the date range

**Rejected**: reusing `computeDefaultRange` (the multi-change
timeline's auto-derived range) — that function exists specifically
*because* no user-specified range is needed there; this command's
whole premise is the opposite (the user explicitly asked to set sprint
start/end dates). A single combined prompt ("start,end") was also
considered and rejected: two prompts let `showInputBox`'s
`validateInput` give a specific, per-field error message rather than
parsing a combined string and guessing which half was wrong.

### `showSaveDialog` + `workspace.fs.writeFile`, not a fixed output path

**Rejected**: writing the PDF straight to a fixed location (e.g. the
workspace root) without asking — sprint reports are typically shared
outside the repository (attached to an email, a chat message), so
letting the user pick the destination and filename via the standard
VS Code "export" pattern (`showSaveDialog`) is both more useful and
more conventional than silently dropping a file into the workspace.

### "Open" action uses `vscode.env.openExternal`, not "reveal in file explorer"

Launches the OS's default PDF viewer directly from the confirmation
message's action button — one click to actually see the report, versus
"reveal in file explorer" which requires a second manual open.

## Risks / Trade-offs

- **[Risk]** The `pdfkit`/esbuild bundling hazard from
  `add-sprint-report-pdf` (see Context) is exactly the kind of failure
  that a plain unit test suite (which mocks `@openspec-ui/core`
  entirely) cannot catch — it only manifests in the real bundled
  `dist/extension.js`. → **Mitigation**: after implementing, rebuild
  `dist/extension.js` and load it in plain Node with a stubbed
  `vscode` module (the same technique that caught and verified the fix
  for PR #96), confirming both that activation succeeds and that
  `pdfkit`'s code is genuinely inlined (not left as a runtime
  `require("pdfkit")` that `vsce package --no-dependencies` would ship
  without a resolvable `pdfkit` in `node_modules`).
- **[Risk]** The real VS Code Extension Development Host integration
  test is known-broken on this development machine (documented since
  the `signal-run-completion` change in this session's history) — it
  cannot be used to verify this command interactively end-to-end here.
  → **Mitigation**: same substitution used for the stale-task-detection
  change — verify against the real bundled artifact via a direct
  plain-Node script, closer to the real path than a mocked unit test,
  even though it is not the full VS Code host.
