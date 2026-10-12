---
title: A compliance monitor that does not busywork
published: false
description: OpenSpec Workbench now ships a versioned catalogue of rules, checks that run only when the host is idle, and findings that explain what is wrong without moving a single file.
tags: openspec, devtools, compliance, opensource
cover_image: https://raw.githubusercontent.com/VeryComplexAndLongName/OpenSpec-UI/main/docs/articles/site/a-compliance-monitor-that-does-not-busywork/cover.jpg
canonical_url: https://openspec-ui.dev/articles/a-compliance-monitor-that-does-not-busywork/
---

*First published on [openspec-ui.dev](https://openspec-ui.dev/articles/a-compliance-monitor-that-does-not-busywork/).*

OpenSpec Workbench initializes repositories and runs agents on changes. It
did not, until now, check that its own runtime files are ignored, or that
its repository rules are consistent. A compliance monitor has been added to
the shared core, and it does three things that matter: it keeps a versioned
catalogue of rules, it runs only when the host reports idle, and it reports
findings without moving or deleting anything.

## The catalogue, versioned and evidence-linked

Every rule in the catalogue carries a stable identifier, a description of
what it checks, and metadata about the check's cost and whether it supports
automatic repair. Each finding is linked back to the rule that produced it
and to the evidence that triggered it, so you can trace a finding to the
exact check and the exact file or state that caused it.

The catalogue is versioned. When a rule changes, the new version is applied
to future checks, and old findings remain linked to the version that
produced them. This matters when a rule's threshold is tightened or
relaxed: old findings do not retroactively become violations or pass.

## What it checks, on initialization

On explicit repository initialization, the monitor verifies that Workbench
runtime state is ignored by Git. It adds only the missing managed ignore
rule, preserving the rest of `.gitignore` exactly as you wrote it. Nothing
is overwritten.

It also checks Workbench runtime files in the main checkout and in
worktrees. It identifies untracked or visible state and explains the
expected root for each state kind without moving or deleting it. A run
journal in `.openspec-ui/` is expected to be untracked; a lease file in the
main checkout is expected to be ignored. The monitor says which is which,
and why.

## Grouping, deduplication and shadow detection

When the same change id appears in multiple worktrees, the monitor groups
them as one logical change and reports the count. It flags a change id
present in both active and archive trees, an archived change left in a
stale worktree, or a shadow copy in main beside its owning worktree. The
Pipeline card count is reconciled with the Changes list, and active changes
missing from the OpenSpec README index are flagged with a suggested link,
not an automatic edit.

## Per-rule reactions and a periodic schedule

Each rule accepts one of three response settings: `autorepair`, `advice`
or `none`. `autorepair` applies a fix without asking; `advice` produces a
finding with a suggested action; `none` records the finding silently. A
global periodic-monitor switch enables or disables the entire schedule.

The monitor runs one bounded batch only after the host reports idle and no
mutating Workbench run is active. It measures each check's elapsed time,
schedules by due date and conservative cost, and spreads expensive checks
across later idle windows. Nothing runs as a separate OS daemon.

## Process ledger and orphan detection

A companion capability, the process ledger, records a synchronous snapshot
for every process spawned by Workbench: PID, OS start time, executable,
hostname, cwd, change, and a secret-free command-line hash. Records are
marked exited on normal close and kept durable across host restarts, keyed
by canonical repository identity and hostname.

Before any kill, the snapshot is re-verified against the operating system.
Orphaned and overdue processes are surfaced as read-only Compliance
findings. An explicit, confirmable kill lives in the existing recovery
surface, never in Compliance itself. The two capabilities share the same
catalogue but never cross their boundaries: Compliance explains, recovery
acts.

## What this deliberately does not do

The monitor does not start a background daemon, does not modify source code,
does not run on every file change, and does not replace a linter or a
formatter. It checks Workbench's own runtime hygiene and the consistency of
its repository state.

## Try it

The code is at
[github.com/VeryComplexAndLongName/OpenSpec-UI](https://github.com/VeryComplexAndLongName/OpenSpec-UI),
where the repository and packages keep the name OpenSpec-UI.

```bash
openspec-ui-cli compliance check --cwd .
```
