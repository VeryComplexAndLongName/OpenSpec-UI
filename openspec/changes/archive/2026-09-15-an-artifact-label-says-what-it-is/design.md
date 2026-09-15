## Context

ADR 0031 lists a change's artifacts from its schema. Decision 4 labels any
artifact other than proposal, design, tasks and the delta specs with "a label
made from that id". `labelForSchemaArtifact` reads an id of three letters or
fewer as an abbreviation (`adr` becomes ADR), and anything longer as words
(`tech-notes` becomes "Tech notes"). A file a glob matched, that is not a delta
spec, gets its path relative to the change as its label.

The fixtures from `intent-driven-dev/openspec-schemas` show where this reads
badly:
- **`event-driven`.** Its `asyncapi` artifact becomes "Asyncapi".
- **`minimalist`.** Its `specs/**/*.md` glob matches `specs/landing-page.md`,
  labelled `specs/landing-page.md`.

**What the CLI does with such a file.** Checked on 2026-09-15 with OpenSpec CLI
1.7.0 in a scratch project using `minimalist`, with `specs/checkout/spec.md`
and `specs/landing-page.md`, both in delta format:
- **`openspec status`** listed both files as outputs of `specs`.
- **`openspec validate --strict`** reported the change valid.
- **`openspec archive --yes`** created `openspec/specs/checkout/spec.md`, and
  nothing for `landing-page.md`.

The CLI's `utils/spec-discovery.js` finds only a `spec.md` inside at least one
folder. A `specs/spec.md` at the root is the one case the CLI reports and blocks
(#1385).

## Goals / Non-Goals

**Goals:**
- A compound id that is a well-known term reads the way that term is written.
- A file matched by a glob says which artifact it belongs to, without
  repeating the folder the glob already names.
- A file under `specs/` that archive will not apply is visibly marked, before
  the owner archives and loses it.

**Non-Goals:**
- **Reading labels from the schema.** A schema's `description` is a sentence,
  not a label.
- **Changing ids or kinds.** Decision 4 of ADR 0031 stands: `proposal`,
  `design`, `tasks` and `delta-spec` keep their names.
- **Blocking archive.** The extension's archive runs the CLI, which decides.
- **The standalone UI.** It shows no per-change artifact list.

## Decisions

### A table of known terms, applied to each word

`labelForSchemaArtifact` keeps its two rules and adds a table. For each word of
the id, split on `-` and `_`, a word found in the table is written as the
table says. The whole-id rule for three letters or fewer still comes first.

The table: API, AsyncAPI, OpenAPI, GraphQL, gRPC, JSON, YAML, HTTP, SQL, ADR,
RFC, PRD, UI, UX.

- **Why a table.** Nothing in `asyncapi` marks where the words break. The only
  way to reach "AsyncAPI" from the id is to know the term.
- **Why not three letters or fewer per word.** That would turn `use-cases`
  into "USE cases".
- **An id not in the table** reads as it does today.

Rejected: showing the id verbatim, as `openspec status` does. DW's ADR would
read `adr` again.

### A matched file reads `<artifact label>: <path under the glob's folder>`

The glob's fixed folder is its segments before the first one with `*` or `?`,
the same prefix `resolveGenerates` already computes. For `specs/**/*.md` it is
`specs`, so `specs/landing-page.md` reads "Specs: landing-page.md". A glob with
no fixed folder keeps the whole relative path after the colon.

The artifact label comes from the same rule as a single-file artifact. The id
`specs` gives "Specs", which is distinct from a delta spec's "Spec: checkout".

Rejected: "Spec: landing-page.md". It would make a file archive ignores look
like the delta specs archive applies.

### `notAppliedOnArchive` is decided in core

`WorkbenchArtifact` gains `notAppliedOnArchive?: true`. Core sets it on a
listed file whose path starts with `specs/` and which is not a delta spec
(`deltaSpecCapability` is undefined). The rule is about OpenSpec's archive, so
it lives in core, and the host only renders it.

- **Where it shows.** The tree row's description is "not applied on archive",
  with the `warning` icon. Its tooltip names the rule: archive applies only
  `specs/<capability>/spec.md`.
- **Precedence.** A matched file always exists, so "missing" and this mark
  never meet.

## Risks / Trade-offs

- **The table will miss terms.** An unknown compound id reads as it does
  today, which is no worse than now. Adding a term is a one-line change.
- **The CLI may change what archive applies.** The mark copies
  `spec-discovery.js` in CLI 1.7.0. The design records the version, and the
  scratch check above is repeatable.
