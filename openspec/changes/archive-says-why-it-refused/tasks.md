The refusal is already structured. Observed 2026-09-08 against this
repository: exit `1`, and on stdout `{ archive: null, status: [{ severity,
code, message }] }` with the message a whole sentence naming its subject.
The work is reading it.

## 1. Reading the refusal

- [ ] 1.1 `archiveChange` accepts a non-zero exit whose stdout parses,
  the way `validateChange` does — the report is the answer the command
  gave.
- [ ] 1.2 Take the `status[]` entries of severity `error` and throw with
  their messages. Keep throwing: every caller here asks "did it work, and
  if not why", unlike `validate`, whose caller wanted the report as data.
- [ ] 1.3 Report every error, each on its own line. A change can be
  refused for more than one reason, and reporting the first sends the
  reader round the loop for the second.
- [ ] 1.4 Do not key on `archive === null`. It says that nothing was
  archived and never why, so a caller reading it still has to find the
  reason elsewhere.
- [ ] 1.5 Where nothing parseable comes back, or a report carries no
  error entries, say so — never present a runtime banner as the
  explanation, which is the failure that made this class expensive.

## 2. Tests

- [ ] 2.1 A refusal carrying one error throws with that message,
  including the requirement it names.
- [ ] 2.2 A refusal carrying two errors reports both.
- [ ] 2.3 A non-zero exit with unparseable output says no reason was
  given.
- [ ] 2.4 A successful archive is unchanged — the regression that
  matters, since every archive in this repository goes through it.
- [ ] 2.5 Assert on the message's content, not that a message exists.
  This defect shipped with a perfectly well-formed error string; a test
  asserting one was present would have passed throughout.

## 3. Verification

- [ ] 3.1 `openspec change validate --strict archive-says-why-it-refused`.
- [ ] 3.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
- [ ] 3.3 Version bump via `npx changeset` for `@openspec-ui/core`.
- [ ] 3.4 Reproduce a real refusal end to end, in a scratch workspace
  built for it: a change whose `MODIFIED` block omits a scenario the
  specification carries — the exact shape that cost two reproductions in
  a sister repository. Record what the message says now.
