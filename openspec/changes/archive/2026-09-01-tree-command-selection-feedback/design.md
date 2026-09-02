## Context

See `proposal.md` for the full audit. All 15 affected commands are
registered only against `view/item/context` menu entries in
`package.json` (right-click on a tree row), which is how they were
designed to be invoked — but nothing in `package.json` restricts them
from *also* being invokable via the Command Palette, which is VS Code's
default for every command carrying a `title`.

## Goals / Non-Goals

**Goals:**

- Every one of the 15 commands gives the user a clear, actionable reason
  when it does nothing, instead of a silent no-op.
- One consistent pattern and wording across all 15, matching the one
  command (`reviewDiff`) that already does this correctly.

**Non-Goals (this change):**

- Making these commands actually *work* without a tree selection (e.g.
  falling back to a `QuickPick` change/template/task chooser when
  invoked from the Command Palette). That is a real, larger feature (each
  command would need its own picker, and some — `revealTask`/
  `deleteTask` — would need a two-level change-then-task picker) with its
  own design questions; this change's scope is strictly "stop being
  silent," not "make the Command Palette path fully functional." A
  QuickPick-fallback change can build on top of this one later.
- Hiding these commands from the Command Palette
  (`menus.commandPalette` with `"when": "false"`). Rejected — see
  Decisions below.
- Adding feedback for the "item present but wrong state" case (e.g.
  `archiveChange` on an already-archived item). See Decisions below for
  why this is out of scope.
- Any change to business logic once a valid, correctly-stated `item` is
  passed in — every existing happy-path test and behavior is unchanged.

## Decisions

### Explicit-message guards, not `menus.commandPalette` exclusion

Chosen: keep every command reachable from the Command Palette, and make
the "nothing selected" case say so explicitly — extending `reviewDiff`'s
existing pattern to the other 14, rather than introducing a second,
different remediation strategy for the same underlying problem.

**Rejected alternative**: add `"menus": { "commandPalette": [{"command":
"openspec-ui.archiveChange", "when": "false"}, ...] }` entries for all 15,
hiding them from the palette entirely. Rejected for two reasons: (1) it
would leave `reviewDiff` as a visible inconsistency — either also hide
it (throwing away already-shipped, working behavior for no reason) or
leave it alone (two different remediation strategies for the identical
problem shape, with no principled reason to pick one over the other per
command); (2) a user who knows a command's name but forgot to click the
right row first is told nothing at all by an absent palette entry (it
simply doesn't appear, unexplained) — an explicit message is strictly
more informative for the same effort.

### "Wrong state" (item present, but e.g. already archived) stays silent

`archiveChange`'s `item.archived` check (and its analogues in
`unarchiveChange`/`copyTasksAsTemplate`/`customizeTemplate`/
`deleteProjectTemplate`/`deleteTask`/`startImplementation`/
`runWithHarness`) is not touched by this change — those branches keep
returning silently.

**Rejected alternative**: message this case too (e.g. "this change is
already archived"). Rejected — unlike the "no item at all" case, this
state is already actively prevented by each command's own `when` clause
in `package.json`'s `view/item/context` menu (e.g. `archiveChange` only
appears in the context menu for `viewItem == openspec-ui.activeChange`,
never for an archived row), so it is not reachable through the normal
tree-click UI path at all. It remains reachable only via the Command
Palette with a stale/mismatched selection, or programmatically — genuine
edge cases, not the confirmed, reproducible bug this change fixes. Adding
messaging for every one of these per-command state checks is meaningfully
more surface (each has different, command-specific wrong-state semantics)
for a case with no live report behind it; left as a candidate follow-up,
not bundled into this fix.

### Two small shared helpers, not per-command inline messages

`warnNoWorkspace()` and `warnNoTreeSelection(kind: "change" | "template"
| "task")`, added next to the existing `showCommandError` helper
(`commands.ts:74`) and used everywhere the "no workspace"/"no item"
messages are needed — including the three pre-existing ad hoc
`showErrorMessage("OpenSpec UI: open a folder or workspace first.")`
call sites (`createChange` ×2, `openAiPanel`), which are updated to call
the new helper too, so the string exists in exactly one place.

**Rejected alternative**: leave each command's message as an inline
string literal (matching how the pre-existing three call sites already
did it). Rejected — going from 3 duplicated occurrences to ~18 is exactly
the point past which a two-line helper earns its keep; `showCommandError`
already establishes this file's convention of small top-level helpers for
exactly this kind of repeated user-facing message.

## Risks / Trade-offs

- **[Trade-off]** The "wrong state" case (see Decisions) still fails
  silently after this change, same as today. Accepted — not reachable via
  normal tree interaction, and out of this change's confirmed-bug scope.
- **[Risk]** None identified for existing behavior: every change is
  additive (new `return` branches with a message) or a literal-to-helper
  substitution: no existing control flow after a valid `item` is
  touched.

## Migration Plan

No migration. Purely additive user-feedback branches plus a
string-literal-to-helper consolidation; no persisted state, no protocol
change.
