import type { CatalogTemplate } from "../template-catalog.js";

// Python-side counterpart to `node-vitest-testing-baseline` — same
// "baseline, not a claimed complete strategy" scope, different ecosystem.

export const pytestCoverageBaseline: Omit<CatalogTemplate, "origin"> = {
  manifest: {
    id: "pytest-coverage-baseline",
    title: "Add a pytest + coverage baseline to a Python project",
    category: "testing",
    version: "1.0.0",
    summary:
      "Adds pytest as the test runner and pytest-cov for coverage reporting to a Python project that has neither yet, with a first real test as proof.",
    variables: [
      {
        name: "packageName",
        prompt: "Python package/module name containing the code to test (e.g. app)",
        default: "app",
      },
    ],
  },
  artifacts: {
    proposal: `## Why

<!-- Fill in: what forces this change now — no automated tests exist yet,
or a specific regression that automated testing would have caught. -->

## What Changes

- Add \`pytest\` and \`pytest-cov\` as dev dependencies.
- Add \`[tool.pytest.ini_options]\` (\`testpaths = ["tests"]\`) to
  \`pyproject.toml\`.
- Add a first real test under \`tests/\` covering one existing,
  currently-untested function in \`{{packageName}}\`, proving the setup
  actually runs and catches a real regression if introduced.

## Capabilities

### New Capabilities

- \`test-tooling\`: <fill in what this actually covers in your project —
  e.g. "unit tests run in CI on every push">

## Impact

- New: \`tests/\` directory, pytest config in \`pyproject.toml\`, one new
  \`test_*.py\` file.
- Modified: dependency manifest (\`pyproject.toml\`/\`requirements-dev.txt\`).
- Dependencies: \`pytest\`, \`pytest-cov\`.
`,
    design: `## Context

<!-- Fill in: current state (zero tests? a different test runner already
in partial use?), CI setup if one already exists. -->

## Goals / Non-Goals

**Goals:**
- \`pytest\` run from the repo root discovers and runs the full suite,
  exiting non-zero on failure — usable as a CI gate immediately.
- Coverage reporting is wired in but not yet gated on a threshold.

**Non-Goals:**
- Not adopting a specific coverage-percentage gate in this change — that
  is a separate policy decision to make once a baseline exists.
- Not migrating an existing test runner (if one is already partially in
  use) — this template is for a project with none yet.

## Decisions

### Test layout: \`tests/\` mirroring \`{{packageName}}/\`, not colocated \`test_*.py\` files

<!-- Fill in the actual reason for this specific project if it differs —
default rationale: a separate tree keeps test discovery config simple and
avoids shipping test files inside the installed package. -->

### Coverage tool: \`pytest-cov\`, not a separate \`coverage run\` invocation

\`pytest-cov\` integrates coverage collection directly into the \`pytest\`
run instead of requiring a separate \`coverage run -m pytest\` step.

## Risks / Trade-offs

- **[Risk]** A test suite with only one test provides minimal real
  regression coverage. → **Mitigation**: explicitly scoped as a baseline/
  proof, not a claim of adequate coverage — coverage grows from here as an
  ongoing practice, not a one-time change.
`,
    tasks: `## 1. pytest setup

- [ ] 1.1 Add \`pytest\` as a dev dependency; add \`[tool.pytest.ini_options]\`
  with \`testpaths = ["tests"]\` to \`pyproject.toml\`.
- [ ] 1.2 Add \`tests/__init__.py\` (if the project uses package-style test
  discovery).

## 2. Coverage setup

- [ ] 2.1 Add \`pytest-cov\` as a dev dependency.
- [ ] 2.2 Add a test command running \`pytest --cov={{packageName}}\` and
  confirm it prints a coverage summary.

## 3. First real test

- [ ] 3.1 Pick one existing, currently-untested function in
  \`{{packageName}}\` and add \`tests/test_<module>.py\` covering its main
  behavior and at least one edge case.
- [ ] 3.2 Confirm the test fails if the function's behavior is
  deliberately broken (temporarily, to prove it actually catches a
  regression), then passes again once reverted.

## 4. Verification

- [ ] 4.1 Run the test command from a clean checkout and confirm it exits
  0 with the new test included in the run.
`,
  },
};
