import type { CatalogTemplate } from "../template-catalog.js";

// Language-agnostic on purpose — see openspec/changes/template-catalog-v2/
// design.md, "New built-in templates: one language-agnostic, two
// language-specific". Describes the layering/dependency-direction change
// itself, not language-specific file layout — fill-in markers cover the
// project-specific concrete paths and module names, the same convention
// python-sqlalchemy-alembic already uses for project-specific blanks.

export const flatToHexagonalArchitecture: Omit<CatalogTemplate, "origin"> = {
  manifest: {
    id: "flat-to-hexagonal-architecture",
    title: "Migrate a flat/layered codebase to hexagonal architecture",
    category: "architecture-migration",
    version: "1.0.0",
    summary:
      "Introduces domain/ports/adapters layering so business logic no longer directly imports framework, database, or transport code.",
    variables: [
      {
        name: "domainModuleName",
        prompt: "Name for the new domain/business-logic module or package (e.g. domain)",
        default: "domain",
      },
      {
        name: "portsModuleName",
        prompt: "Name for the new ports (interfaces) module or package (e.g. ports)",
        default: "ports",
      },
      {
        name: "adaptersModuleName",
        prompt: "Name for the new adapters (implementations) module or package (e.g. adapters)",
        default: "adapters",
      },
    ],
  },
  artifacts: {
    proposal: `## Why

<!-- Fill in: what forces this change now — business logic currently
depends directly on a framework/database/HTTP client that is hard to
test or swap, or a specific pain point with the current flat/layered
structure. -->

## What Changes

- Introduce a \`{{domainModuleName}}\` module containing business logic
  with zero imports from frameworks, database clients, or HTTP/transport
  libraries.
- Introduce a \`{{portsModuleName}}\` module defining the interfaces
  (abstract classes/protocols/traits — whatever this language's idiom
  is) that \`{{domainModuleName}}\` depends on for anything external
  (persistence, external APIs, clock/time, etc.).
- Introduce an \`{{adaptersModuleName}}\` module containing the concrete
  implementations of those ports (the actual database client, HTTP
  client, framework-specific code) — this is the only place framework/
  infrastructure imports are allowed.
- Move existing business logic out of framework-coupled code
  (controllers/handlers/views) into \`{{domainModuleName}}\`, with the
  framework layer reduced to translating requests into domain calls and
  domain results into responses.

## Capabilities

### Modified Capabilities

- <fill in: which existing capability's implementation moves behind this
  new layering, without changing its external behavior>

## Impact

- New: \`{{domainModuleName}}/\`, \`{{portsModuleName}}/\`,
  \`{{adaptersModuleName}}/\`.
- Modified: existing framework-layer code (controllers/handlers/views),
  reduced to request/response translation calling into
  \`{{domainModuleName}}\`.
- No external-behavior change — this is an internal restructuring; every
  existing route/entry point should behave identically before and after.
`,
    design: `## Context

<!-- Fill in: current structure (single flat module? layered by technical
concern — controllers/services/repositories?), what specifically makes
testing or swapping infrastructure hard today. -->

## Goals / Non-Goals

**Goals:**
- \`{{domainModuleName}}\` is testable without a real database, network,
  or framework test harness — only plain objects/functions and test
  doubles for \`{{portsModuleName}}\` interfaces.
- Dependencies point inward only: adapters depend on ports and domain;
  domain depends on nothing outside itself and its own ports.

**Non-Goals:**
- Not a rewrite of business logic's actual behavior — this migration
  changes where code lives and what it's allowed to import, not what it
  computes.
- Not migrating every module in one pass. Migrate one capability/feature
  at a time behind the same external interface, not a big-bang rewrite.

## Decisions

### Migration order: one capability/feature at a time, old and new structure coexisting until each is done

Rejected a big-bang rewrite: this repository's own
\`docs/adr/0001-shared-core-two-delivery-targets.md\`-style layering
decisions were made and rolled out incrementally in the same spirit —
large structural changes done feature-by-feature stay reviewable and
keep the codebase shippable throughout, rather than requiring a long-
lived branch. <Fill in the actual order this project will migrate in.>

### Port granularity: <fill in — e.g. one port per external dependency, or grouped by capability>

<!-- Rejected alternatives and why. -->

## Risks / Trade-offs

- **[Risk]** Mid-migration, some code still directly imports
  infrastructure while other code goes through ports — a temporary
  inconsistency. → **Mitigation**: accepted as an expected, visible state
  during a feature-by-feature migration; track which capabilities have
  moved in this change's own \`tasks.md\`, not left implicit.
`,
    tasks: `## 1. Scaffolding

- [ ] 1.1 Create the \`{{domainModuleName}}\`, \`{{portsModuleName}}\`, and
  \`{{adaptersModuleName}}\` modules (empty, with whatever this language's
  module/package boundary marker is).
- [ ] 1.2 Add a lint/build rule (or, if unavailable, a documented
  convention + code-review checklist item) preventing
  \`{{domainModuleName}}\` from importing framework/database/HTTP code
  directly.

## 2. First capability migration (proves the pattern)

- [ ] 2.1 Pick one existing capability/feature to migrate first. Define
  its ports in \`{{portsModuleName}}\`.
- [ ] 2.2 Move its business logic into \`{{domainModuleName}}\`, taking
  ports as dependencies instead of concrete infrastructure.
- [ ] 2.3 Implement the concrete adapters in \`{{adaptersModuleName}}\`.
- [ ] 2.4 Update the framework layer (controller/handler/view) to call
  into \`{{domainModuleName}}\` via the wired adapters, with no behavior
  change to the external interface.
- [ ] 2.5 Confirm existing tests for this capability still pass
  unmodified (external behavior unchanged) and add domain-level tests
  that no longer need a real database/network.

## 3. Remaining capabilities

- [ ] 3.1 Repeat step 2 for each remaining capability, one at a time.

## 4. Cleanup

- [ ] 4.1 Once every capability has migrated, remove any now-unused
  direct-infrastructure-access code paths left in the old structure.
`,
  },
};
