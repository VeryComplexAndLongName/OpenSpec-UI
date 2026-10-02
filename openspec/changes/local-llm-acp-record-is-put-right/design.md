# Design

## Non-Goals

- Changing `isUnrecordedTask`, `describeTaskDebts` or `owesNothing`. The
  rule is behaving as designed; the record was written somewhere the rule
  does not read.
- Changing the merge gate's scoping rule.
- Re-verifying what 4.4 records, or rewording it.
- Any change to the command or event protocol. This change touches no
  source file, so no command and no event is added, removed or altered,
  and the `server`/`extension` adapters are untouched.

## Decisions

### Move the record, not the rule

`isUnrecordedTask` closes a delegated or human-only item only when the
indented lines under it carry something. That is a proxy for "somebody
came back and wrote what happened", and it is the only proxy available:
an item's own text already contains the instruction "record evidence in
this task", so a reader that counted the checkbox line could never tell a
discharged item from one that merely describes its own obligation.

Every other recorded item in this repository already writes under the
checkbox — including 6.4 of `local-llm-codes-in-process`, archived the
same week. `local-llm-acp` 4.4 is the outlier, not the rule.

**Rejected: teach the rule to accept a record on the checkbox line.**
It cannot be done without a marker, and inventing one ("a line
containing `Record,`") would be a new syntax to learn, enforced nowhere,
and silently absent from every item written before it. It would also
close items that write a long instruction and no evidence at all, which
is the single thing the rule exists to catch.

**Rejected: tick nothing and reopen 4.4.** The run happened and is
recorded with its id, its agent version and its outcome. Reopening it
would make the file say something false in the other direction — the
error `task-bookkeeping-catch-up` warned about — and would ask a person
to repeat a run whose result is already written down.

**Rejected: archive `local-llm-acp` by hand.** Nobody archives a
finished change by hand; the sweep does it (ADR 0035, ADR 0036).
Reaching past the sweep would hide the defect rather than fix it, and the
next change recorded this way would stall the same way with nothing to
point at.

### Say the branch-name rule where it has teeth

The gate reads `--change "$GITHUB_HEAD_REF"` and skips a name no active
change has. The runbook already requires one change per pull request and
the change id as the pull request's title; it did not say the *branch*
must carry the id, and a branch named `fix-local-llm-acp` turned the
merge gate into a check that passed without checking.

The fix here is one sentence in the runbook, next to the rule it
completes. The alternative — making an unmatched name a failure — is
**rejected in this change**: archive, article and dependabot pull
requests all legitimately match no change, so that rule needs a way to
tell those apart, and designing it here would smuggle a gate change into
a record correction.

## Risks / Trade-offs

- **The runbook sentence is prose, not a check.** A branch named
  something else still silently skips the debt check tomorrow. Accepted
  deliberately: the mechanical fix is a real design question (which
  pull requests must match a change?) and is named as out of scope so it
  keeps an owner, rather than being decided in passing here.
- **Moving text risks altering it.** Mitigated by moving the record
  verbatim and diffing it: the change is whitespace and line breaks, no
  word added or dropped.
- **The sweep might still refuse for a reason this did not cover.**
  Mitigated by running the same `describeTaskDebts`/`owesNothing` the
  sweep uses against the edited file, and requiring `owesNothing` to be
  `true` before this change is called done, rather than inferring it from
  the edit looking right.
