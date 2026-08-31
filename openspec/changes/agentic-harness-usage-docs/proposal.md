## Why

Raised directly in a repository conversation on 2026-08-31: `openspec/
agent-harness.json` (the Agentic Harness config) and its behavior are
documented across `docs/adr/0011-agentic-harness-config-and-autonomy-
levels.md` (rationale) and `openspec/specs/agentic-harness/spec.md`
(normative requirements), but `openspec/README.md` — this repository's own
day-to-day runbook, the file this project's `CLAUDE.md` points a reader to
first — has no section at all explaining, in one place, how to actually
configure and use it today. A reader has to reconstruct the workflow from
an ADR and a formal spec instead of a runbook paragraph. This is a
documentation-only change: no behavior changes, and per this repository's
own convention (`openspec/changes/archive/2026-08-24-refresh-readme-
getting-started/`), a pure-docs change skips the specs-delta requirement
(`skip_specs: true`).

## What Changes

- New `openspec/README.md` section, "Agentic Harness — how to work with
  it," describing: the two-level config (`openspec/agent-harness.json` +
  per-change `openspec/changes/<id>/harness.json`), the three ways to edit
  it (Harness Settings UI, VS Code commands, hand-editing the JSON), what
  each `autonomyLevel` actually does **today** (`assisted` is the only
  functional level; `semi-autonomous`/`autonomous` are accepted by the
  schema but currently inert — pointing to `openspec/changes/
  agentic-harness-autonomy/` as the tracked follow-up making them
  functional), and how the resolved config surfaces today (Agent Selection
  picker pre-fill, Processes view agent attribution).
- No change to any spec, ADR, or code — text only, and only in
  `openspec/README.md`.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none; this is a documentation-only change)

## Impact

- `openspec/README.md`
