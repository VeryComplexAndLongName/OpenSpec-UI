# Design

## Context

ADR 0046 built the register, the `say`/`formatMessage`/`withMessageCode`
surface, the generated page and a ratchet. Six groups (`CHG`, `RUN`, `QST`,
`PRM`, `GIT`, `PRC`) already say through it. The eight left are `HRN`,
`AGT`, `TSK`, `VAL`, `ARC`, `WSP`, `KEY`, `NET`. The ratchet in
`message-register.test.ts` counts only four forms - a literal to `stderr(`,
to a VS Code notification, to `failedEvent(`, and a literal `reason:` - and
holds 290. Most of what the eight remaining groups say travels through
carriers the ratchet does not count: the harness validator throws
`InvalidHarnessConfigError`, the task runner's `refused(...)` helper and the
inbox's `describe*` formatters return plain strings, and several refusals
are error classes (`ForgeRefusal`, `EnrolmentRefusedError`). Finishing ADR
0046 means teaching those carriers to carry an identifier, and teaching the
ratchet to count them.

## Goals / Non-Goals

**Goals:**

- Every one of the fourteen groups has entries in the register.
- Every sentence a person reads - however it is carried - is said by its
  identifier, with its words unchanged.
- The ratchet counts every carrier and falls to the documented residual, so
  "all moved in" is a number the test holds, not a claim in prose.

**Non-Goals:**

- No words change. This is a migration, not a wording pass.
- Fragments that are not said as a complete sentence - a JSON-schema
  `description` tooltip's fragment, a single status word that is never said
  alone - are not given identifiers; they stay data.
- No new message semantics, no new groups, no change to the protocol's event
  shape beyond the `code` the events already carry.
- Not rewriting the carriers into one shared refusal type; each carrier
  gains a `code` where it lives.

## Decisions

1. **All eight groups move in one change.** Rejected: one change per group.
   The machinery - register, `say`, page, ratchet - already exists, and the
   words do not change, so each group's diff is mechanical: a sentence gains
   an identifier and its carrier gains a code. A per-group change would
   spend eight pull requests and eight changesets on the same operation.
   The tasks are grouped by group, so the change can be split later if
   review finds it too large.
2. **The words stay, the identifier leads.** Carried over from ADR 0046: a
   test, a log reader or a person who knew the words still finds them; the
   message gains its identifier and nothing is reworded. Rejected:
   reword-as-we-go - a wording pass mixed into a migration hides what
   changed and breaks every test that asserts the words.
3. **Every carrier that says a sentence gains a `code`.** `say(...)` already
   returns `{ code, level, text }`. The carriers that return a bare string
   or throw a bare error gain the code beside the words:
   - `refused(...)` in `delegated-item-run.ts` returns `{ status, reason,
     code, message }`.
   - the `describe*` formatters return a `SaidMessage` (`{ code, text }`),
     and their callers render the code where they now render the string.
   - the refusal error classes (`InvalidHarnessConfigError`, `ForgeRefusal`,
     `EnrolmentRefusedError`, the server's `Refused`, the CLI's
     `ReportRefusal`) carry a `code` field, and their message text stays the
     register's words.
   - `reason:` fields ride beside a `code`, as the protocol events already
     do.
4. **The ratchet generalizes, re-baselines once, then only falls.** The four
   patterns are joined by the carriers above: the `refused(...)` reason
   literals, the `describe*` string returns, the error classes' message
   literals, the `message:`/`problem:` field literals, and the word maps in
   `failure-diagnosis.ts` and `agent-status.ts`. Re-measuring the widened
   counter raises the held number above 290 in one commit, recorded as such
   in the test's comment; after that it only falls as each group moves in.
   Rejected: leave the ratchet at four forms - finishing then cannot be
   measured, because `HRN` and `TSK` barely touch those four.
5. **The adapters surface the code, not their own prefix.** The CLI, the
   extension and the server re-say core's refusals today as
   `openspec-ui-cli: <words>` / `OpenSpec Workbench: <words>`. Those
   prefixes are host identification, not a message; the already-migrated
   groups dropped them, and these do the same, printing the register's
   `<level> OSW-...: <words>`. Rejected: register the prefixes - they are
   not a sentence said to a person, and giving them identifiers would leave
   a person looking up `openspec-ui-cli:` with nothing to learn.

## Risks / Trade-offs

- **The change is large.** About 250 messages across roughly thirty files.
  Mitigated by the words not changing (the diff is the identifier and the
  code), by the ratchet naming the exact residual, and by the per-group task
  structure that lets the change be split.
- **The re-baseline can look like a regression.** The held number rises the
  one time the counter widens. The commit that widens the counter says why,
  and the test comment records it, as it recorded 323 to 290.
- **A carrier missed by the widened ratchet is unprovable.** The ratchet is
  a floor, not a census, as ADR 0046 already said; a sentence built
  elsewhere and passed in is not counted. The register's "every group has
  entries" test and the moved messages' own tests are the second line of
  defence.
- **`code` on an error class changes its public shape.** Adapters that read
  the class's `message` keep working (the text is unchanged); code that
  switches on the class keeps working (the class is unchanged); the new
  field is additive.
