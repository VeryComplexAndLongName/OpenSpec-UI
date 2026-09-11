# Design

## Decision: two actions, two different signals

The tempting simplification is one rule — "show it if the thing is
installed" — and it is wrong for half of this.

**Dependabot** is a service GitHub runs. Nothing is installed, and
nothing local can be inspected. What decides whether
`.github/dependabot.yml` means anything is the repository's origin
remote.

**Copilot** is an installed component, and its presence is a fact about
this machine: the editor extension, or the `copilot` binary on the path.

So there are two predicates, named for what they actually ask, and no
attempt to unify them.

## Decision: hidden from the tree, kept in the palette

The owner asked for these to be hidden rather than shown disabled, and
that is what the tree does. But a command that exists nowhere is a
capability nobody can discover, so the palette keeps both, and invoking
one where it does not apply says why — and offers to proceed.

That escape hatch is not politeness. It is the only correct answer to
GitHub Enterprise, below.

## Decision: `github.com` is certain, and everything else is unknown

An origin of `github.com` — over https or ssh, with or without `www` —
is GitHub. A GitHub Enterprise Server install is reachable at any
hostname its owner chose, and **no inspection of the URL can tell it
from any other host**. Matching hostnames that merely contain "github"
would claim `github.io` pages and miss `git.example.com`.

So: `github.com` shows the action; anything else hides it; and the
palette command is where a Enterprise user proceeds anyway, having been
told exactly what was and was not established.

Getting this wrong in the other direction — guessing — would put a file
that nothing reads into repositories that are not on GitHub at all,
which is the fault being fixed.

## Decision: not knowing is not the same as knowing it is absent

Where detection fails — no git on the path, the remote command errors,
the process cannot be spawned — the action is **shown**.

Hiding on ignorance removes a working feature from somebody whose setup
this code failed to inspect, and they have no way to find out why. The
cost of the opposite mistake is one extra row in a tree. The rule is
therefore: hide only on a definite negative.

## Decision: detection happens when the section is opened, and once

`getChildren` reaches these actions only when Repository Setup is
expanded, which is already the lazy moment. Detection runs there and its
result is cached for the session, so refreshing the tree — which happens
on every file change — never spawns a process.

Probing the path for `copilot` costs a process. Doing it per refresh
would make an unrelated edit spawn one, which is how a tree view becomes
the reason an editor feels slow.

## Decision: the decision lives in core, the facts are gathered by the host

A pure function in core takes the facts — the origin URL, whether the
Copilot extension is present, whether the CLI is — and returns which
actions apply and, for the ones that do not, why. It is the extension's
job to know how to ask VS Code about an extension; it is not the
extension's job to decide what those answers mean.

This is ADR 0001's line, and it is also what makes the rule testable
without an editor.

## Non-Goals

Filtering `Generate Agent Instructions`. Changing what any action
writes. Asking GitHub whether Dependabot is switched on. Anything in the
standalone shell, which has no Repository Setup.

## Risks / Trade-offs

A GitHub Enterprise user loses the tree item and has to reach the
command from the palette. That is the price of refusing to guess at
hostnames, and the palette route tells them what happened rather than
leaving them to wonder.

The Copilot check is broader than the feature strictly needs: the CLI
being present does not prove the editor extension will read
`.github/instructions/`. The owner chose the broader signal
deliberately, so that somebody working through `copilot-cli` is not cut
off from a file they may well want.

Caching for the session means installing Copilot while the editor is
open does not make the item appear until the window is reloaded. Stated
here rather than solved with a watcher, which would cost more than the
case is worth.
