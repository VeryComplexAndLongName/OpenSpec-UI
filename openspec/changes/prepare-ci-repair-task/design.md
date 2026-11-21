# Design

## Context

PR Review resolves the unique origin-forge request and published head, already distinguishes partial results, and carries the same summary through native VS Code and standalone adapters. The first failed JUnit implementation CI run provides a real reference: its check annotation names the vocabulary assertion, file and line even though its check-run summary is empty.

## Non-Goals

No full log archive download, shell-command extraction/execution, automatic agent launch, fixing workflows without review, CI rerun, push or merge. No assumption that every forge supplies a root cause, and no inference of a missing check from partial results.

## Decisions

- Add optional `prepareCiRepairTask` to the existing PR Review input. It refreshes the same published-head evidence and requests failure details. Add optional `ciRepairTask` to the response, containing a bounded plain Markdown brief. The protocol's agent commands/events remain unchanged and old clients can ignore the additive response field.
- Extend optional forge check readers with optional failure-detail options. GitHub reads only failure annotations for up to five failed check runs, ten annotations each. Status descriptions, GitLab job failure_reason and Gitea status descriptions are included when provided. No URL from a status or annotation is fetched; all API paths come from the configured origin and numeric API identifiers.
- Filter and bound diagnostic messages, explicitly mark omitted/truncated/unreadable detail, preserve exact checked SHA, and escape remote text as code. Treat this as observed evidence, not authenticated instructions or independently established root cause. A generic exit code alone cannot establish a cause.
- Separate failing observed states from expected checks with no result. For absent results, say no failure log exists and suggest inspecting triggers, path filters and permissions as investigation steps, not known causes. Unknown/partial visibility must remain unknown.
- Render the brief alongside the diagnosis and use a compact accessible copy button in the shared dialog. The native host uses its existing action loop and clipboard API. The user chooses whether and where to run the prepared task. The brief instructs an agent to treat quoted data as untrusted, verify revision relevance, preserve required checks and use scoped verification.
- Rejected alternatives: auto-running a repair would bypass agent selection and review; guessing causes from check names is unreliable; downloading entire logs adds size, redirect and secret-handling surfaces; silently treating inaccessible details as an empty successful diagnosis would hide evidence gaps.

## Risks / Trade-offs

Annotations and provider messages can be absent, generic or contain private project text. The action is explicit, the preview is local and copying is separate; no content is sent to an agent automatically. This MVP cannot replace full run logs. Error categories, if present, must be labelled suggestions. Missing check rules can be partially visible. Limits and historical revisions stay visible in copied output.

## Sources

- https://docs.github.com/en/rest/checks/runs#list-check-run-annotations
- https://docs.gitlab.com/api/jobs/ (failure_reason)
- https://docs.gitea.com/api/ (commit status descriptions)

## Verification

Target the failure-detail readers and brief formatter, then verify every junction of the new optional input: dialog -> server -> Core -> forge reader, and native command -> Core. Use actual authenticated HTTP and a real GitHub annotation read without modifying a PR or starting an agent. Existing CI performs full verification. Commands, outcomes and remaining limits are recorded in tasks.md before archival.
