---
title: How Codex runs a Harness stage
summary: OpenSpec Workbench assigns a sandbox to each Codex stage and reads the result of the turn through the native CLI or ACP.
cover: cover.png
cover_alt: The blue OpenSpec Workbench owl raises a shield beside the title How Codex runs a Harness stage.
---

The first file-write trial ended with exit code `0`. There was no file. The agent had said the workspace was read-only, and the OpenSpec Workbench adapter had taken the process exit code as the result of the turn. That was the behavior observed with Codex CLI 0.164.0 on 24 October 2026.

The missing file exposed two decisions the adapter had left to defaults. Codex needed an explicit answer about where it could write, and Workbench needed to read what happened in the turn.

## The stage chooses the sandbox

In Harness Settings, a stage can name `codex-cli` as its agent and select a model and reasoning effort. The adapter picks the sandbox from the stage's job. Propose, update, apply, and verify use `workspace-write`. Review uses `read-only`. Verification can run checks that write build artifacts or caches, which is why it uses the writable mode too.

Workbench resolves the working directory before it launches the agent. If the change has its own worktree, the run starts there. Codex then enforces its own filesystem sandbox for the child process. In the trial, `workspace-write` allowed a write in the worktree, refused one in its parent area, and allowed one in the system temporary directory. The selected mode is part of the invocation Workbench checks.

## Two adapters, two ways to set the options

The native adapter runs `codex exec --json`. The stream carries the turn result, messages, command exit codes, changed files, and token usage. Workbench can see a failed turn as well as the process that delivered it.

Choose `codex-cli-acp` to use the separately installed `@agentclientprotocol/codex-acp` bridge. Here the bridge lists the available session options when the session opens. Workbench checks the requested mode, model, and reasoning effort against that list, then sets the options before it sends the prompt. An unsupported model or effort stops the stage with a diagnostic that names the choices the bridge offered. The first live apply trial used bridge version 2.2.2 and returned both file changes and usage.

The two paths share the same stage-to-sandbox policy. The bridge can also send context updates while a stage runs. The run's recorded usage is available afterward.

## Try it

Pick a small change in its own worktree. Assign Codex to Review and Apply in the change's Harness Settings, then run those stages in order. Open the run output to see what each stage did. With the CLI installed, you can inspect the registered adapters and the persisted run from the same repository.

```bash
openspec-ui-cli show agents
openspec-ui-cli show run <runId>
```

The implementation decisions and live trial details are in [ADR 0051](https://github.com/VeryComplexAndLongName/OpenSpec-UI/blob/main/docs/adr/0051-codex-runs-in-a-named-sandbox.md) and [ADR 0052](https://github.com/VeryComplexAndLongName/OpenSpec-UI/blob/main/docs/adr/0052-acp-session-options-are-checked-then-set.md).
