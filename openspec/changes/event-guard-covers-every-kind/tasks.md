The point of this change is that the next kind cannot slip through the
same gap. Adding two cases fixes today; only the compile-time test stops
it recurring.

## 1. Fix

- [x] 1.1 `packages/core/src/protocol.ts`: `isEvent()` gains a
  `"cancelling"` case validating `attempted` against its two permitted
  values, and a `"usageReported"` case validating that `usage` is an
  object.
- [x] 1.2 Keep the `default: return false`. The input is `unknown` from
  an external transport; an unrecognized kind must be rejected, not
  thrown on.

## 2. Stop it recurring

- [x] 2.1 `packages/core/src/protocol.test.ts`: a
  `Record<EventKind, Event>` of one valid sample per kind. Adding a kind
  to `EventKind` without adding a sample is a **compile** error, which
  is the only mechanism here that does not rely on someone remembering.
- [x] 2.2 Assert `isEvent` returns `true` for every sample in that
  record, and that each survives `serializeEvent`/`deserializeEvent`
  intact. A sample present but rejected is exactly the current defect.
- [x] 2.3 Assert an unknown `kind` is still rejected and does not throw.

## 3. Tests

- [x] 3.1 The two cases specifically: a `cancelling` event with each
  permitted `attempted` value is accepted; one with an unrecognized
  value is not.
- [x] 3.2 A `usageReported` event carrying usage is accepted.
- [x] 3.3 Confirm the failure this fixes, at the transport: an event of
  each kind handed to `message-bridge-transport`'s own predicate is
  recognized. Without this, the fix is asserted only where it was
  written, not where it was felt.

## 4. Verification

- [x] 4.1 `openspec change validate --strict event-guard-covers-every-kind`.
- [ ] 4.2 `npm run typecheck`, `npm run lint`, `npm run test`. Read the
  whole failing-file list, not the first familiar line.
- [ ] 4.3 Version bump via `npx changeset` (`@openspec-ui/core` patch).
- [ ] 4.4 **Human-only**: cancel a running harness stage in the VS Code
  panel and confirm the status now reads "Cancelling..." while the agent
  is still finishing — the behaviour `cancel-reports-what-happened`
  shipped and no surface has ever displayed.
