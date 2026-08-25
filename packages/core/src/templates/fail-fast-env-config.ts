import type { CatalogTemplate } from "../template-catalog.js";

// New category ("configuration") — Node.js/TypeScript-specific (assumes a
// schema-validation library with TypeScript inference), same pattern as
// `production-dockerfile` introducing "containerization" and
// `jwt-auth-middleware` introducing "auth". Deliberately narrow: startup-
// time validation of already-read environment variables, not a config
// management/secrets-vault integration (see design.md's Non-Goals).

export const failFastEnvConfig: Omit<CatalogTemplate, "origin"> = {
  manifest: {
    id: "fail-fast-env-config",
    title: "Validate environment configuration at startup instead of failing on first use",
    category: "configuration",
    version: "1.0.0",
    summary:
      "Adds a schema-validated config module that parses process.env once at startup and crashes immediately with a clear error if anything required is missing or invalid, instead of failing later at whatever code path first touches the bad value.",
    variables: [
      {
        name: "configModulePath",
        prompt: "Module path for the validated config object (e.g. src/config.ts)",
        default: "src/config.ts",
      },
    ],
  },
  artifacts: {
    proposal: `## Why

<!-- Fill in: what forces this change now — a specific incident where a
missing or malformed environment variable caused a confusing failure deep
in request handling instead of an obvious one at startup. -->

## What Changes

- Add \`{{configModulePath}}\`: a schema definition for every environment
  variable the application requires, parsed from \`process.env\` once at
  module load, exporting a single typed config object.
- On validation failure, throw immediately with every missing/invalid
  variable listed in one error message (not just the first one
  encountered), so a misconfigured deployment fails at process startup —
  before the server binds a port or accepts a request — not at whatever
  code path first happens to read the bad value.
- Replace a first set of scattered \`process.env.X\` reads with imports
  from \`{{configModulePath}}\`.

## Capabilities

### New Capabilities

- \`startup-config-validation\`: <fill in what this actually covers in
  your project — e.g. "the process exits non-zero immediately if a
  required environment variable is missing">

## Impact

- New: \`{{configModulePath}}\`.
- Modified: the application's entry point (imports \`{{configModulePath}}\`
  first, before any module that depends on configuration); a first set of
  call sites that previously read \`process.env\` directly.
- Dependencies: a schema-validation library (e.g. \`zod\`).
`,
    design: `## Context

<!-- Fill in: current configuration approach (direct process.env reads
scattered through the codebase? a partial config module already exists?),
and how many environment variables the application actually requires. -->

## Goals / Non-Goals

**Goals:**
- An invalid or incomplete environment causes the process to exit
  non-zero immediately at startup, with every problem listed in one
  error message — not one restart-and-retry cycle per missing variable.
- \`{{configModulePath}}\`'s exported config object is fully typed —
  downstream code gets compile-time errors for a typo'd config key,
  not a runtime \`undefined\`.

**Non-Goals:**
- Not migrating every existing \`process.env\` read in the codebase in one
  pass — this template wires up the module and validates the currently-
  critical variables; the rest migrate incrementally afterward.
- Not adding a secrets-manager/vault integration (e.g. fetching values
  from a remote secret store at startup) — this template validates
  whatever is already in \`process.env\`, regardless of how it got there.
- Not adding runtime config reloading — the config object is read once at
  startup and is immutable for the process's lifetime.

## Decisions

### Validation library: <fill in — e.g. zod, chosen for TypeScript-first schema definition with inferred types>

<!-- Rejected alternatives and why. -->

### Validate at module load (import-time), not lazily on first access

Import-time validation guarantees the failure happens during process
startup, before the server binds a port — a lazy/on-first-access check
would let the process appear to start successfully and only fail once a
request happens to trigger the code path that reads the bad value.

## Risks / Trade-offs

- **[Risk]** A stricter schema could reject a currently-deployed
  environment value that was previously read as a raw, uncoerced string
  and happened to work (e.g. a numeric env var currently containing
  whitespace). → **Mitigation**: review the schema against every real
  deployment environment's actual current values before rolling this out,
  not just local development's \`.env\` file.
`,
    tasks: `## 1. Config module

- [ ] 1.1 Add \`{{configModulePath}}\` defining a schema for every
  environment variable the application currently requires.
- [ ] 1.2 Parse \`process.env\` against the schema once at module load;
  export the resulting typed config object.
- [ ] 1.3 On validation failure, throw one error listing every missing or
  invalid variable, not just the first one encountered.

## 2. Startup wiring

- [ ] 2.1 Import \`{{configModulePath}}\` at the top of the application's
  entry point, before any module that depends on configuration, so
  validation runs before the server binds a port.

## 3. Migrate a first set of call sites

- [ ] 3.1 Replace the currently-critical \`process.env.X\` reads with
  imports from \`{{configModulePath}}\`'s typed config object.

## 4. Verification

- [ ] 4.1 Add a test confirming that parsing with a required variable
  missing throws an error naming that variable.
- [ ] 4.2 Add a test confirming that parsing a complete, valid
  environment produces the expected typed config object.
- [ ] 4.3 Manually confirm the process actually exits non-zero (not just
  logs a warning and continues) when started with a required variable
  missing.
`,
  },
};
