# Design: a change lists what its schema declares

## Context

**Where the report came from.** DW, a user of the VS Code extension, found
both defects in one change of their project and reported them on 2026-09-15
with screenshots. The decision is ADR 0031.

**What was measured on 2026-09-15.** OpenSpec CLI 1.7.0, against a probe
project with DW's layout: a nested delta spec and a project schema
`spec-driven-with-adr` that adds `adr`.
- **`openspec list --specs --json`** reports the nested main spec as
  `web/dashboard-foundation`.
- **`openspec status --change <name> --json`** lists the artifacts `proposal`,
  `adr`, `specs`, `design` and `tasks`, in schema order. For each it gives the
  files that exist, the nested `spec.md` included.
- **`openspec validate`** accepts the change.
- **Schema resolution.**
  - `openspec schema which --all --json` resolves the built-in `spec-driven`
    from the package, and the probe schema from the project.
  - The CLI reads a change's schema name from `.openspec.yaml`, then
    `config.yaml`, then defaults to `spec-driven`.
  - It looks for the file in the project's `openspec/schemas/`, then the user
    data directory (`$XDG_DATA_HOME`, else `%LOCALAPPDATA%` on Windows, else
    `~/.local/share`, each followed by `openspec/schemas`), then the package.
- **Schema validation.** The CLI requires each artifact's `id`, `generates`
  and `template`, and refuses duplicate ids.
- **`generates` resolution.** A plain path is one file. A glob goes through
  fast-glob, with `onlyFiles` and its defaults, so a dotfile is not matched.

**What core does today.**
- `discoverChangeArtifacts` in `workbench.ts` returns Proposal, Design, Tasks,
  then one `delta-spec` per directory directly under `specs/`, checking
  `specs/<dir>/spec.md`.
- `security.ts` keeps its own copy of that rule for the agent prompt.
- `change-readiness.ts` names capabilities from the same one-level
  directories.
- The consumers of the list:
  - `change-timeline.ts`: the ids `proposal`, `design` and `tasks`, and the
    kind `delta-spec`;
  - `task-checklist.ts` and `task-templates.ts`: the id `tasks`;
  - `spec-delta-check.ts`: the kind `delta-spec`;
  - the extension's Changes tree: the kinds `tasks` and `delta-spec`;
  - `chat-participant.ts`: the whole list.

## Goals / Non-Goals

**Goals**
- DW's change shows its ADR, its exploration notes and
  `web/dashboard-foundation` as present.
- Any project schema's artifacts are listed in the order the schema declares
  them.
- An agent run and the readiness report see the same files as the tree.
- Discovery stays a disk read, safe to poll.

**Non-Goals**
- **The Change Editor's own spec file** (`specs/<change>/spec.md`). It edits
  the spec it creates.
- **Showing `requires`, or the ready and blocked statuses** that
  `openspec status` reports.
- **Reading a store** (`--store`) or a planning home other than the
  repository.
- **Changing the Specs tree.** It takes its ids from
  `openspec list --specs --json`, which already reports nested capabilities;
  a test asserts that such an id opens the right file.

## Decisions

### 1. One schema reader in core

`packages/core/src/change-schema.ts` resolves a change's schema in the CLI's
order and parses it with `yaml`.
- **What it returns.** The schema's name, where it was read from (`project`,
  `user` or `built-in`) and its artifacts, each with `id` and `generates`.
- **The built-in schema.** `spec-driven` is carried as data: the four
  artifacts and their `generates` values, as the CLI 1.7.0 package declares
  them.
- **Refusal.** A schema file is refused, as the CLI refuses it, when an
  artifact lacks `id` or `generates` or an id repeats.
- **Caching.** Parsed schemas are cached per discovery by file path, so a
  workspace with 40 changes under one schema reads that file once.

Rejected: starting the CLI (`status` per change, or `schema which` per
discovery). See ADR 0031, Rejected Alternatives.

### 2. `generates` resolved as the CLI resolves it

- **A plain path** is one file, listed whether it exists or not.
- **A glob** is resolved by a small matcher over the change directory,
  supporting `*`, `?` and `**` path segments.
  - It walks only below the pattern's literal prefix, so `specs/**/*.md`
    walks `specs/`.
  - Like fast-glob's defaults, it skips names that start with a dot and
    matches files only.
  - A glob that matches nothing lists nothing: no "missing" row for an
    unwritten spec, as today.
- **Why a small matcher.** fast-glob would add a dependency for three
  wildcard forms.

### 3. The artifact list keeps its ids and kinds

For each schema artifact, in order:

| Schema artifact | Row | `id` | `kind` | Label |
| --- | --- | --- | --- | --- |
| `proposal`, `design` or `tasks` with a plain path | one | its id | its id | Proposal, Design, Tasks |
| any artifact's matched file named `spec.md` under `specs/` | one per file | `delta-spec:<capability path>` | `delta-spec` | the capability path, e.g. `web/dashboard-foundation` |
| any other plain path | one | its id | `schema-artifact` | from the id: three letters or fewer upper-cased (`adr` → ADR), otherwise first letter capitalised, hyphens as spaces |
| any other glob match | one per file | `<id>:<path relative to the change>` | `schema-artifact` | the relative path |

A change also carries `schema`: its name, its source, and, where it fell
back, the reason. The reason is one of `not-found`, `unreadable` or
`no-artifacts`, with the detail.

### 4. One discovery for the tree, the prompt and readiness

- **The agent prompt.** `security.ts` stops keeping its own copy.
  - It embeds every existing file the discovery lists, labelled by its path
    relative to the change, in schema order.
  - It first checks that each file's real path lies inside the run's
    `changeDir`.
  - The prompt-building code stays in `security.ts`. Only the list of files
    to read moves to discovery, which reads nothing but file names and schema
    files.
- **Readiness.** `change-readiness.ts` names a change's capabilities from its
  `delta-spec` artifacts, so two changes writing
  `web/dashboard-foundation` collide.

### 5. The fallback is visible

- **In the Changes tree.** When `schema.fallback` is set, a change's first
  child row reads "Schema: <name>" with the reason as its description and a
  warning icon. The `spec-driven` artifacts follow.
- **Elsewhere.** The row is not shown when nothing fell back.

## Risks / Trade-offs

- **The CLI can change its resolution order, or ship a new built-in schema.**
  → The reader names the CLI version it was written against, and the fallback
  says why a schema was not read. A project copy
  (`openspec schema fork <name>`) is read first.
- **The glob matcher can disagree with fast-glob on an exotic pattern** (brace
  sets, negation). → Braces and negation are not supported. Such a pattern
  lists nothing, and a test pins the supported forms against CLI output
  captured from the probe.
- **The agent prompt can grow** with every artifact a schema declares. → It
  embeds only files that exist, and the change's own schema decides what
  those are.

## Migration Plan

None. The data is read, never written, and a project without a custom schema
gets the same list as before, apart from nested delta specs now being found.
