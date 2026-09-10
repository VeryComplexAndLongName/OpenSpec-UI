Three inputs that arrive from outside the process and are used before
their shape is read. All three are closed in core.

## 1. A change name cannot leave the workspace

- [x] 1.1 `changeHarnessConfigPath` in `packages/core/src/harness-config.ts`
  calls `assertValidChangeName` before joining the path. The assertion was
  already exported from `workbench.ts`, but its definition moved to a new
  leaf module `packages/core/src/change-name.ts` with no Node imports, so
  the pure half of core (`scheduled-runs.ts`, and the browser bundle built
  from it) applies the same rule; `workbench.ts` re-exports it, so every
  existing import still resolves. It now throws `InvalidChangeNameError`
  rather than a bare `Error`, so a host can answer 400 rather than 500,
  and the message names the rule the name broke.

  Premise correction: `readChangeHarnessConfig` was being called with
  `archive/<dated-name>` as the "change name" — the repository-wide load
  test in `harness-config.test.ts` did exactly that for the 11 archived
  `harness.json` files, which is the defect this task closes rather than
  a use to preserve. `readChangeHarnessConfig` now takes an optional
  `location` (`"active"` | `"archive"`), the same split `workbench.ts`'s
  `changePath` already makes, so a change name stays one path segment.
- [x] 1.2 The bridge (`packages/extension/src/webview/ai-panel.ts`,
  `harness/read-change-override` and `harness/write-change-override`)
  replies `ok: false` with the refusal's message. No file is touched.

  Premise correction: no bridge code was needed. `answerRequest` already
  wraps both operations in a `try`/`catch` that replies `ok: false` with
  the error's message, so the refusal from core reaches the webview
  unchanged the moment core throws. Covered by the tests in 4.2 rather
  than by an edit.
- [x] 1.3 The REST route `handleHarnessConfigWriteRequest` answers 400
  with the refusal's message. Confirmed the read route behaves the same:
  `handleHarnessConfigReadChangeOverrideRequest` and
  `handleHarnessConfigResolveRequest` both catch `InvalidChangeNameError`
  before the `InvalidHarnessConfigError` (422) branch and answer 400.
- [x] 1.4 Grepped every other `path.join(..., changeName, ...)` in core.
  Found, outside tests:
  - `workbench.ts:changePath` — asserts. Unchanged.
  - `change-editor-store.ts:artifacts` — asserts, but with its own
    private `assertChangeName` (`/^[a-z0-9][a-z0-9-]*$/i`, no dot or
    underscore, case-insensitive). Stricter on separators than the
    shared rule and so not a traversal, but a second rule for the same
    thing. Left alone deliberately: unifying the two changes which names
    the change editor accepts, which is out of this change's scope
    ("only where it is written and what names may be used to say so").
  - `harness-config.ts:changeHarnessConfigPath` — the one this change
    fixed.
  Every other core path built from a change is built from a `changeDir`
  the host already resolved (`change-state.ts`, `harness-chain-runner.ts`,
  `change-timeline.ts`), not from a name off the wire.

## 2. A schedule entry is read before it is stored

- [x] 2.1 `handleScheduledRunsRequest` in `packages/server/src/rest.ts`
  validates `add` with core's `describeScheduledRunProblem`, the
  validator `isScheduledRun` is now built from — so the route applies
  exactly the rule the reader trusts. It covers `changeName` (the shared
  change-name rule), `path` (a real `RunPathId`) and a parse check on
  `startAt` and `requestedAt`. A failing body is a 400 whose message
  begins with the field. `remove` is checked the same way: a malformed
  one matches nothing and would otherwise answer 200 having done nothing.
- [x] 2.2 A body carrying both `add` and `remove` is a 400, and nothing
  is applied.
- [x] 2.3 `isScheduledRun` is exported from core — moved out of
  `scheduled-runs-file.ts` (Node-only) into `scheduled-runs.ts` (pure),
  so it reaches the browser surface too, and strengthened to the rule
  above. The route does not restate it.

## 3. A custom agent name has a shape

- [x] 3.1 `validateStepAgent` checks `customAgent` against
  `MODEL_ID_PATTERN`, with a message that says the value must not begin
  with `-` and which characters are accepted.
- [x] 3.2 `findCustomAgents` marks a definition whose file name would be
  refused: the entry comes back carrying a `refused` message rather than
  being dropped, and the standalone picker
  (`HarnessSettingsView.tsx`) lists it as found-but-not-offered instead
  of offering a name the save would then refuse.
- [x] 3.3 `HARNESS.md`, the `customAgent` row: states the shape rule and
  that it is the model's, and the discovery paragraph below it says a
  refused file name is reported rather than dropped.

## 4. Tests

- [x] 4.1 Core (`harness-config.test.ts`, "a change name that would leave
  the workspace"): a traversal change name is refused by
  `writeChangeHarnessConfig` and `readChangeHarnessConfig`, the refusal
  names the rule, and the temporary root beside the workspace is
  asserted to be empty — nothing was written anywhere.
- [x] 4.2 Bridge (`ai-panel.test.ts`): `harness/write-change-override`
  with a traversal name replies `ok: false` naming the rule, and
  `harness/read-change-override` does the same.
- [x] 4.3 Server (`server.test.ts`): the harness write route answers 400
  for a traversal name and no file appears beside the workspace; the read
  route answers 400 for the same name; the scheduled-runs route answers
  400 for a malformed `add` (naming the field), for a traversal
  `changeName`, and for `add` beside `remove` — the last two also
  asserting the schedule stayed empty.
- [x] 4.4 Core: `customAgent: "--dangerously-skip-permissions"` is
  refused; `"review-2.0_beta:1"` — every character class a model id may
  carry — is accepted and round-trips.
- [x] 4.5 Contract test between webui and server for the schedule route
  (`packages/server/src/scheduled-runs-contract.test.ts`): the real
  `scheduled-runs-client.ts` from `webui` drives the real server over
  HTTP, so neither half's body is hand-written. `@openspec-ui/webui` was
  added to `server`'s devDependencies for it, with `package-lock.json`
  regenerated by `npm install --package-lock-only`.

## 5. Verification

- [x] 5.1 `openspec validate --strict --changes` — 9 passed, 0 failed.
- [x] 5.2 `npm run verify` unpiped (redirected to a log, exit code read
  from `$?`), after the last edit, with the new files staged. Exit 0.
  Test counts: root `check-english` 4, root `check-test-budgets` 10,
  `@openspec-ui/cli` 48 in 4 files, `@openspec-ui/core` 846 in 61 files,
  `openspec-ui-vscode` 314 in 24 files, `@openspec-ui/server` 79 in 4
  files, `@openspec-ui/webui` 346 in 41 files.
- [x] 5.3 Changeset added: `.changeset/brown-pianos-refuse.md` —
  `@openspec-ui/core` minor, `@openspec-ui/server` minor,
  `@openspec-ui/webui` patch, `openspec-ui-vscode` patch. `webui` is in
  the list because the custom-agent picker changed (3.2); the extension
  has no source edit of its own but inherits the refusal from core.
- [ ] 5.4 **Delegated to copilot-cli**: in the VS Code integration suite
  (`packages/extension/src/test/suite/extension.test.ts`, which runs a
  real VS Code host), open the settings view for a change through the
  bridge, read the per-change override, save it, and assert the file
  round-trips unchanged. Evidence to record here: the test name and the
  run that passed.
