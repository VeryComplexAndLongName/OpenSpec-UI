import type { CatalogTemplate } from "../template-catalog.js";

// New category ("ci-cd") — checks-only pipeline, deliberately not a
// deployment/release template (see design.md's Non-Goals).

export const githubActionsCiPipeline: Omit<CatalogTemplate, "origin"> = {
  manifest: {
    id: "github-actions-ci-pipeline",
    title: "Add a GitHub Actions CI pipeline to a Node.js/TypeScript project",
    category: "ci-cd",
    version: "1.0.0",
    summary:
      "Adds a GitHub Actions workflow that runs lint, typecheck, and test on every push/PR, as a real merge gate.",
    variables: [
      {
        name: "nodeVersion",
        prompt: "Node.js version the workflow should pin (e.g. 22)",
        default: "22",
      },
      {
        name: "defaultBranch",
        prompt: "Default branch the workflow triggers on pushes to (e.g. main)",
        default: "main",
      },
    ],
  },
  artifacts: {
    proposal: `## Why

<!-- Fill in: no CI exists yet, or checks currently only run locally and
get skipped before merge. -->

## What Changes

- Add \`.github/workflows/ci.yml\` triggered on push to \`{{defaultBranch}}\`
  and on every pull request, pinned to Node.js \`{{nodeVersion}}\`.
- Run lint, typecheck, and test as separate steps in one job, failing the
  workflow on any non-zero exit.
- Cache dependencies between runs.

## Capabilities

### New Capabilities

- \`ci-pipeline\`: <fill in what this actually covers in your project>

## Impact

- New: \`.github/workflows/ci.yml\`.
- No application code changes.
`,
    design: `## Context

<!-- Fill in: current state — checks run locally only? partial CI already
exists for a different purpose? -->

## Goals / Non-Goals

**Goals:**
- Every push and PR gets an automatic lint+typecheck+test run with no
  manual trigger.
- A failing step fails the whole job — no continuing past a broken step.

**Non-Goals:**
- Not configuring branch protection / required-check enforcement in this
  change — that is a separate repository-settings step once the workflow
  is proven green.
- Not adding deployment/release steps — this template is CI checks only.

## Decisions

### One job, sequential steps, not parallel jobs per check

<!-- Fill in the actual reason for this project — default rationale:
parallel jobs each pay their own checkout+install cost; for a small-to-
medium project, one job with cached dependencies is faster wall-clock
time despite running sequentially. Revisit if the project's check runtime
grows large enough that checkout+install overhead is no longer the
dominant cost. -->

## Risks / Trade-offs

- **[Risk]** A workflow with no required-check branch protection can
  still be merged past even if it fails. → **Mitigation**: this template
  only adds the workflow; enabling branch protection against it is a
  deliberate separate step, not silently assumed.
`,
    tasks: `## 1. Workflow scaffolding

- [ ] 1.1 Add \`.github/workflows/ci.yml\` triggered on \`push\` to
  \`{{defaultBranch}}\` and on \`pull_request\`, using
  \`actions/setup-node@v4\` pinned to Node.js \`{{nodeVersion}}\` with
  dependency caching enabled.
- [ ] 1.2 Add an install step (\`npm ci\` or the project's equivalent).

## 2. Checks

- [ ] 2.1 Add a lint step running the project's existing lint script;
  confirm it fails the job on a deliberately introduced lint error.
- [ ] 2.2 Add a typecheck step running the project's existing typecheck
  script.
- [ ] 2.3 Add a test step running the project's existing test script.

## 3. Verification

- [ ] 3.1 Push a branch and confirm the workflow runs and reports success
  on a clean checkout.
- [ ] 3.2 Temporarily break one check (e.g. introduce a lint error) on a
  throwaway commit and confirm the workflow reports failure, then revert.
`,
  },
};
