## Context

`template-catalog`'s own design.md already established the pattern this
change reuses: built-in content shipped as TypeScript modules (not files
on disk, so it survives esbuild-bundling into the packaged `.vsix` the
same way it does running from source) — this change's content registry
follows the identical shape.

`.github/instructions/*.instructions.md` with `applyTo` frontmatter is a
real, existing GitHub Copilot convention for path-scoped custom
instructions — not something this change invents; it only generates
content in that already-understood format.

`openspec-ui.initialize`'s existing `showQuickPick(..., { canPickMany:
true })` flow is the established UX precedent for "pick from a fixed
list of options, then act" in this extension — reused verbatim for
project-type/subtype selection rather than introducing a new picker
pattern.

## Goals / Non-Goals

**Goals:**
- Never silently overwrite content the user (or another tool) owns —
  the marker check is the hard gate, not a soft warning.
- `dependabot.yml` generation is additive across repeated invocations
  (node, then later python, ends up with both ecosystems) — not
  last-write-wins.
- Content stays honest about its own scope: concise, defensible
  practices, not a claimed exhaustive style guide (same discipline
  `template-catalog`'s seed templates already committed to).

**Non-Goals:**
- No automatic project-type *detection*. The user picks node/python (and,
  for instructions, backend/frontend/general) from a list — this
  session's own earlier discussion of automatic subtype detection
  (backend/frontend/desktop) remains a separate, harder, not-yet-built
  problem; this change does not attempt it.
- No more than two seed project types (`node`, `python`). Matches
  `template-catalog`'s own "deliberately narrow seed, extensible
  registry" precedent — the two chosen are exactly the two ecosystems the
  built-in template catalog already has real content for
  (`node-vitest-testing-baseline`, `flask-to-fastapi`/
  `python-sqlalchemy-alembic`), not an arbitrary pick.
- No cross-file linking between `CLAUDE.md` and `AGENTS.md` (the
  originally-discussed alternative). Rejected in favor of writing full,
  identical content into both — see Decisions.
- No standalone/webui UI. See proposal.md's Impact.
- No re-detection of GitHub-hosted-ness (checking for a `github.com`
  git remote) before offering the dependabot/instructions commands —
  they simply write files under `.github/`, which is meaningful whether
  or not the remote happens to be GitHub today; gating the command's
  *visibility* on remote detection is a low-value refinement deferred to
  a follow-up if it turns out to matter in practice.

## Decisions

### Agent instructions are written fully into both `CLAUDE.md` and `AGENTS.md`, not linked

Originally considered: put full content only in `CLAUDE.md`, have
`AGENTS.md` contain just a pointer ("see CLAUDE.md"). Rejected — an
agentic tool following a cross-file reference is not a guaranteed
platform behavior the way "Claude auto-loads `CLAUDE.md`" is; it depends
on the specific tool having general file-read tool access *and*
interpreting the reference as actionable. Since both files are generated
by the same command from the same source content, "duplication" here
costs nothing in practice (no human ever copy-pastes it, so it can never
drift out of sync the way the original hand-maintained duplication this
proposal exists to fix could) while removing the reliability dependency
entirely.

### Two different ownership mechanisms — section markers vs. whole-file marker — not one for everything

Prose files (`CLAUDE.md`/`AGENTS.md`/`.instructions.md`) get **section
markers**: our content lives in a clearly delimited block, and the user
is expected to add their own material below it (this session's own
earlier discussion explicitly wanted "our instructions first, user's
own after," in the same file). `dependabot.yml`, a structured YAML file,
gets a **whole-file marker** instead: mixing a "must-be-ours" YAML block
with arbitrary user-added YAML elsewhere in the same file is
meaningfully riskier to get right (indentation/structure fragility) for
no clearly requested benefit — nothing in this session's discussion asked
for "my own dependabot entries below the generated ones," and the
generated file already accumulates every requested ecosystem on its own.

### `dependabot.yml` regenerates the *whole* file from the union of ecosystems, not a text-level merge into existing structure

Rejected parsing/patching the existing YAML in place (would need a YAML
parser dependency this package doesn't currently have, and structured
in-place patching is its own source of subtle formatting bugs). Instead:
on each invocation, scan the current file (if it's ours) for which
`package-ecosystem: "..."` values are already present via a simple
substring check, union that set with the newly requested ecosystem(s),
and re-emit the *entire* file fresh from this package's own fixed,
canonical per-ecosystem template blocks in a stable order. Simpler,
avoids a new dependency, and produces a deterministic, consistently
formatted file every time rather than accreting whatever formatting
happened to already be there.

`github-actions` is always included in the regenerated set, regardless
of which project type(s) were picked — it's a repo-wide default worth
having whenever dependabot is configured at all, not tied to a specific
language ecosystem.

### A file without our marker is "foreign," full stop — no partial-content heuristics

Rejected the originally-floated idea of detecting "ours" via fuzzier
signals (particular phrasing, absence of arbitrary comments). A single,
exact marker check is unambiguous and — importantly — also correctly
covers "this file used to be ours but the user has since edited away the
marker," which should also correctly stop being managed. One check
handles both "always was foreign" and "was ours, no longer is."

## Risks / Trade-offs

- **[Risk]** Seed content for only two project types (node, python) will
  feel incomplete to users working in other ecosystems (C#, Java, ...).
  → **Mitigation**: explicitly scoped as a seed, same accepted trade-off
  as `template-catalog`'s own single-template launch; the registry is a
  small, obviously-extensible TypeScript array, not a structural
  limitation.
- **[Risk]** `.instructions.md`'s `applyTo` glob defaults to `**` (whole
  repository) since this change does not attempt directory-structure
  detection — a user with genuinely separate backend/frontend
  directories gets an unscoped instructions file until they narrow the
  glob themselves. → **Mitigation**: accepted; the generated file's own
  content includes a comment telling the user to narrow `applyTo` if
  they have a more precise directory boundary in mind — an honest
  starting point, not a wrong guess presented as authoritative.
- **[Risk]** Regenerating `dependabot.yml` from a fixed template on every
  invocation discards any manual formatting/comment tweaks a user made
  inside the managed file (even though it's "ours" to touch). →
  **Mitigation**: accepted and consistent with the whole-file-ownership
  decision above — a user who wants to keep manual tweaks should not
  re-invoke the command, exactly the same trade-off the marker check
  already makes explicit.

## Migration Plan

- No data migration; purely additive (new core module, three new
  commands).
- Version bump (minor) for `@openspec-ui/core`, `openspec-ui-vscode`.
- Rollback: revert the package changes together; no persisted state
  beyond files a user explicitly generated via these commands.
