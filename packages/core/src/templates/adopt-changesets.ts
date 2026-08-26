import type { CatalogTemplate } from "../template-catalog.js";

// New category ("release-management") — deliberately narrow: Changesets
// adoption for version/changelog automation in an npm workspaces monorepo,
// not a full release pipeline (npm publish, git tagging beyond Changesets'
// own — see design.md's Non-Goals). Node.js/TypeScript-specific: the
// concrete tool choice (Changesets) only applies to npm-based projects,
// same reasoning as this catalog's other ecosystem-specific tooling
// templates over vaguer cross-language ones. Bakes in a real, verified
// gotcha (the `privatePackages` config field) discovered adopting this
// exact tool in this exact repository, not a hypothetical one.

export const adoptChangesets: Omit<CatalogTemplate, "origin"> = {
  manifest: {
    id: "adopt-changesets",
    title: "Adopt Changesets for version and changelog management in an npm workspaces monorepo",
    category: "release-management",
    version: "1.0.0",
    summary:
      "Replaces hand-edited package.json version bumps and CHANGELOG.md entries with Changesets: a small git-tracked file per pending change, applied all at once to compute every affected package's bump and changelog.",
    variables: [
      {
        name: "defaultBranch",
        prompt: "Default branch changesets are proposed against (e.g. main)",
        default: "main",
      },
    ],
  },
  artifacts: {
    proposal: `## Why

<!-- Fill in: what forces this change now — a specific incident where a
version bump or changelog entry was forgotten across several packages in
one change, or the manual process itself becoming a bottleneck. -->

## What Changes

- Add \`@changesets/cli\` as a root dev dependency.
- Add \`.changeset/config.json\`: \`baseBranch: "{{defaultBranch}}"\`,
  independent versioning by default (no \`fixed\`/\`linked\` groups unless
  this project's packages are meant to move in lockstep), and —
  critically, if any workspace package is \`"private": true\` —
  \`"privatePackages": { "version": true, "tag": false }\`. Omitting this
  field is not merely "the default": in \`@changesets/cli@3.0.1\`,
  \`changeset version\` silently does nothing at all for a workspace with
  private packages and no explicit \`privatePackages\` config — no error,
  just "All files have been updated" while touching nothing. This is not
  a hypothetical risk; it is exactly what happened adopting this tool.
- Add \`.changeset/README.md\` documenting this project's specific
  workflow: propose a changeset (\`npx changeset\`) alongside the code
  change it describes instead of hand-editing \`version\`/
  \`CHANGELOG.md\`; apply pending changesets separately
  (\`npx changeset version\`).
- Add \`changeset\`/\`changeset:version\` scripts to the root
  \`package.json\` for convenience.

## Capabilities

### New Capabilities

- \`release-management\`: <fill in what this actually covers in your
  project — e.g. "every package version bump is proposed as a reviewable
  file alongside its code change">

## Impact

- New: \`.changeset/config.json\`, \`.changeset/README.md\`.
- Modified: root \`package.json\` (new dev dependency, new scripts); any
  existing docs describing the manual version-bump process.
- Dependencies: \`@changesets/cli\`.
`,
    design: `## Context

<!-- Fill in: current versioning practice (fully manual? a different
tool already partially in use?), and whether any workspace package is
"private": true (this determines whether the privatePackages config gotcha
below actually applies to this project). -->

## Goals / Non-Goals

**Goals:**
- Every package version bump is proposed as a small, reviewable,
  git-tracked file (a changeset) in the same change as the code it
  describes, not a separate manual edit someone has to remember.
- \`npx changeset version\` deterministically applies every pending
  changeset: computing each affected package's new version and writing
  its \`CHANGELOG.md\` entry, with no hand-editing.

**Non-Goals:**
- Not adopting \`npm publish\`/\`changeset publish\` — this template covers
  version/changelog automation only. A project that also publishes to a
  registry needs a separate, explicit decision about \`access\` and the
  actual publish step.
- Not choosing fixed/linked versioning (packages bumping together) over
  independent versioning (each on its own number) — independent is the
  default here; switch to \`fixed\`/\`linked\` in \`config.json\` only if
  this project's packages are actually meant to move in lockstep.
- Not migrating historical \`CHANGELOG.md\` entries written before this
  adoption — Changesets only manages entries going forward.

## Decisions

### \`privatePackages\` is set explicitly, not left to its default

<!-- This is filled in, not a blank: @changesets/cli@3.0.1's own default
for an unset privatePackages field does not reliably enable version
computation for private packages in every workspace shape — confirmed by
reproducing the silent no-op directly against
@changesets/assemble-release-plan. Setting it explicitly removes the
ambiguity regardless of which default the installed version actually
resolves to. -->

### Verify with a real changeset before trusting the setup, not just \`changeset init\`'s own output

<!-- Fill in if this project's setup differs — default approach: after
configuring, add one real changeset and run \`npx changeset status\`
followed by \`npx changeset version\`; confirm the target package.json
version and CHANGELOG.md entry actually changed, not just that the
commands exited without an error message. A misconfigured setup can
report success while silently doing nothing (see the Risks section). -->

## Risks / Trade-offs

- **[Risk]** A misconfigured \`.changeset/config.json\` can make
  \`changeset version\` silently no-op — exiting cleanly, printing "All
  files have been updated," while changing nothing. → **Mitigation**: the
  verification step above (a real changeset, confirmed to actually change
  files) catches this at setup time rather than at the first real release
  someone assumes went out.
`,
    tasks: `## 1. Install and configure

- [ ] 1.1 Add \`@changesets/cli\` as a root dev dependency.
- [ ] 1.2 Add \`.changeset/config.json\` with \`baseBranch: "{{defaultBranch}}"\`;
  if any workspace package is \`"private": true\`, include
  \`"privatePackages": { "version": true, "tag": false }\` explicitly.
- [ ] 1.3 Add \`changeset\`/\`changeset:version\` scripts to the root
  \`package.json\`.

## 2. Document the workflow

- [ ] 2.1 Add \`.changeset/README.md\`: what a changeset is, this
  project's specific workflow (propose alongside the code change, apply
  separately), and anything this project deliberately does not use
  Changesets for (e.g. no \`npm publish\`, if applicable).

## 3. Verify the setup actually works

- [ ] 3.1 Add one real changeset (\`npx changeset\`, or hand-write a
  \`.changeset/*.md\` file) for a trivial, real change.
- [ ] 3.2 Run \`npx changeset status\` and confirm it lists the expected
  package(s) and bump type(s) — an empty list despite a changeset file
  present means the config is broken (see design.md's Risks).
- [ ] 3.3 Run \`npx changeset version\` and confirm the target
  \`package.json\`'s \`version\` and \`CHANGELOG.md\` actually changed, and
  the changeset file was consumed (deleted).

## 4. Verification

- [ ] 4.1 Commit \`.changeset/config.json\`, \`.changeset/README.md\`, and
  the updated root \`package.json\` together.
`,
  },
};
