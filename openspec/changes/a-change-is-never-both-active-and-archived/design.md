# Design

## Context

The merge gate (`validate` with `--base <ref>`) already reads the base's
tree to compare people, histories and the archive. The duplicate of
`cli-is-visible-on-the-homepage` shows the missing case: nothing read the
base's *archived* names against the working tree's *active* names. ADR 0035
and ADR 0036 make archiving a product action; the gate is the one moment a
pull request can undo it.

## Goals / Non-Goals

**Goals:**

- A pull request that puts a change back after the base archived it is
  refused, naming the change and where it was archived.
- The archive's own pull request keeps passing.
- The one existing duplicate is removed from `main`.

**Non-Goals:**

- No Pipeline change. The gate is where a pull request is judged; the board
  only draws what the gate let through.

## Decisions

1. **In the gate, with the base.** The rule reads two listings the way
   `readArchivedSince` reads the archive: the base's active names and
   archived names, and the working tree's active names. Without `--base`
   there is nothing to compare, and the rule says nothing. Rejected: a
   Pipeline-time check — it would redraw cards but still let the bad pull
   request land.
2. **Core computes; the CLI reports.** `readResurrectedChanges` returns the
   change and its archived folder, and the CLI prints one `FAIL` line per
   change. The `ok` flag folds them in, so the exit code is the contract it
   already is.
3. **The archive is exempt.** A change the base still has active is not
   named, even if it also appears in the base's archive under an older date:
   archiving is exactly the pull request that has the active copy in the
   commit before it moves it, and refusing it would jam the product's own
   archive. Rejected: refusing both directions — it cannot tell the archive
   apart from a resurrection.
4. **The date prefix is stripped before comparing.** An archive folder is
   `<date>-<change>`; the active folder is `<change>`. The same strip
   `readArchivedSince` already relies on keeps the two keyed by one name.
5. **The stray copy goes with the rule.** The rule and its one existing
   instance are the same defect: landing the rule while leaving the copy
   would leave the board lying for one more cycle.

## Risks / Trade-offs

- A change archived under an older date and legitimately re-opened later
  (a new proposal under the same name) is refused. The repository has no
  such case; a change that must live again is given a new name, as its
  history already does. Documented, not a defect.
- The comparison needs the base's tree, which the gate already fetches at
  depth one; no new fetch.
