# Design

## Completed browser contract evidence

CI run https://github.com/VeryComplexAndLongName/OpenSpec-UI/actions/runs/44894960042 passed `e2e/junit-review.spec.ts` ("imports a selected JUnit file and copies qualified scenario results", 3.8s). It covers real file input through the webui/server boundary, all six displayed states, reopening and actual clipboard contents with declared revision qualifications and no raw test output. All 34 browser tests passed. The local Edge upload/clipboard tooling limitations recorded in tasks.md remain historical method limitations, not an unverified product path. Final all-gates CI is still required before merge.

## Context

See proposal.md and the current pr-review specification. readPrReview already reads scenario deltas and check mappings from the displayed git tree; both hosts render its summary. There is no testcase ingestion path.

## Goals / Non-Goals

Goals: a useful local JUnit workflow in both hosts, precise testcase identity, bounded safe parsing and honest revision attribution.

Non-Goals: proving coverage from a passing job, automatic test generation, remote artifact fetching, automatically trusting XML commit properties, changing agent protocols, or graphical mapping-file edits in this MVP.

## Decisions

Use saxes in Core, reject DTDs and malformed XML, limit UTF-8 input to 128 KiB, nesting to 64 and testcases to 2,000. Accept testsuite or testsuites roots with nested suites. Normalize only testcase classname, name and outcome; discard failure text, stdout, properties and timestamps. Duplicate testcase identities remain ambiguous, including retries.

Use committed scenario-tests.json alongside the proposal: scenarios[{capability,requirement,scenario,tests:[{classname,name}]}]. Read it from the reviewed commit, not the working tree. Exact identities avoid fuzzy matches. Invalid, duplicate or unknown scenario entries invalidate the mapping and remain visible. A missing or skipped result is not a pass.

The optional showPrReview payload junitImport contains head, testedCommit and xml. Require the displayed head still to be current and the declared commit to exist locally before importing. Store only normalized results, imported time and the declared commit in the repository's Git common directory, under a hash of the change name. This shares evidence across linked worktrees without tracking it. Use regular bounded files and atomic replacement. A different commit is historical evidence and cannot be presented as a current pass. Even a matching revision is labelled user-declared, not independently verified. Keep at most the latest imported report per change.

Standalone selects a file and requires an explicit SHA before Import; use compact icon controls with accessible names/tooltips. VS Code uses its native file chooser and input box and checks the size before reading. Server routes the optional payload to Core and applies its existing write-ownership refusal to imports. No command/event changes; old clients can ignore the additive input.

Rejected alternatives: inferring HEAD from import time, because downloaded results may be old; trusting suite-level pass totals, because absent testcases then look tested; accepting report filesystem paths over REST, because it exposes arbitrary server files; adding XML to the repository, because it leaks outputs and creates noise; guessing scenario associations from test text, because incorrect matches look authoritative.

## Risks / Trade-offs

The declared commit is an operator assertion, not cryptographic CI provenance. A report may be incomplete even when a mapped testcase is present. Results are observations, not proof of semantic coverage. Initial mapping is a documented JSON edit that must be committed. Large reports must be split or reduced to the relevant suite. No report/raw output is uploaded automatically.

## Verification

Passed: targeted parser/storage and PR Review integration tests (17 tests including linked-worktree recovery), standalone authenticated import/ownership contract tests (9), the UI import form tests (8), native VS Code input-collection tests (3) and command forwarding/ownership tests (2), and the message register/parser follow-up (23). Scoped lint, all four affected TypeScript projects and standalone build passed. Actual commands are recorded in tasks.md; full CI is pending.

The live Edge browser displayed all six normalized states after a real authenticated HTTP import and confirmed the copy action. Its extension permissions prevent automated file selection and its clipboard reader returns empty. Those edges are covered by component/HTTP/native-host tests; an end-to-end native file-picker/clipboard-read pass is not claimed. These tooling limits do not change the delivered import behavior.
