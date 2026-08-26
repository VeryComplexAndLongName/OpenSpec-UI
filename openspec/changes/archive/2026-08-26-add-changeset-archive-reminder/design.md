## Context

`2026-08-26-add-adopt-changesets-template` covers the "propose Changesets
adoption from an OpenSpec change" half of the agreed integration scope.
This change covers the other half: once a project has actually adopted
Changesets, a nudge at the moment a change is archived (the point where
a forgotten changeset is most likely to be discovered too late — after
the code has already landed) that a pending changeset might be missing.

## Goals / Non-Goals

**Goals:**
- A project that has adopted Changesets and archives a change without a
  pending changeset sees a single, dismissible reminder with a one-click
  way to start `npx changeset`.
- A project that has not adopted Changesets (no `.changeset/config.json`)
  sees nothing at all — this feature is invisible until a project opts
  in by adopting Changesets in the first place.
- The check is read-only and best-effort: it never blocks, delays, or
  can fail the archive operation that already succeeded.

**Non-Goals:**
- Not a visual panel or dedicated view for Changesets state (rejected —
  see the 2026-08-26 discussion; the product stays release-tool-agnostic
  per `docs/adr/0001-shared-core-two-delivery-targets.md`).
- Not correlating the archived change's specific file diff against which
  packages actually need a version bump — that requires a git diff
  against a base ref, which the archive command does not currently have
  and which would meaningfully raise the false-negative/false-positive
  surface for a first version of this feature. The reminder only asks
  "is anything pending at all," not "does the right package have a
  changeset."
- Not implemented for `webui`/standalone: the action (opening an
  integrated terminal) has no equivalent in a browser tab or the VS Code
  local-server iframe embed. A future change could add a copy-to-clipboard
  or in-page instruction instead, if requested.
- Not auto-running `npx changeset` or auto-installing `@changesets/cli`
  — the user explicitly asked whether to auto-install and the answer
  here is no: the reminder only appears once a project has already
  chosen to adopt Changesets (`.changeset/config.json` exists), so
  `@changesets/cli` is already an expected dependency by that point.

## Decisions

### The core function reports facts only, never prompts

`checkChangesetReminder(cwd)` in `packages/core/src/changeset-reminder.ts`
returns `{ changesetsAdopted, pendingChangesetCount }` and does nothing
else — no `vscode` import, no UI. `packages/extension/src/commands.ts`
decides whether and how to surface it. This mirrors
`agent-detection.ts`'s existing shape in the same package (a pure
presence check the host acts on).

### Best-effort, silently swallowed failures

`remindAboutPendingChangeset` wraps its entire body in try/catch with no
error surfaced anywhere — a broken or unreadable `.changeset` directory
should never turn into a scary error message immediately after a
successful archive. `checkChangesetReminder` itself already treats a
missing/unreadable `.changeset` directory as "not adopted," so the
try/catch is a second line of defense against anything unexpected (e.g.
a VS Code API call failing).

## Risks / Trade-offs

- **[Risk]** A project with per-package changesets workflows unrelated
  to the archived change (e.g. an already-pending changeset for a
  different, older piece of work) suppresses the reminder even though
  the archived change itself introduced an uncovered package bump.
  → **Mitigation**: accepted for a first version — see the Non-Goals
  above on not correlating against the specific diff. The reminder is a
  best-effort nudge, not a gate; `require-changeset` (Gitea/GitHub CI, if
  adopted) remains the actual enforcement point.
