import type { CatalogTemplate } from "../template-catalog.js";

// ASP.NET Core counterpart to `python-sqlalchemy-alembic` / `prisma-orm-
// migrations` — same "code-first ORM + migration scaffolding" shape,
// different ecosystem. Closes a real gap: ASP.NET Core was one of the four
// target languages named in template-catalog-v2/proposal.md but had zero
// built-in templates until this one.

export const aspnetEfcoreMigrations: Omit<CatalogTemplate, "origin"> = {
  manifest: {
    id: "aspnet-efcore-migrations",
    title: "Add Entity Framework Core + migrations to an ASP.NET Core project",
    category: "data-layer",
    version: "1.0.0",
    summary:
      "Adds an EF Core DbContext, connection-string-driven configuration, and Migrations scaffolding to an ASP.NET Core project that has neither yet.",
    variables: [
      {
        name: "dbContextName",
        prompt: "Name for the DbContext class (e.g. AppDbContext)",
        default: "AppDbContext",
      },
      {
        name: "connectionStringEnvVar",
        prompt: "Environment variable name holding the connection string (ASP.NET Core's double-underscore config-path convention)",
        default: "ConnectionStrings__Default",
      },
    ],
  },
  artifacts: {
    proposal: `## Why

<!-- Fill in: what forces this change now — a specific feature that needs
persistence, or a specific pain point with the current storage approach. -->

## What Changes

- Add a \`{{dbContextName}} : DbContext\` class with the first entity
  set(s), reading its connection string from configuration (bound from
  \`{{connectionStringEnvVar}}\`, not hardcoded).
- Register \`{{dbContextName}}\` with the DI container in \`Program.cs\`
  via \`AddDbContext<{{dbContextName}}>\`.
- Add EF Core Migrations scaffolding and the first migration.

## Capabilities

### New Capabilities

- \`data-layer\`: <fill in what this actually covers in your project>

## Impact

- New: \`{{dbContextName}}.cs\`, \`Migrations/<Timestamp>_InitialCreate.cs\`.
- Modified: \`Program.cs\` (DI registration), \`appsettings.json\` (connection
  string placeholder — actual value stays in \`{{connectionStringEnvVar}}\`,
  never committed).
- Dependencies: \`Microsoft.EntityFrameworkCore\`,
  \`Microsoft.EntityFrameworkCore.Design\`, and a provider package (e.g.
  \`Npgsql.EntityFrameworkCore.PostgreSQL\` or
  \`Microsoft.EntityFrameworkCore.SqlServer\`).
`,
    design: `## Context

<!-- Fill in: current persistence approach (if any), constraints (existing
data to migrate, hosting environment, target database engine). -->

## Goals / Non-Goals

**Goals:**
- A single, DI-registered \`{{dbContextName}}\` other services depend on
  through constructor injection, not manual instantiation.
- Migrations are the only way schema changes reach a real database — no
  implicit \`EnsureCreated()\` in application startup.

**Non-Goals:**
- Not choosing a specific database engine beyond what this change's own
  provider package implies — that is a project-wide decision to make
  separately if it does not already exist.
- Not deciding between \`DbContext\`-per-request vs. a broader lifetime
  scope beyond ASP.NET Core's default scoped registration.

## Decisions

### Migration workflow: <fill in — e.g. \`dotnet ef migrations add\` + manual review before commit>

<!-- Rejected alternatives and why. -->

### Connection string source: environment variable via configuration binding, not a committed \`appsettings.json\` value

ASP.NET Core's configuration system already overrides \`appsettings.json\`
values with environment variables using the \`__\` (double-underscore)
path separator, so \`{{connectionStringEnvVar}}\` overriding
\`ConnectionStrings:Default\` requires no custom configuration-provider code.

## Risks / Trade-offs

- **[Risk]** Auto-generated migrations can miss changes EF Core's model
  comparer does not detect on its own (some renames, certain index
  changes). → **Mitigation**: review every generated migration's
  \`Up\`/\`Down\` methods before applying it; do not blindly trust
  \`dotnet ef migrations add\` output.
`,
    tasks: `## 1. DbContext setup

- [ ] 1.1 Add \`{{dbContextName}} : DbContext\` with the first
  \`DbSet<T>\` property/properties.
- [ ] 1.2 Register \`{{dbContextName}}\` in \`Program.cs\` via
  \`builder.Services.AddDbContext<{{dbContextName}}>(...)\`, reading the
  connection string from configuration bound to \`{{connectionStringEnvVar}}\`.

## 2. Migrations setup

- [ ] 2.1 Install the \`dotnet-ef\` tool (if not already available) and
  generate the first migration
  (\`dotnet ef migrations add InitialCreate\`).
- [ ] 2.2 Review the generated \`Up\`/\`Down\` methods against the intended
  schema.
- [ ] 2.3 Apply it against a real database and confirm the resulting
  schema matches the model (\`dotnet ef database update\`).

## 3. Verification

- [ ] 3.1 Add a test that resolves \`{{dbContextName}}\` from the DI
  container (or constructs it directly with a test connection string) and
  confirms it connects without error.
`,
  },
};
