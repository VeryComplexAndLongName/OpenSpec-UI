The refusal is already structured. Observed 2026-09-08 against this
repository: exit `1`, and on stdout `{ archive: null, status: [{ severity,
code, message }] }` with the message a whole sentence naming its subject.
The work is reading it.

## 1. Reading the refusal

- [x] 1.1 `archiveChange` accepts a non-zero exit whose stdout parses,
  the way `validateChange` does — the report is the answer the command
  gave.
- [x] 1.2 Take the `status[]` entries of severity `error` and throw with
  their messages. Keep throwing: every caller here asks "did it work, and
  if not why", unlike `validate`, whose caller wanted the report as data.
- [x] 1.3 Report every error, each on its own line. A change can be
  refused for more than one reason, and reporting the first sends the
  reader round the loop for the second.
- [x] 1.4 Do not key on `archive === null`. It says that nothing was
  archived and never why, so a caller reading it still has to find the
  reason elsewhere.
- [x] 1.5 Where nothing parseable comes back, or a report carries no
  error entries, say so — never present a runtime banner as the
  explanation, which is the failure that made this class expensive.
- [x] 1.6 Carry the report's own `fix` field where it has one. Observed
  on a real refusal as "Fix the change delta specs and rerun. No files
  were changed." — a reason plus a remedy plus the assurance that nothing
  moved is what stops a reader running the command again to find out.

## 2. Tests

- [x] 2.1 A refusal carrying one error throws with that message,
  including the requirement it names.
- [x] 2.2 A refusal carrying two errors reports both.
- [x] 2.3 A non-zero exit with unparseable output says no reason was
  given.
- [x] 2.4 A successful archive is unchanged — the regression that
  matters, since every archive in this repository goes through it.
- [x] 2.5 Assert on the message's content, not that a message exists.
  This defect shipped with a perfectly well-formed error string; a test
  asserting one was present would have passed throughout.

## 3. Verification

- [x] 3.1 `openspec change validate --strict archive-says-why-it-refused`.
  Run 2026-09-08: valid.
- [x] 3.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
  Run 2026-09-08 on an idle machine: typecheck clean; lint clean apart
  from one warning that predates this change (`killTimer` unused in
  `packages/core/src/agents/shared.ts:210`); tests 48 cli, 662 core,
  285 extension, 62 server, 268 webui — core up 3.
- [x] 3.3 Version bump via `npx changeset` for `@openspec-ui/core`.
  Done: `.changeset/archive-says-why-it-refused.md`.
- [x] 3.4 Reproduce a real refusal end to end, in a scratch workspace
  built for it: a change whose `MODIFIED` block omits a scenario the
  specification carries — the exact shape that cost two reproductions in
  a sister repository. Record what the message says now.
  Done 2026-09-08 in a scratch workspace whose change omits a scenario
  the specification carries. Raw command: the refusal names the
  requirement and the scenario, and says "Aborted. No files were
  changed."

  Through `archiveChange`, **before** this change, a caller received the
  entire JSON document as the error message — braces, `root`, `status`,
  and the sentence buried inside. Measured, not assumed, and it corrected
  this proposal: the reason was never lost, it was unreadable.

  After: `could not archive "drifted": demo-cap MODIFIED failed for
  header "### Requirement: Views are recorded by the site itself" -
  current spec contains scenario(s) not present in the modified block:
  "The same reader returns the next day". Refresh the change spec before
  archiving to avoid dropping scenarios. Fix the change delta specs and
  rerun. No files were changed.`
