import type { CatalogTemplate } from "../template-catalog.js";

// Node.js/TypeScript counterpart to `python-sqlalchemy-alembic` — same
// scope ("schema + migrations for a project with neither yet"), different
// ecosystem.

export const prismaOrmMigrations: Omit<CatalogTemplate, "origin"> = {
  manifest: {
    id: "prisma-orm-migrations",
    title: "Add Prisma ORM + migrations to a Node.js/TypeScript project",
    category: "data-layer",
    version: "1.0.0",
    summary:
      "Adds Prisma's schema, generated client, and migration workflow to a Node.js/TypeScript backend that has neither yet.",
    variables: [
      {
        name: "sourceDir",
        prompt: "Source directory that will import the generated Prisma client (e.g. src)",
        default: "src",
      },
      {
        name: "databaseUrlEnvVar",
        prompt: "Environment variable name holding the database URL",
        default: "DATABASE_URL",
      },
    ],
  },
  artifacts: {
    proposal: `## Why

<!-- Fill in: what forces this change now — a specific feature that needs
persistence, or a specific pain point with the current storage approach. -->

## What Changes

- Add \`prisma\` (dev) and \`@prisma/client\` as dependencies; add
  \`prisma/schema.prisma\` reading the connection string from
  \`{{databaseUrlEnvVar}}\`.
- Add the first model(s) to \`schema.prisma\`.
- Generate the first migration and the Prisma Client used from
  \`{{sourceDir}}\`.

## Capabilities

### New Capabilities

- \`data-layer\`: <fill in what this actually covers in your project>

## Impact

- New: \`prisma/schema.prisma\`, \`prisma/migrations/<first-migration>/\`,
  generated Prisma Client.
- Modified: \`package.json\` (\`prisma generate\`/\`migrate\` scripts, new
  dependencies).
- Dependencies: \`prisma\` (dev), \`@prisma/client\`.
`,
    design: `## Context

<!-- Fill in: current persistence approach (if any), constraints (existing
data to migrate, hosting environment, etc.). -->

## Goals / Non-Goals

**Goals:**
- A single, importable \`PrismaClient\` instance other modules depend on,
  not one instantiated per call site.
- Migrations (\`prisma migrate dev\`/\`deploy\`) are the only way schema
  changes reach a real database — no \`db push\` in normal workflow.

**Non-Goals:**
- Not choosing a query-building style beyond what this change's own
  models need — that is a project-wide decision to make separately if it
  does not already exist.

## Decisions

### Client instantiation: single module-level singleton, not one per request

<!-- Fill in the actual reason for this project. Rejected alternatives and
why. -->

### Migration workflow: \`prisma migrate dev\` locally, \`prisma migrate deploy\` in CI/production

<!-- Fill in — rejected alternatives and why. -->

## Risks / Trade-offs

- **[Risk]** \`prisma migrate dev\` can prompt for destructive resets when
  the local migration history and database drift out of sync. →
  **Mitigation**: never run \`migrate dev\` against a shared/production
  database; use \`migrate deploy\` there instead.
`,
    tasks: `## 1. Prisma setup

- [ ] 1.1 Add \`prisma\` (dev) and \`@prisma/client\` as dependencies; run
  \`npx prisma init\` to scaffold \`prisma/schema.prisma\` reading
  \`{{databaseUrlEnvVar}}\`.
- [ ] 1.2 Add the first model(s) to \`schema.prisma\`.

## 2. Migration + client generation

- [ ] 2.1 Generate and review the first migration
  (\`npx prisma migrate dev --name init\`).
- [ ] 2.2 Add a single Prisma Client instance under \`{{sourceDir}}\` that
  other modules import, instead of instantiating \`PrismaClient\` per call
  site.

## 3. Verification

- [ ] 3.1 Add a test that imports the Prisma Client module and confirms
  it constructs without error given a valid \`{{databaseUrlEnvVar}}\`.
- [ ] 3.2 Apply the migration against a real database and confirm the
  resulting schema matches the model(s) (\`npx prisma migrate deploy\` or
  equivalent).
`,
  },
};
