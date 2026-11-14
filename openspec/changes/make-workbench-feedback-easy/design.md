# Design

## Context

The local-first host model in [ADR 0001](../../../docs/adr/0001-shared-core-two-delivery-targets.md) and the report behind the CLI doctor already cover environment discovery.

## Decisions

- Use a fixed GitHub draft URL and explicit copy. Including the diagnostics in the draft URL was rejected because that puts the report in a network request before submission.
- Compose diagnostics from known version, platform and failure category fields. Raw output and workspace data were rejected because an issue is public.
- Reuse the CLI doctor's Core report from a native VS Code command. Repeating tool discovery inside the browser was rejected because its environment does not own the CLI.

## Non-Goals

- Automatic submissions, instrumentation, and uploading run logs.

## Risks / Trade-offs

Host metadata can be unavailable. The preview says unknown for a missing version or platform. The draft opens separately so the user can choose which details to paste.

## Verification evidence

The standalone browser test `previews and copies diagnostics after a failed run` passed with the running server. The failure category and host metadata reached the preview, and the clipboard matched its text. The real VS Code Extension Development Host test opened a diagnosis with a controlled Node prerequisite and its remedy. See [tasks.md](tasks.md#verification-evidence).
