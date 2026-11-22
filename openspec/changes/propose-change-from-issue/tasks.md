# Tasks

## 1. Core source workflow

- [x] 1.1 Add bounded `ForgeIssue` normalization in `packages/core/src/forge-issue.ts`; test PR rejection and invalid/oversized sources in its named test file.
- [x] 1.2 Add optional `Forge.readIssue` and the gh reader in `packages/core/src/gh-pr-gateway.ts`; verify numeric fixed API paths in the issue reader tests.
- [x] 1.3 Implement all three configured HTTP readers in `packages/core/src/http-forges.ts`; verify fixed paths, GitLab iid, redirect refusal and no remote-link fetching in the issue reader tests.
- [x] 1.4 Implement preview, revision checking and source-before-share creation in `packages/core/src/issue-change.ts`; test same-origin references and refusal before creation in its named test file.
- [x] 1.5 Include the bounded source through `prepareAgentContext` in `packages/core/src/security.ts`; test the saved source reaches Propose and unsafe links do not.
- [x] 1.6 Export the workflow in `packages/core/src/index.ts`; affected Core typecheck must resolve the public types.

## 2. Hosts

- [x] 2.1 Adapt preview and create in `packages/server/src/rest.ts`; named issue contract tests must preserve revision and cwd authorization.
- [x] 2.2 Route preview in `packages/server/src/server.ts`; authenticated HTTP smoke must reach the real handler without creating a change during preview.
- [x] 2.3 Add `IssueChangeForm` in `packages/webui/src/components/IssueChangeForm.tsx`; its selected component test must require preview and confirmation, invalidate edited input and display errors.
- [x] 2.4 Connect the form in `packages/webui/src/standalone-entry.tsx`; preserve the existing directory refresh and verify the exact issue/revision request and retained failure input in the named browser scenario. Browser execution belongs to CI; locally create and typecheck the scenario, without claiming it has run.
- [x] 2.5 Add native `openspec-ui.createChangeFromIssue` in `packages/extension/src/commands.ts`; a selected native test must prove cancellation makes no change and confirmation passes the preview revision.
- [x] 2.6 Contribute the native action in `packages/extension/package.json`; control vocabulary checks must accept its verb/noun.
- [x] 2.7 Register issue action nouns in `packages/core/src/action-vocabulary.ts`; named vocabulary tests must pass.
- [x] 2.8 Register confirmation/refusal identifiers in `packages/core/src/message-register.ts`; the named message register test must pass with its existing ratchet.
- [x] 2.9 Retain issued identifiers in `packages/core/src/message-register.test.ts`; the GIVEN ledger must include OSW-CHG-019 through OSW-CHG-032.
- [x] 2.10 Regenerate `docs/messages.md` using the Core messages script; the generated-page comparison must pass.
- [x] 2.11 List `createChangeFromIssue` in `packages/extension/src/one-way-in.test.ts` as a command that asks first; the selected "a command that asks before it acts says so" tests must pass. Keep the ellipsis and the actual confirmation.

## 3. Delivery and verification

- [x] 3.1 Document numbered and URL examples, authentication, confirmation, truncation and explicit Run Change in `docs/how-to/propose-from-an-issue.md`.
- [x] 3.2 Write authored delivery notes in `.changeset/propose-change-from-issue.md`; verify parsed changeset contents rather than editing package versions.
- [x] 3.3 Run only named new/affected test files and selections with pinned npm/Node; record counts and exact selections below.
- [x] 3.4 Run TypeScript only for Core/server/webui/extension, ESLint only changed source paths, strict OpenSpec validation and diff whitespace check; record actual results below.
- [x] 3.5 Run a real read-only GitHub preview and authenticated HTTP preview/invalid-reference smoke; record source identity and absence of mutation. Do not create a real issue or launch a paid agent for this check.

## Evidence

- Core readers/source tests: 23 passed, one POSIX symlink test skipped on Windows; that test is required by Linux PR CI.
- `node node_modules/vitest/vitest.mjs run packages/server/src/issue-change-rest.test.ts`: 1 passed through real authenticated HTTP with Core boundary spies, including cwd/token rejection, revision forwarding and source-change refusal.
- From `packages/webui`, `node ../../node_modules/vitest/vitest.mjs run src/components/IssueChangeForm.test.tsx`: 3 passed. The first attempted config invocation from root could not resolve the package setup file; running from its intended package cwd passed.
- `node node_modules/vitest/vitest.mjs run packages/extension/src/commands.test.ts -t 'creates from an issue only'`: 1 passed, 178 filtered; cancellation, plain-text preview and exact confirmed revision verified, no Run Plan call.
- Core issue/message and extension vocabulary selections: 34 passed, 1 POSIX-only skipped. A new confirmation was initially unregistered; it now has OSW-CHG-019 and all issue refusals have OSW-CHG-020 through OSW-CHG-032. Generated messages page matches the register.
- Real read-only authenticated REST preview: `https://github.com/Fission-AI/OpenSpec/issues/2291`, title `Community schema: code-migration`, revision `43bedd4c05cc2f05aca7de18ea82d66ab443ae9b5012866b98b9da87fdd419c1`; HTTP 200, foreign URL 400, wrong authentication 401, git status unchanged, zero agent runners. OpenSpec-UI has no issues, so this used an owned temporary repository with the public upstream origin, not a newly created issue. Fixture/server were cleaned up.

- Final scoped verification: Core/server/webui/extension TypeScript and server e2e TypeScript passed. ESLint passed on every changed/new TypeScript path. Strict OpenSpec validation and git diff whitespace check passed. New test-budget analysis and exact authored changeset parsing passed (Core, webui, server, extension and bundled CLI Workbench). Browser issue/revision forwarding/refusal scenario is created and typechecked; its real execution remains pending in PR CI.

Full verification is pending in the existing PR CI gates.

Actual main conflict: both this change and launch-workbench-from-npm inserted a browser scenario at the same location. git merge-tree reported that conflict, so the branch was rebased onto origin/main and both complete scenarios retained. Server e2e TypeScript, the Core source/message selections (21 passed, one POSIX-only skipped), and authored notes/budgets were rechecked after resolution. No manual rebase was done solely for freshness.

CI run 44902771153 found a cross-platform fixture error in issue-change-rest.test.ts: Z:/outside-workspace is relative on Linux. The refusal check now uses path.resolve(cwd, '..', 'issue-outside-workspace'). The selected real HTTP contract test passed locally after correction (1 test, 207 ms); changed-file ESLint and whitespace checks passed. Full-log review also found the native one-way-in manifest contract needed to list the new command among commands that ask first. Core issue readers, source workflow (including the POSIX symlink case), security and Shared UI tests passed in that Linux run. Dependent browser/integration gates were skipped, so full CI remains pending.

Native confirmation contract selection: 3 passed, 6 filtered; changed-file ESLint and whitespace checks passed. Run 45005317673 could not start any required job: GitHub reported that the account is locked due to a billing issue. Full CI, merge, archival and registry publication remain pending until Actions is available.
