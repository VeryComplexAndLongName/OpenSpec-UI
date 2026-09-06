# Design

## Context

The extension contributes 36 commands and five of them appear in a menu.
The repository's own quality commands — `lint`, `typecheck`, `test` —
appear in none, and are run from a terminal.

The harness already runs exactly those three. `mechanical-checks.ts`
declares `typecheck`, `test` and `lint` as named checks and executes them
through `runNpmScript`, with a result shape that states which command
ran, in which directory, and what came back. The `verify` stage uses it
before it invokes an agent at all.

So this change is wiring, not machinery. The question it has to answer is
not *how* to run a check — that exists — but *which script* to run in a
workspace this extension did not write.

## The problem with the obvious answer

Hard-coding `npm run lint` is wrong for a general-purpose extension. A
workspace may have no `lint` script; it may have one that means something
else; it may have one that takes four minutes when a faster subset
exists. An extension that assumes will either fail confusingly or run the
wrong thing confidently.

## Decision: three ways to resolve, in a stated order

1. **A setting names the script.** `openspec-ui.checks` maps a check name
   to the script that runs it. Explicit, per workspace, and wins over
   everything else.
2. **Otherwise, prefer `osui-<name>` when it exists.** A repository that
   wants to expose something different to this extension than to its own
   contributors — a faster subset, a narrower lint — can say so by adding
   `osui-lint` beside `lint`, without a setting and without renaming what
   it already has.
3. **Otherwise, fall back to `<name>`.** The common case, where a
   workspace's `lint` is what a person means by lint.

If none of the three resolves, the extension offers no command for that
check. That is the important half: an absent script is a workspace that
does not do this, not an error to report.

### Why not just the setting

A setting alone is correct and unhelpful: every workspace would have to
configure before anything appeared, and most would never find out the
feature existed. The `osui-` convention gives a repository a
zero-configuration way to opt in and, more usefully, a way to expose a
*different* command than its own — which a setting can also do, but only
after someone reads the documentation.

### Why not just the convention

Asking every consumer to add alias scripts duplicating their real ones is
a tax for no benefit where `lint` already means lint. The fallback covers
that case with nothing to configure at all.

## Decision: nothing runs on its own

No check runs on save, on open, on a timer, or when a view is refreshed.
Every run is something a person asked for.

This is not caution about cost. A check that runs unbidden trains people
to ignore its result, which is worse than not having it: the first time
it reports something real, it has already been filtered out.

## Decision: report where a stage's checks report

A check run from the menu produces the same kind of result, in the same
place, as the same check run by the harness's `verify` stage. Two
surfaces for one result would make "the lint check failed" ambiguous
about which lint and which run.

A failure states the command and its output. "Check failed" is not a
report — the task list says so, and `runNpmScript` already returns
enough to satisfy it.

## Rejected: duplicating VS Code's own task surfaces

VS Code has an NPM Scripts view and `Tasks: Run Task`, and both already
list every script in the workspace. Reproducing that would add a
maintenance surface with no new capability.

What this change adds is not "run a script" but "run *this repository's
declared checks*, resolved the way the harness resolves them, reported
the way the harness reports them". Where that distinction disappears —
an arbitrary script a person wants to run — VS Code's own surfaces are
the answer, and this change points at them rather than competing.

## Rejected: a checks tree view

A sixth-and-then-seventh view for three commands is a poor trade. The
container already carries Changes, Archive, Specs, Processes, Templates
and Change Graph; the checks belong in the title menu of the view whose
work they verify, not in a container of their own.

## What this does not decide

Whether a check should run automatically **before archiving** a change is
a real question and a separate one. The harness already runs these checks
in `verify`; whether the editor should refuse an archive whose checks
have not passed is a change to the archive path, not to a menu, and would
need its own proposal.
