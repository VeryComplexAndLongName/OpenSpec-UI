## Why

Three related, user-requested gaps in review: (1) users currently
hand-write near-duplicate agent-instruction content across `CLAUDE.md`
and `AGENTS.md` (risky manual copy-paste, easy to let drift), (2) there
is no way to bootstrap a `.github/dependabot.yml` scoped to the actual
project's ecosystem(s), and (3) there is no way to bootstrap
project-type-specific best-practice guidance under
`.github/instructions/*.instructions.md` (a real, existing GitHub
Copilot convention — path-scoped custom instructions via an `applyTo`
glob in YAML frontmatter). All three share the same underlying shape:
curated, built-in content, keyed by project type, written into specific
conventional repository files on explicit user request — the same
"built-in curated content the user can pull into their project" idea
`template-catalog` already established for change proposals, applied to
a different set of target files.

## What Changes

- Add `packages/core/src/repo-bootstrap.ts`: a small built-in content
  registry for two seed project types (`node`, `python` — intentionally
  narrow, matching the existing built-in template catalog's own seed
  scope; extensible later) covering:
  - Agent instructions (written identically into both `CLAUDE.md` and
    `AGENTS.md` — no cross-file link, since an agentic tool following a
    link from one file to the other cannot be guaranteed across every
    supported tool profile).
  - `.github/dependabot.yml` (accumulates ecosystems across repeated
    invocations — calling it once for `node` and later for `python`
    adds both, not overwrite-and-lose-the-first).
  - `.github/instructions/<subtype>.instructions.md` for a user-picked
    subtype (`backend`/`frontend`/`general`), with `applyTo` frontmatter.
- Two different, deliberately distinct ownership/idempotency mechanisms:
  - **Section markers** (`CLAUDE.md`/`AGENTS.md`/`.instructions.md`):
    our content lives between `<!-- openspec-ui:managed start -->`/`end`
    comments; anything before/after those markers is the user's own and
    is never touched on regeneration. A file that exists but has no
    matching markers is treated as foreign — reported, left untouched.
  - **Whole-file marker** (`dependabot.yml`): a first-line comment
    (`# managed-by: openspec-ui...`); if present, the whole file is ours
    to regenerate; if a file exists without it, it's foreign — reported,
    left untouched.
- Three VS Code commands (QuickPick-driven project-type/subtype
  selection, matching `openspec-ui.initialize`'s existing UX pattern),
  opening the written file(s) afterward as visible confirmation.

## Capabilities

### New Capabilities

- `repo-bootstrap-snippets`: on-demand generation of agent instructions,
  a dependabot config, and path-scoped Copilot instructions, from a
  built-in, project-type-keyed content registry, with a marker-based
  ownership model that never overwrites content the user (or another
  tool) already owns.

### Modified Capabilities

(none)

## Impact

- `packages/core/src/repo-bootstrap.ts` (new), `index.ts` (export).
- `packages/extension/src/commands.ts` (three new commands),
  `package.json` (command registration; Command Palette only — these are
  workspace-level actions, not scoped to a specific tree item).
- VS Code only for this first pass — same reasoning already used for
  `tasks-tree-expand`'s Impact section: no equivalent standalone UI
  surface exists yet for this kind of action, and core owns the actual
  logic, so standalone parity remains a clean, non-breaking follow-up.
- No change to the command/event protocol.
