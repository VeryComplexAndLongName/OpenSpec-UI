# 0031: A Change Lists What Its OpenSpec Schema Declares

Status: Proposed

Date: 2026-09-15

## Context

Both defects below were found and reported by DW, a user of the VS Code
extension, by email on 2026-09-15, with screenshots of the change folder and
of the Changes tree.

**A nested delta spec reads as missing.**
- **What DW's change holds.** The file sits at
  `specs/web/dashboard-foundation/spec.md`. OpenSpec CLI 1.7.0 supports that
  layout, `specs/<area>/<capability>/spec.md` (its issue #1353). Its change
  parser, `validate` and `archive` all accept it, and `openspec list --specs`
  reports the capability as `web/dashboard-foundation`.
- **What the extension shows.** It lists "Spec: web — missing".
- **The cause.** `discoverChangeArtifacts` in `packages/core/src/workbench.ts`
  takes each directory directly under `specs/` as a capability, and looks for
  `spec.md` one level down.

The same one-level assumption is in two more places:
- `security.ts` builds the prompt of an agent run from `specs/<id>/spec.md`
  only, so an agent never sees a nested delta.
- `change-readiness.ts` names a change's capabilities from those directories,
  so two changes that write the same nested capability are not reported as
  colliding.

**A custom schema's artifacts are not shown.**
- **DW's schema.** DW's project uses a schema of its own,
  `spec-driven-with-adr`, which adds an `adr` artifact, `adr.md`.
- **What the tree lists.** Proposal, Design and Tasks, then the delta specs,
  from a list hard-coded in core.
- **What gets left out.** DW's `adr.md` and `exploration.md` never appear.

**What OpenSpec already says.** A schema declares its artifacts, each with a
`generates` path or glob: `proposal.md`, `specs/**/*.md`, `design.md`,
`tasks.md`.
- **Which schema a change uses.** The CLI reads the `schema` field of the
  change's `.openspec.yaml`, then of `openspec/config.yaml`, and otherwise
  uses `spec-driven`.
- **Where the schema file is looked for.** In this order:
  1. the project: `openspec/schemas/<name>/schema.yaml`;
  2. the user: `$XDG_DATA_HOME/openspec/schemas`, on Windows
     `%LOCALAPPDATA%\openspec\schemas`, otherwise
     `~/.local/share/openspec/schemas`;
  3. the schemas the package ships.
- **The file check.** `openspec status --change <name> --json` reports, per
  artifact, the files that exist. The `specs` glob matches files at any depth.

**Who calls discovery.** `discoverOpenSpecWorkspace` has 19 callers in core,
the server and the extension. The Pipeline, the human-only inbox, readiness
and the delegated items poll it.

## Decision

1. **A change's artifacts are the ones its schema declares.**
   - **In schema order.** Core resolves the change's schema name the way the
     CLI does, reads the schema file, and lists its artifacts in the order the
     schema declares them.
   - **Files.** Each artifact's files come from its `generates` value: a plain
     path is one file, and a glob is every file it matches, at any depth.
   - **Missing.** A declared single-file artifact with no file is listed as
     missing, as Design is today.

2. **Discovery reads the disk and never starts the CLI.**
   - **Where schemas are looked for.** The project and user schema
     directories are resolved exactly as the CLI resolves them. Core carries
     the one schema the CLI ships, `spec-driven`, as data.
   - **Why not the CLI.** Starting `openspec` inside a function with 19
     callers, several of them polled, would put a process start into every
     poll. That costs about half a second to a second on Windows.

3. **Every delta spec is found at any depth, and named by its path.** A
   delta spec's label is its capability path under `specs/`, such as
   `web/dashboard-foundation`, which is the id `openspec list --specs`
   reports. The artifact prompt for an agent run and the readiness
   capabilities use the same discovery.

4. **The names existing code relies on do not change.** Proposal, design and
   tasks keep the ids `proposal`, `design` and `tasks`, and delta specs keep
   the kind `delta-spec`. The Timeline, the task checklist, the task templates
   and the spec-delta check rely on them. Any other artifact a schema declares
   is listed with its own id, a label made from that id, and a kind of its
   own.

5. **A schema that cannot be read falls back, and says so.** The change still
   lists the `spec-driven` artifacts, the ones listed before this decision,
   and the change carries the reason. That covers four cases:
   - the named schema is not found;
   - its file does not parse;
   - it declares no artifacts;
   - it names a built-in schema core does not carry.

## Rejected Alternatives

### `openspec status --change <name> --json` for each change

It gives exactly the CLI's answer, with the files that exist. But it starts
one process per change on every discovery, active and archived. Across 19
callers and several polls that is the cost Decision 2 refuses.

### `openspec schema which --all --json` once per discovery

It tells where every schema resolves from, with one process per discovery
rather than per change. It is still a process start inside every poll, only to
find the built-in schema's path, and core can carry that schema as data.

### Adding ADR as a fourth hard-coded artifact

It would fix DW's schema and no other. The next custom schema with an
`exploration` or a `research` artifact would be invisible again.

### Recursing into `specs/` and keeping the fixed list

It fixes the nested delta spec and leaves the second defect as it is.

## Consequences

- **A new runtime dependency.** Core depends on `yaml` to read schema files.
  It is already in the lockfile, as a root development dependency.
- **A new CLI release can ship a schema core does not carry.** A change using
  it falls back to `spec-driven` and says why. A copy of the schema in the
  project or the user directory is read instead: `openspec schema fork` makes
  one.
- **The prompt of an agent run can grow.** It embeds every existing file the
  change's schema declares, not only proposal, design, tasks and delta specs.
- **Some tests change.** Workbench and tree tests that assumed the fixed list
  now state the schema they run under.
