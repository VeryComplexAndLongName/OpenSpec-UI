Asked on 2026-10-07. ADR 0043.

## 1. Core

- [x] 1.1 `agent-workflow-rules.ts`, `managed-sections.ts`: the section,
  `workflowRulesNeedConsent`, `writeWorkflowRules`; `repo-bootstrap.ts`
  takes a file made with the rules alone as its own (design.md decisions
  1 to 3). Tests in `agent-workflow-rules.test.ts`: the text, created,
  skipped and appended, rewritten in place, beside the guidelines in
  either order.
  Five cases pass.
- [x] 1.2 `change-worktrees.ts`: a directory for a change that exists
  nowhere yet (decision 4). Tests: the refusal for a change only in the
  checkout, a plan for a new one; the CLI's `worktree add` test likewise.
- [x] 1.3 `change-in-its-worktree.ts` (decision 5). Tests: cut from
  `origin/main` after a fetch and made there; made in the workspace
  without a remote.
- [x] 1.4 The rules say the setup must be on the server first, and how
  (design.md decision 7); both hosts say so when initialization ends.
  Found by the owner on 2026-10-07. Test: the text in
  `agent-workflow-rules.test.ts`; the extension's message in
  `commands.test.ts`.

- [x] 1.5 `openspec-setup-commit.ts`: `uncommittedPaths`,
  `commitOpenSpecSetup`, `describeSetupCommitted`; the rules let the agent
  commit the setup and go on (design.md decision 8). Found by the owner on
  2026-10-07, when Copilot stopped. Tests in
  `openspec-setup-commit.test.ts` (only what initializing made, not on
  another branch or without a remote, a refused push), the text in
  `agent-workflow-rules.test.ts`; the extension's offer in
  `commands.test.ts`; the server's in `server.test.ts`, against a real
  bare remote.

## 2. Hosts

- [x] 2.1 `packages/extension`: the rules on initialize and in "Write
  Agent Workflow Rules", asked before a file somebody else wrote; Create
  and Create Change Template in a working directory. Tests in
  `commands.test.ts`.
  Three new cases; 167 pass.
- [x] 2.2 `packages/server`, `packages/webui`: init writes the rules, with
  `appendWorkflowRules` from the form's checkbox; create returns the
  directory and the page follows it; the `cwd` policy allows the
  repository's own working directories (decision 6). Tests in
  `server.test.ts`: init with and without consent; the policy.

## 3. Documents

- [x] 3.1 `docs/adr/0043-a-change-is-made-in-a-working-directory-of-its-own.md`;
  `docs/adr/README.md` row; `docs/how-to/run-changes-side-by-side.md`.
- [x] 3.2 A changeset: core, extension, server, webui, minor.

## 4. Checks

- [x] 4.1 `npm run typecheck && npm run lint`, and every test project.
  Typecheck clean; lint 0 errors (3 warnings in lines this change did not
  touch); seven script tests and the English check pass. Core 2168,
  core-git-subprocess 70, cli 207, webui 724, server 125, extension 512
  passed; the browser tests `standalone.spec.ts` and
  `documentation-screenshots.spec.ts`, which reach the page's create and
  init, pass.
- [x] 4.2 `openspec validate agents-are-told-how-work-is-done-here
  --strict`, and the merge gate with the worktree's absolute path as
  `--cwd`.
  Valid; the gate reports only 4.4 open (Human-only).
- [x] 4.3 One live run: initialize OpenSpec in a scratch repository with a
  remote, and see the section in `CLAUDE.md`; then ask an agent there,
  outside the product, to create a change, and see it make the change in
  `../.worktrees/<repository>/<change-id>`.
  2026-10-07: a repository `greetlib` with a bare `origin`, initialized
  through core's `initOpenSpec` and `writeWorkflowRules` (`claude`,
  `github-copilot`); both files were created with the section, naming
  `../.worktrees/greetlib/<change-id>`. Then `copilot -p "Create a new
  OpenSpec change named add-greeting ..."`, run by hand outside the
  product: it made `../.worktrees/greetlib/add-greeting` on branch
  `add-greeting` from `origin/main`, wrote the proposal, a spec delta, a
  design and the tasks there, validated, committed and pushed the branch,
  and said it found no `agent-harness.json`, so no stage was named for
  another agent. The main checkout stayed on `main` with nothing changed.
- [ ] 4.4 **Human-only**: initialize a new repository from either host,
  then have an agent of your own create a change there, and see it go to
  its own working directory.