# OpenSpec in this repository — runbook

## Implementation Order

Dependencies between changes are strict; `server`/`webui`/`extension` rely
on the protocol defined in `execution-core`:

1. `openspec/changes/execution-core/` first. It defines the command/event
   protocol and the security model that everything else depends on.
2. `openspec/changes/shared-ui/` after `execution-core` (or in parallel if the
   protocol is already fixed in design.md and will not change).
3. `openspec/changes/standalone-app/` and `openspec/changes/vscode-extension/`
   in parallel; both depend on `execution-core` + `shared-ui`.

## Change Governance (mandatory)

All repository changes must be implemented through an OpenSpec change entry.
Do not bypass OpenSpec with direct ad-hoc commits, even for documentation,
tests, tooling, or refactoring.

Required flow for every change:

1. Create or update a change in `openspec/changes/<id>/`.
2. Keep implementation scoped to `tasks.md` for that change.
3. Validate with `openspec change validate --strict <id>`.
4. Archive only after all required verification is complete.

Reason: this keeps a full audit trail, supports safer rollback decisions, and
preserves implementation history in a single structured process.

### Tick a verification item after it passes, not before the commit

`tasks.md` is what decides whether a change may be archived, so it has to
say what is true. Run the verification items, then tick them, then commit.

The order that goes wrong is: tick what you believe you are about to
finish, copy the files into a worktree, commit, and only then run the
checks and `npx changeset`. Those last two results land after the commit
that would have recorded them, so the file ships saying they were never
done. This produced the same omission on four changes in a row, always at
the last two items of a list — "run the checks" and "add a changeset" —
and once left an entire shipped change reading as untouched (see
`task-bookkeeping-catch-up`).

From outside it looks like this: a change whose work is plainly in `main`,
whose `tasks.md` reads as though nothing was started, and which the
archive step then refuses. If you meet that, correct the record against
the repository — the code, the test, the released `CHANGELOG.md` entry —
and never in bulk from memory.

An item marked **human-only** stays open until a person reports it done.
Passing automated checks are not evidence for it, and neither is half of
it having been observed.

An item marked **Delegated to `<agent-id>`** waits on that agent instead
of on a person — a live run, a real VS Code host, a browser, a query
against GitHub. It is still outstanding, and it closes only when the
evidence the item names is written into the item: a test and its run, a
run id and the audit line, a command and its output. Use it where
another agent can make the check, and **human-only** where none can.

### Say what a change follows, when it follows something

A change's `.openspec.yaml` may state three optional relations:

```yaml
follows:
  - suite-survives-a-loaded-machine
supersedes:
  - git-fixture-test-cost
blocked_by:
  - change-graph-in-core
```

`follows` means this change exists because that one left something — a
named successor, an inherited failure, a measurement that had to come
first. `supersedes` means this change corrected a decision that one made.
`blocked_by` means this change cannot start until that one lands.

The first two are history and never resolve. The third is a schedule and
resolves the moment the change it names is archived — so an unmet blocker
is reported, not failed, while a cycle among blockers is a deadlock
rather than a confused record.

All three accept a single id, a `[flow, list]`, or a block list; all are
optional, and an absent relation is not a defect. Do not invent one to
make the graph look fuller.

`npm run test` fails when a stated id matches no change — active or
archived — and when the relations form a cycle. That is the whole point:
`openspec change validate --strict` accepts unknown keys and ignores
them, so a successor named but never created would otherwise be
discoverable only by someone reading prose. Three changes in a row here
named residue that then lost its owner.

The check is a test in `packages/core` rather than a lint script, so it
runs from source with nothing built. It cannot catch a **missing**
relation: it verifies that what is stated resolves, and nothing tells it
a relation should exist. One was found missing by a human verification
item, not by the check.

Read the graph with `npm run graph:changes`, or
`npm run graph:changes -- --change <id>` to walk one change back to the
reasons for it.

**Do not read order off the archive's date prefix.** It records when a
change closed, not when it started: `load-sensitive-test-timeouts`,
archived 2026-09-02, depends on `git-fixture-test-cost`, archived
2026-09-05. Establish direction from what a change says about another,
and record it here so nobody has to establish it twice.

### A branch ends with its pull request

**One change is one pull request.** A change is implemented on its own
branch, that branch carries exactly one change, and the pull request's
title is the change id, verbatim. Nothing has to be decoded to see what a
pull request is for.

**Archiving is a second pull request, and the product makes it.** Once a
change has landed with every task item closed, the workspace sweep
archives it together with every other such change, in one pull request
on an `archive-landed-<date>` branch, which merges when its checks pass
([ADR 0035](../docs/adr/0035-a-landed-change-is-archived-for-you.md),
`archive.whenLanded`, on by default). Nobody archives a finished change by
hand. A change that landed still owing something is named by the sweep
and stays live until its record is put right.

**Anything left to finish is a new change and a new pull request.** Not
another commit on the open one. The owner merges quickly, and a commit
pushed to a branch whose pull request has already merged is stranded where
nobody looks for it again; that has happened twice.

**Nobody rebases a branch by hand because `main` moved.** `main` does not
require a branch to be up to date: a pull request lands when its own
required checks are green, whatever has landed since they ran
(main-no-longer-requires-an-up-to-date-branch). And the product rebases
a change's branch that has fallen behind, pushes it with a lease, and so
starts its checks again against the current `main`
([ADR 0034](../docs/adr/0034-a-behind-branch-is-rebased-for-you.md),
`branches.rebaseWhenBehind`, on by default).

That closes what the up-to-date rule used to guard: two pull requests
that are green apart and broken together - a function renamed in one and
called in the other - now meet on the same `main` before either lands.

A rebase by hand is left for a **conflict**, which the product never
resolves. It aborts, leaves the branch as it was, and says which files
conflict; the editor raises a warning. That is the one time a person
rebases.

**When the pull request merges, the branch is finished.** Delete it
locally with `git branch -D <id>`, delete it on the server, remove its
working directory with `git worktree remove`, and remove the empty shell
that leaves behind on Windows. The repository setting **Automatically
delete head branches** does the server side by itself; where it is off,
`git push origin --delete <id>` after the merge.

**Why this has to be said rather than noticed.** This repository
squash-merges, so a merged branch's tip is never an ancestor of `main`.
Neither git nor this product can answer "is this branch finished" from the
commit graph, which is why the standings read the pull request and the
archive on `main` instead. Nothing sweeps a branch up later, so they
accumulate: on 2026-09-19 there were 184 local and 45 remote, 175 and 40
of them dead since the spring.

### Where an agent works

**A change is worked in its own working directory**, under the worktree
root beside the repository (ADR 0027): `<parent>/.worktrees/<repo>/<change-id>`,
on a branch of the same name. The directory's name is the change id
exactly, so the survey resolves it to that change and the Pipeline draws
it as that change's card.

```bash
git worktree add ../.worktrees/OpenSpec-UI/<change-id> -b <change-id>
```

**The shared checkout stays on the default branch.** It is the owner's
window: what is happening is read there, from the Pipeline, rather than
worked there.

**Two agents never share a working directory.** This is the rule the
branch rule above does not give you, and the difference is not academic.
On 2026-09-20 two agents worked on two different changes, each on its own
branch, in one directory - and collided anyway. A directory has one
checked-out branch and one index: the second agent's files were staged in
the first agent's index, under the first agent's branch, and neither could
see it until a commit was about to carry the other's work. A branch is a
name for a line of commits; the working directory is the desk.

**Dependencies are linked, not installed again**, where the change does
not touch a package's own sources: `mklink /J node_modules <main>/node_modules`
on Windows, a symlink elsewhere. Know what that costs: the link makes
`@openspec-ui/*` resolve to the **main checkout's** packages, so a test
that crosses packages checks the main checkout's code, not the change's.
Where the change alters a package another package imports, install in the
working directory instead.

**What is machine-wide is not solved by a directory.** Ports, the
processor, the downloaded editor under `.vscode-test`: two working
directories contend for all of them. Two browser suites at once produce
failures that look like defects and are not - three specs failed in a
parallel run on 2026-09-20 and all six passed alone.

### Editorial content is not a change

`docs/articles/**` - articles, teasers and the pictures beside them - needs
no OpenSpec change. It is editorial: it has no requirement to state, no
capability to modify, and nothing to verify beyond being true and readable.
Everything else in this repository still does, the other documents
included: a README, `HARNESS.md`, an ADR and a how-to page all say how the
product behaves, and changing one of those is changing the product's
description.

**What still applies to editorial work:**

- **English only.** `lint:english` reads every tracked `.md` and fails on
  Cyrillic. A translation cannot live here; keep it where the other
  language versions live.
- **Pictures beside the article**, in `docs/articles/` at any depth - one
  subdirectory per venue, and `shared/` for what more than one article
  uses - or taken from `docs/images/`. `lint:articles` fails a link to a
  picture that is neither, or to one that is not in the repository at all.
- **A picture of the product comes from a capture**, under
  `docs/images/`, and never from a hand-taken screenshot. Not a matter of
  tidiness: a hand-taken picture carries whatever was on the screen, and
  this repository has already published one with an account name in it.
  A capture's fixture is built for the photograph and its paths are
  masked. `lint:screenshots` governs `docs/images/` and requires every
  picture there - `.png` and `.gif` alike - to come from an end-to-end
  capture, so a cover drawn by hand fails that check. A recording lives
  there too, and the script that re-records it is its capture: it sits
  beside the other captures, in `packages/server/e2e` or
  `packages/extension/e2e`, and names the file it writes.
- **A cover or a diagram** - a drawing that is not of the product - is
  the one hand-made picture there is, and it lives beside its article,
  never in `docs/images/`.
- **The branch rules above.** One piece of work, one pull request, and the
  branch ends when it merges.
- **A claim about the product cites where it comes from.** A version, a
  count of templates, a capability: name the file or the spec beside it.
  `README.md` claimed "16 templates across 9 categories" for three weeks
  while the answer was 17 across 10, and nothing failed. An article is read
  by people who cannot check it against the tree, so the citation is what
  makes it checkable later.

**An article under `docs/articles/site/` tells the homepage.** That
subtree is what the campaign's own site serves, and a merge to the default
branch touching it sends a `repository_dispatch` to the homepage's
repository, which decides what to rebuild. The other venues send nothing:
they are published by hand to places that are not a site.

**Its pull request is titled `article: <slug>`**, since it has no change id
to be titled with. It touches `docs/articles/` and nothing else: a pull
request that also edits `packages/`, `openspec/` or `.changeset/` is not
editorial and takes the ordinary route.

## Architecture Changes via ADR (mandatory)

Any architecture-impacting modification must be documented via ADR in
`docs/adr/` before the implementation is considered complete.

Examples include:

- Delivery model changes (standalone vs extension responsibilities)
- Protocol changes (commands/events, transport behavior)
- Security model changes (allowlist, cwd sandbox, audit boundaries)
- Moving business logic across package boundaries

The related OpenSpec change must reference the ADR decision.

## Which command/skill to use when

| Situation | Action |
|---|---|
| Start implementing `execution-core`/`shared-ui`/`standalone-app`/`vscode-extension` | `openspec-apply-change` — follows the `tasks.md` of the prepared change |
| New capability beyond the original four | `openspec-propose` |
| Change implemented and confirmed (green contract tests, manual smoke test) | `openspec-archive-change` — see `operations.archive.guidance` in `config.yaml` for what must be confirmed before archiving |
| Adjust a change that is not archived yet (new information, mistake in design.md) | `openspec-update-change` |
| Fix wording in an already archived spec without a full cycle | `openspec-sync-specs` |

## How to ask the agent

- **For apply**: "apply change `execution-core`" — the agent reads
  `tasks.md` and follows the list. Security-model tasks (allowlist/cwd
  sandbox/audit) are not marked complete without a test — see `rules.tasks`
  in `config.yaml`.
- **For archive**: only after contract tests between `webui` and
  `server`/`extension` have actually passed — not when it merely "looks
  ready".
- **If the command/event protocol changes** (see `context` in `config.yaml`
  for the full list), explicitly tell the agent that already implemented
  adapters are affected so that design.md captures backward compatibility or
  an explicit breaking change.

## Agentic Harness — how to work with it

Full rationale: `docs/adr/0011-agentic-harness-config-and-autonomy-levels.md`
and `docs/adr/0012-agentic-harness-chain-execution-protocol.md`. Normative
behavior: `openspec/specs/agentic-harness/spec.md`. This section is the
short, practical version.

**Config files** — two levels, both product-owned (never read by the
upstream `openspec` CLI):

- `openspec/agent-harness.json` — global default for the whole repository.
- `openspec/changes/<id>/harness.json` — optional per-change override,
  merged key-by-key over the global file (only the keys it sets are
  overridden; everything else is inherited).

Fields: `stepAgents` (maps `propose`/`review`/`apply`/`archive`/`git` to a
preferred `agentId` from `packages/core/src/agents/registry.ts`),
`autonomyLevel`, and `reviewGate.mode`.

**Three ways to edit either file:**

1. In the standalone webui, the "Harness Settings" tab (global) and the
   Change Editor's "Harness" tab (the loaded change). In VS Code, the
   commands `OpenSpec Workbench: Configure Harness Settings` (global) and
   `OpenSpec Workbench: Configure Harness for this Change` (per-change, from the
   Changes tree context menu), each of which opens a panel for its one
   file.
2. Hand-editing the JSON directly — it is validated on read/write either
   way, so a malformed edit fails with a clear error rather than being
   silently ignored.

**What each `autonomyLevel` does today:**

- `assisted` (default): the Agent Selection picker in both delivery
  targets pre-fills the `stepAgents` recommendation for the stage being
  opened; a human still explicitly starts every `plan`/`review`/
  `implement` run.
- `semi-autonomous`: a `"chain"` command runs `propose → review → apply →
  archive` in sequence, pausing at an explicit `checkpoint` between each
  stage by default (Continue/Cancel) unless a per-change `harness.json`
  sets `checkpoints.requireConfirmationBetweenSteps: false`.
- `autonomous`: same chain, no pause between stages
  (`stageCompleted` events only) — reachable **only** through an explicit
  per-change `openspec/changes/<id>/harness.json` setting
  `autonomyLevel: "autonomous"` directly; the global file can never set it,
  and it is never implied by any other setting.

Either chain level always stops after `archive` and never invokes the
`git` stepAgent — commit/push automation is still fully out of scope (see
`reviewGate.mode` below). See `docs/adr/0012-agentic-harness-chain-
execution-protocol.md` for the full chain protocol and
`openspec/changes/agentic-harness-autonomy/` for the implementation.

**Starting a run:** "Run with Agentic Harness" — a context-menu command on
a change in the VS Code extension, or a button in the standalone shell's
Change Editor tab (`openspec/changes/agentic-harness-run-menu/`) — resolves
the change's harness config fresh on every invocation and dispatches
accordingly: opens the Agent Selection picker for `assisted`, or starts a
chain (rendered in `HarnessChainPanel`, with the checkpoint Continue/Cancel
choice) for `semi-autonomous`/`autonomous`. It never overrides what the
resolved config says — change the config (above) to change the behavior.

**`reviewGate.mode`**: `human-required` (the only valid global value) or
`agent-sufficient` (per-change file only). This gate is meant to govern the
`git` stepAgent's commit/push action — but that action does not exist as a
product feature yet (`GitWrapper.commit()`/`push()` are not called from
anywhere), so today `reviewGate.mode` has no observable runtime effect
either way. It is safe to set, and already enforces its own validation
rules (global can never be `agent-sufficient`), but nothing currently reads
it to gate an action.

**Where the resolved config shows up today:** the Agent Selection picker's
pre-fill and the "Run with Agentic Harness" dispatch (both above), and the
Processes view, which shows the `agentId` that started a process and a
percent-complete derived from that change's `tasks.md` checklist.
