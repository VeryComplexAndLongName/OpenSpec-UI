# Design: a schema artifact stays inside its change

## Context

An external review of `a-change-lists-what-its-schema-declares` on
2026-09-15. Every point was checked against
`intent-driven-dev/openspec-schemas` on GitHub (MIT, `main` at `4bb6de2`) the
same day.

- **`spec-driven-with-adr`** declares proposal (`proposal.md`), specs
  (`specs/**/*.md`), design (`design.md`), adr (`adr.md`) and tasks
  (`tasks.md`), in that order. The fixture in `change-schema.test.ts`,
  `workbench.test.ts` and `security.test.ts` placed `adr` second.
- **The schema's history** has four commits:
  - `f14d1d5` on 2026-04-29 added the schema;
  - `3fc8916` on 2026-05-01 removed the ADR folder parameter;
  - `f04aaa2` on 2026-05-11 set `adr` to `generates: "../../../adr/*.md"`;
  - `b320db8` on 2026-06-22 moved `adr.md` back inside the change.
- **`event-driven`** declares event-storming, event-modeling, specs, design,
  asyncapi (`asyncapi.yaml`) and tasks.
- **`minimalist`** declares only specs (`specs/**/*.md`) and tasks. Changes in
  that repository keep flat files such as
  `specs/mermaid-color-coding.md`. The glob matches them. The CLI applies no
  such file, and our tree lists it as a schema artifact labelled by its path.
- **Today's code.**
  - `resolveGenerates` in `change-schema.ts` walks the literal prefix of a
    glob joined to the change directory. For `../../../adr/*.md` that is the
    repository's `adr/`, and every file there matches.
  - `security.ts` already drops, by real path, anything outside the change
    before a prompt reads it.
  - The Changes tree has no such check.

## Goals / Non-Goals

**Goals**
- The tests read the schemas users install, unchanged.
- No file outside a change's own directory is listed as that change's
  artifact, in any tree or consumer of `listChangeArtifacts`.
- The archived change's documents say what the change does.

**Non-Goals**
- **Labels** for flat spec files and compound ids. That is a separate change.
- **Following the CLI** where it would count an outside file as an output.
  OpenSpec's model places a change's artifacts in the change.

## Decisions

### 1. Containment is decided where files are listed

`discoverChangeArtifacts` drops a relative path that, joined to the change
directory, does not resolve inside it. For a file that exists, it also
compares real paths, so that a link pointing outside is dropped.
- **Plain paths.** A plain path that reaches outside is not listed at all,
  not even as missing: it could never be the change's file.
- **Globs.** `resolveGenerates` stops walking at a literal prefix that leaves
  the change directory, so a glob such as `../../../adr/*.md` reads nothing
  outside the change.
- **The agent prompt.** `security.ts` keeps its own real-path check. The
  prompt stays safe even if discovery changes again.

Rejected: filtering only in the tree. `listChangeArtifacts` feeds readiness
and the prompt too, and one list should mean one thing everywhere.

### 2. Fixtures are copies, with their source recorded

- **The copies.** The four `schema.yaml` files are copied byte for byte into
  `packages/core/src/fixtures/openspec-schemas/`, beside the repository's MIT
  `LICENSE`, with a README naming the commit and why each is there.
- **How tests use them.** Tests copy a fixture into a temporary project's
  `openspec/schemas/<name>/` rather than writing YAML inline.

Rejected: downloading the schemas during tests. The suite must run offline,
and a new upstream version must not change a test's meaning silently.

### 3. What the tests assert on each real schema

- **`spec-driven-with-adr`** on DW's layout: Proposal, Spec:
  web/dashboard-foundation, Design, ADR, Tasks.
- **`event-driven`:** the six artifacts in schema order. Today's labels are
  pinned, "Asyncapi" included, so the later label change shows as a
  deliberate test edit.
- **`minimalist`:** `specs/checkout/spec.md` is a delta spec named
  `checkout`, and a flat `specs/landing-page.md` is listed by its path, not as
  a delta spec.
- **`spec-driven-with-adr` at `f04aaa2`:** with ADRs in the repository's
  `adr/`, no artifact path lies outside the change, and the other artifacts
  are listed as before.
- **A junction** inside a change pointing outside lists nothing from there.

### 4. The archived change is corrected in place

Its `design.md` goal and its `proposal.md` sentence are rewritten to say that
only artifacts a schema declares appear, and that DW's schema declares no
exploration notes. Its task 4.5 record gains a note: the probe's schema order
was invented, and the real order is proposal, specs, design, adr, tasks.

## Risks / Trade-offs

- **Upstream moves on.** The fixtures stay at their commits, which the README
  records. A newer version is a deliberate copy.
- **A schema author may really mean an outside file.** Such a file is no
  longer listed under the change. The CLI still sees it, and OpenSpec's
  change model does not place artifacts there.
