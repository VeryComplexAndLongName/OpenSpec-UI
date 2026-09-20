## What was actually tried

Four calls, in this order, each refused with `Invalid rule 'merge_queue'`
and no further detail:

1. `PUT .../rulesets/20287422` with the existing rules plus a
   `merge_queue` rule carrying all seven documented parameters.
2. The same, sent as the whole ruleset object rather than just `rules`.
3. The same again with `strict_required_status_checks_policy: false`, on
   the theory that the up-to-date rule and a queue cannot both be on.
4. `POST .../rulesets` creating a **new, disabled** ruleset whose only
   rule was `{"type": "merge_queue"}`, with no parameters at all.

The fourth is the one that settles it. A bare rule in a disabled ruleset
has nothing to get wrong: the rule type itself is not accepted for this
repository. GitHub documents merge queue as a feature of repositories
owned by an organization, and `repos/VeryComplexAndLongName/OpenSpec-UI`
reports `owner.type: "User"`.

None of the four changed anything: the ruleset was read back afterwards
and still held exactly the four rules it started with, strict included.

## What dropping the rule actually costs

The rule says: the checks must have run on a branch containing the
current tip of `main`. Without it, a pull request can land whose checks
ran against an older `main`.

What is still caught:

- **Textual conflicts.** git refuses to merge them; the pull request says
  so and cannot be merged.
- **Anything wrong with the change itself.** Every required check still
  runs on every pull request, and a red pull request still cannot land.
- **A broken `main`.** The release path runs on the push, so a `main`
  that stops building is visible immediately rather than at the next
  release.

What is not caught: two pull requests that are each green and are broken
together - a function renamed in one and called in the other, a spec
requirement deleted in one and referenced in the other. That is a real
gap, and it is the whole of the risk.

Why it is small here: the two streams of work that actually overlap in
time are the article campaign, which touches `docs/articles/` and nothing
else, and one change at a time in `packages/`. Two code changes racing is
the case to be careful about, and it is the case where the owner already
lands one before starting the next.

## Why the merge queue work is withdrawn rather than kept

The `merge_group` trigger is harmless: the event never fires, so nothing
runs. It is also a lie in the repository's own voice - a workflow that
says it answers to a queue, a runbook that says a pull request joins one,
and a change whose task list says the queue will be turned on.

This repository's habit is that what is written is true. Re-adding the
trigger is one commit if the repository ever moves to an organization,
and the reason it is not there is recorded here rather than in a comment
nobody reads.

Its spec deltas were never applied - deltas apply when a change is
archived - so removing the directory removes the whole of it, and
`openspec/specs/release-quality/spec.md` was never touched by it.

## Alternatives that were on the table

**Keep strict and agree an order** - code lands first, articles second.
No configuration changes, and it asks two agents and a person to remember
a rule every time. It is a convention against a race; the race wins on
the day somebody is quick.

**Keep rebasing.** It is what was happening, and it is what prompted the
question.
