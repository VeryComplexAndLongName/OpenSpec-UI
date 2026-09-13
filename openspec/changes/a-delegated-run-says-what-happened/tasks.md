Three things the delegated-item route knew and did not say, found on
2026-09-13 while handing two live checks to `claude-cli`.

## 1. The marker

- [ ] 1.1 `delegatedAgentFor` names the same agent for a bare id and for
  the id enclosed in backticks.
- [ ] 1.2 A backtick on one side only names nothing.
- [ ] 1.3 The inbox and the route read the marker the same way, since both
  go through `delegatedAgentFor`; a quoted marker on an open item is
  offered a run.

## 2. Why a run failed

- [ ] 2.1 `runDelegatedItem` keeps the last 20 lines, at most 2,000
  characters, of what the run wrote to stderr, from the run's own events.
- [ ] 2.2 A `failed` or `cancelled` result carries them as `lastStderr`;
  a finished run carries none.
- [ ] 2.3 The message quotes the last non-empty stderr line after the
  reason, and adds nothing when stderr was empty.

## 3. A status record

- [ ] 3.1 `runDelegatedItem` wraps the run in `withAgentStatus`, so the
  record names the change and exists for the length of the run.
- [ ] 3.2 `onEvent` still sees every event, unchanged and in order.
- [ ] 3.3 A `resolveStatusDirectory` test seam reaches `withAgentStatus`.

## 4. Tests

- [ ] 4.1 core `task-checklist.test.ts`: a bare id, a quoted id, a
  half-quoted id, and "whoever is free".
- [ ] 4.2 core `delegated-item-run.test.ts`: a runner that writes to
  stderr and fails — the result carries the tail and the message quotes
  the last line; a long stderr is bounded; a finished run carries no tail.
- [ ] 4.3 core `delegated-item-run.test.ts`: while a held runner is under
  way, a status record for the change exists in the directory the seam
  gave; after the run, it is gone.
- [ ] 4.4 core human-only inbox test: an open item with a quoted marker
  is listed as delegated to that agent.

## 5. Verification

- [ ] 5.1 This change validates strictly. `check(validate-change)`
- [ ] 5.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts.
- [ ] 5.3 A pending changeset exists. `check(changeset-present)`
- [ ] 5.4 **Delegated to `claude-cli`**: written with the quoted id on
  purpose. Through `/api/delegated-item/run`, run an open item in a
  scratch repository whose agent is a stand-in that prints a line to
  stderr and exits 1, and read `openspec-ui-cli status` while a second,
  waiting stand-in runs. Evidence: the route's result with its message
  and `lastStderr`, and the status output naming the change. The unit
  tests use fake runners; only the route shows that both hosts' path
  carries all three.
