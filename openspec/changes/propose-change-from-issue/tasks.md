# Tasks

## 1. Core source workflow

- [ ] 1.1 Add bounded `ForgeIssue` normalization in `packages/core/src/forge-issue.ts`; test PR rejection and invalid/oversized sources in its named test file.
- [ ] 1.2 Add optional `Forge.readIssue` and the gh reader in `packages/core/src/gh-pr-gateway.ts`; verify numeric fixed API paths in the issue reader tests.
- [ ] 1.3 Implement all three configured HTTP readers in `packages/core/src/http-forges.ts`; verify fixed paths, GitLab iid, redirect refusal and no remote-link fetching in the issue reader tests.
- [ ] 1.4 Implement preview, revision checking and source-before-share creation in `packages/core/src/issue-change.ts`; test same-origin references and refusal before creation in its named test file.
- [ ] 1.5 Include the bounded source through `prepareAgentContext` in `packages/core/src/security.ts`; test the saved source reaches Propose and unsafe links do not.
- [ ] 1.6 Export the workflow in `packages/core/src/index.ts`; affected Core typecheck must resolve the public types.

## 2. Hosts

- [ ] 2.1 Adapt preview and create in `packages/server/src/rest.ts`; named issue contract tests must preserve revision and cwd authorization.
- [ ] 2.2 Route preview in `packages/server/src/server.ts`; authenticated HTTP smoke must reach the real handler without creating a change during preview.
- [ ] 2.3 Add `IssueChangeForm` in `packages/webui/src/components/IssueChangeForm.tsx`; its selected component test must require preview and confirmation, invalidate edited input and display errors.
- [ ] 2.4 Connect the form in `packages/webui/src/standalone-entry.tsx`; verify new directory refresh through typecheck and the named browser scenario.
- [ ] 2.5 Add native `openspec-ui.createChangeFromIssue` in `packages/extension/src/commands.ts`; a selected native test must prove cancellation makes no change and confirmation passes the preview revision.
- [ ] 2.6 Contribute the native action in `packages/extension/package.json`; control vocabulary checks must accept its verb/noun.
- [ ] 2.7 Register issue action nouns in `packages/core/src/action-vocabulary.ts`; named vocabulary tests must pass.

## 3. Delivery and verification

- [ ] 3.1 Document numbered and URL examples, authentication, confirmation, truncation and explicit Run Change in `docs/how-to/propose-from-an-issue.md`.
- [ ] 3.2 Write authored delivery notes in `.changeset/propose-change-from-issue.md`; verify parsed changeset contents rather than editing package versions.
- [ ] 3.3 Run only named new/affected test files and selections with pinned npm/Node; record counts and exact selections below.
- [ ] 3.4 Run TypeScript only for Core/server/webui/extension, ESLint only changed source paths, strict OpenSpec validation and diff whitespace check; record actual results below.
- [ ] 3.5 Run a real read-only GitHub preview and authenticated HTTP preview/invalid-reference smoke; record source identity and absence of mutation. Do not create a real issue or launch a paid agent for this check.

## Evidence

Full verification is pending in the existing PR CI gates.
