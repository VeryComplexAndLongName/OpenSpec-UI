## Context

OpenSpec's context and artifact rules reach new planning instructions;
the task rules also reach implementing agents through the core's trusted
rules section. Agents started directly follow AGENTS.md's pointer to
CLAUDE.md. Both paths must describe the same verification scope.

The local Harness expands check(test), check(lint), and check(typecheck)
to root npm scripts. Merely avoiding a manual npm run verify would still
let new task declarations start full local runs mechanically.

## Decisions

Keep openspec/config.yaml as the source of truth, including policy in
the context and actionable task/apply guidance. CLAUDE.md points there;
the runbook explains selected test files/names, lint paths, affected
TypeScript projects, and relevant smoke/contract checks.

Full suites, including unfiltered suites within one package, run only
in CI. Dividing a full run into batches, worktrees, or agent assignments
does not make it targeted. New local tasks do not declare the three
mechanical checks that expand to unscoped root commands.

Keep complete verification in the existing CI gates rather than adding
a full-suite item to the local tasks.md checklist. The merge gate reads
that checklist, so a task that can close only after all CI gates pass
would make the two wait on each other.

Rejected: keeping the preference only in this conversation or in one
change's tasks, because future agents would not receive it. Rejected:
removing or weakening CI gates, because scoped local checks rely on CI
for complete coverage. Rejected: changing the generic Harness runtime,
because this request governs this repository's agent workflow.

## Non-Goals

No test runner, CI job, approval gate, security boundary, or application
behavior changes. Existing archived verification records remain history.

## Risks / Trade-offs

Targeted local checks can miss unrelated regressions, so full CI remains
required. Instruction text is a governance rule, not a process-level ban
on arbitrary local commands. Any existing explicit task that conflicts
must be updated before it is executed; the rule does not rewrite history.

## Verification

Run only the existing OpenSpec config test file, validate this change,
and inspect real generated proposal/design/tasks instructions to confirm
the policy reaches agents. Check authored files for English and whitespace
issues. Leave full suites and builds to CI.
