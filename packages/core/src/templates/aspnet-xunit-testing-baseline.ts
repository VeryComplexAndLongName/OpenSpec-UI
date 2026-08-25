import type { CatalogTemplate } from "../template-catalog.js";

// ASP.NET Core counterpart to `node-vitest-testing-baseline` /
// `pytest-coverage-baseline` — same "baseline, not a claimed complete
// strategy" scope, different ecosystem.

export const aspnetXunitTestingBaseline: Omit<CatalogTemplate, "origin"> = {
  manifest: {
    id: "aspnet-xunit-testing-baseline",
    title: "Add an xUnit testing baseline to an ASP.NET Core project",
    category: "testing",
    version: "1.0.0",
    summary:
      "Adds xUnit as the test runner and coverlet for coverage collection to an ASP.NET Core project that has neither yet, with a first real test as proof.",
    variables: [
      {
        name: "projectName",
        prompt: "Name of the main project being tested (e.g. MyApp)",
        default: "MyApp",
      },
      {
        name: "testProjectName",
        prompt: "Name for the new test project (e.g. MyApp.Tests)",
        default: "MyApp.Tests",
      },
    ],
  },
  artifacts: {
    proposal: `## Why

<!-- Fill in: what forces this change now — no automated tests exist yet,
or a specific regression that automated testing would have caught. -->

## What Changes

- Add a new \`{{testProjectName}}\` xUnit test project referencing
  \`{{projectName}}\`.
- Add \`coverlet.collector\` for coverage collection via
  \`dotnet test --collect:"XPlat Code Coverage"\`.
- Add a first real test covering one existing, currently-untested class or
  method in \`{{projectName}}\`, proving the setup actually runs and catches
  a real regression if introduced.

## Capabilities

### New Capabilities

- \`test-tooling\`: <fill in what this actually covers in your project —
  e.g. "unit tests run in CI on every push">

## Impact

- New: \`{{testProjectName}}/\` project directory, one new \`*Tests.cs\` file.
- Modified: solution file (\`.sln\`, if one exists) to include
  \`{{testProjectName}}\`.
- Dependencies: \`xunit\`, \`xunit.runner.visualstudio\`, \`coverlet.collector\`
  (all inside \`{{testProjectName}}\`; \`{{projectName}}\` itself gets no new
  dependencies).
`,
    design: `## Context

<!-- Fill in: current state (zero tests? a different test framework already
in partial use?), CI setup if one already exists. -->

## Goals / Non-Goals

**Goals:**
- \`dotnet test\` run from the repo root discovers and runs the full suite,
  exiting non-zero on failure — usable as a CI gate immediately.
- Coverage collection is wired in but not yet gated on a threshold.

**Non-Goals:**
- Not adopting a specific coverage-percentage gate in this change — that
  is a separate policy decision to make once a baseline exists.
- Not migrating an existing test framework (if one is already partially in
  use, e.g. MSTest or NUnit) — this template is for a project with none yet.

## Decisions

### Test project layout: separate \`{{testProjectName}}\` project, not a test folder inside \`{{projectName}}\`

A separate project keeps test-only dependencies (\`xunit\`,
\`coverlet.collector\`) out of the shipped application's dependency graph,
matching the .NET ecosystem's conventional per-project test layout.

### Assertion style: xUnit's built-in \`Assert\`, not a separate fluent-assertion library

<!-- Fill in the actual reason for this specific project if it differs —
default rationale: no additional dependency needed for a baseline; a
fluent-assertion library can be adopted later without restructuring tests. -->

## Risks / Trade-offs

- **[Risk]** A test suite with only one test provides minimal real
  regression coverage. → **Mitigation**: explicitly scoped as a baseline/
  proof, not a claim of adequate coverage — coverage grows from here as an
  ongoing practice, not a one-time change.
`,
    tasks: `## 1. Test project setup

- [ ] 1.1 Create \`{{testProjectName}}\` (\`dotnet new xunit -o {{testProjectName}}\`)
  and add a project reference to \`{{projectName}}\`.
- [ ] 1.2 Add \`{{testProjectName}}\` to the solution file, if one exists
  (\`dotnet sln add {{testProjectName}}\`).

## 2. Coverage setup

- [ ] 2.1 Confirm \`coverlet.collector\` is referenced in
  \`{{testProjectName}}\` (included by the \`dotnet new xunit\` template by
  default; add explicitly if missing).
- [ ] 2.2 Run \`dotnet test --collect:"XPlat Code Coverage"\` and confirm it
  produces a coverage report.

## 3. First real test

- [ ] 3.1 Pick one existing, currently-untested class or method in
  \`{{projectName}}\` and add a test class in \`{{testProjectName}}\` covering
  its main behavior and at least one edge case.
- [ ] 3.2 Confirm the test fails if the behavior is deliberately broken
  (temporarily, to prove it actually catches a regression), then passes
  again once reverted.

## 4. Verification

- [ ] 4.1 Run \`dotnet test\` from a clean checkout and confirm it exits 0
  with the new test included in the run.
`,
  },
};
