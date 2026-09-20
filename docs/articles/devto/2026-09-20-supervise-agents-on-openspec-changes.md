---
title: Supervise the agents that build your OpenSpec changes
published: false
description: OpenSpec Workbench starts a coding agent on a change, shows what it does while it works, and lets you stop it where its work is sound.
tags: openspec, ai, vscode, opensource
cover_image: https://raw.githubusercontent.com/VeryComplexAndLongName/OpenSpec-UI/main/docs/articles/site/supervise-agents-on-openspec-changes/cover.jpg
canonical_url: https://openspec-ui.dev/articles/supervise-agents-on-openspec-changes/
---

*First published on [openspec-ui.dev](https://openspec-ui.dev/articles/supervise-agents-on-openspec-changes/).*

OpenSpec gives an agent something to build from: a proposal, a design, a list
of tasks, and the spec deltas the change will leave behind. What it does not
give you is a way to see the agent while it works.

Several tools draw OpenSpec changes as boards and lists, and they do it well.
Read on 2026-09-20 in their own words, none of the three I compared starts an
agent. OpenSpec Workbench does: it runs an agent CLI on a change, says what
the run is doing while it does it, and lets a person stop it. This is a short
tour of how, and of what it will not promise.

![A run started from a change's card, stopping at a checkpoint, and a stop asked for with a reason](https://raw.githubusercontent.com/VeryComplexAndLongName/OpenSpec-UI/main/docs/images/standalone/tour.gif)

## A change becomes a card

The Pipeline draws every active change in the order the changes declare, with
what a live run last said and what can start alongside what. A card is where
you act: it starts a run, answers a checkpoint, and asks a run to stop, with a
reason. The same Pipeline is in the standalone web application and in the VS
Code extension, and both read the same shared core.

A run is a chain of stages: propose, review, apply, verify, archive, git. You
choose the agent for each stage, and where the chain pauses for you.

## What a run says it is doing

Every run writes a status record: whose it is, where it runs, what it last
said it was doing and how long ago. The Pipeline draws it on the card, and
`openspec-ui-cli status` prints it for every run of the repository, whichever
host started it.

It never says a run is stuck. A silent agent and a hung one look identical,
and telling them apart is a person's judgement, so the tool leaves that call
to you and gives you the last thing the run said and its age.

Changes can run side by side. Each one can have its own git worktree, guarded
by a lease, and `openspec-ui-cli ready` says which ready changes can start
alongside which, and why the others cannot.

## Stop it where its work is sound

A card's Stop asks for a reason. The request is signed with the machine's key.
The run reads it at its next renewal and acts only if it is verified and
fresh, and it stops where its work is sound. From a terminal:

```bash
openspec-ui-cli stop <instanceId> --reason "wrong branch"
```

`--after <task>` lets the run finish a named task first and stops at the next
sound point after it.

## Your agent, per stage

The picker drives the agent CLIs you already have: Claude CLI, GitHub Copilot
CLI, Codex CLI, Gemini CLI, and a local model behind an OpenAI-compatible
endpoint. The CLI-based ones also come in a variant that speaks the Agent
Client Protocol, which carries structured progress instead of scraped text.
The tool never handles an API key: each CLI keeps its own login.

Here is what has actually been run. Claude CLI and Copilot CLI have been run
against the real binaries. Codex and Gemini never have, raw or over ACP: their
adapters are written to the vendors' documented interfaces and tested against
a mocked peer, and if either misbehaves for you, that is the likeliest reason
and a report would be useful. Two ACP caveats are worth knowing before you
choose one: the Claude adapter never asks for permission, and `copilot --acp`
completed file writes and shell commands here without asking either.

## Checkpoints, ceilings and a record

Where a person decides is configuration, and the runner enforces it: an
autonomy level, checkpoints between stages, a review gate that only a change's
own settings can relax, and tasks marked as human-only or delegated to a named
agent. Each stage has its own spending cap in the unit its agent honours, each
chain has a ceiling, and every run lands in an audit log. The project also
states plainly which limits do not exist, in a document of their own.

The Workbench ships 17 change templates, for things like a Vite migration, a
production Dockerfile, an authentication middleware or a testing baseline, so
a new change can start from a proposal that already has the right shape.

## Try it

In VS Code, install it from the Marketplace:

```bash
code --install-extension openspec-ui.openspec-ui-vscode
```

Or run the standalone application from a clone of the repository:

```bash
npm install
npm run build --workspace @openspec-ui/server
npm run start --workspace @openspec-ui/server -- <workspaceRoot> 4317
```

It prints a URL with a one-time token; open that exact URL. Everything runs on
your machine, against your own agent CLIs.

The repository, the packages and the extension are still called OpenSpec-UI;
the product's name is OpenSpec Workbench. The code and the issues are at
[github.com/VeryComplexAndLongName/OpenSpec-UI](https://github.com/VeryComplexAndLongName/OpenSpec-UI),
and I would like to hear from anyone who tries it, above all from people who
run Codex or Gemini, which I have not been able to.

## Where each claim comes from

- The Pipeline, the stages, the status record, `stop`, and the other viewers
  compared on 2026-09-20: the repository's
  [README](https://github.com/VeryComplexAndLongName/OpenSpec-UI/blob/main/README.md),
  sections "How this differs from the other OpenSpec viewers", "Agentic
  Harness" and "CI CLI".
- Which agents have been run against a real binary, and the ACP caveats: the
  README's "Agent Selection" section.
- Checkpoints, autonomy levels and per-stage caps:
  [HARNESS.md](https://github.com/VeryComplexAndLongName/OpenSpec-UI/blob/main/HARNESS.md).
  What does and does not cap a run:
  [LIMITS.md](https://github.com/VeryComplexAndLongName/OpenSpec-UI/blob/main/LIMITS.md).
- The 17 templates:
  [packages/core/src/templates](https://github.com/VeryComplexAndLongName/OpenSpec-UI/tree/main/packages/core/src/templates),
  17 files.
