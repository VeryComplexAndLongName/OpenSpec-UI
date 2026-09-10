Three inputs that arrive from outside the process and are used before
their shape is read. All three are closed in core.

## 1. A change name cannot leave the workspace

- [ ] 1.1 `changeHarnessConfigPath` in `packages/core/src/harness-config.ts`
  calls `assertValidChangeName` before joining the path. Export the
  assertion from `workbench.ts` if it is not already reachable.
- [ ] 1.2 The bridge (`packages/extension/src/webview/ai-panel.ts`,
  `harness/read-change-override` and `harness/write-change-override`)
  replies `ok: false` with the refusal's message. No file is touched.
- [ ] 1.3 The REST route `handleHarnessConfigWriteRequest` answers 400
  with the refusal's message. Confirm the read route behaves the same.
- [ ] 1.4 Grep every other `path.join(..., changeName, ...)` in core and
  confirm each goes through the assertion. List what was found in the
  task's closing note.

## 2. A schedule entry is read before it is stored

- [ ] 2.1 `handleScheduledRunsRequest` in `packages/server/src/rest.ts`
  validates `add` with the same `isScheduledRun` the reader trusts, plus
  `assertValidChangeName` on `changeName` and a parse check on `startAt`
  and `requestedAt`. A failing body is a 400 naming the field.
- [ ] 2.2 A body carrying both `add` and `remove` is a 400.
- [ ] 2.3 `isScheduledRun` is exported from core, so the route does not
  restate it.

## 3. A custom agent name has a shape

- [ ] 3.1 `validateStepAgent` checks `customAgent` against
  `MODEL_ID_PATTERN`, with a message that says the value must not begin
  with `-` and which characters are accepted.
- [ ] 3.2 `findCustomAgents` skips a definition whose file name would be
  refused, reporting it in the result rather than dropping it silently.
- [ ] 3.3 `HARNESS.md`, the `customAgent` row: state the shape rule and
  that it is the model's.

## 4. Tests

- [ ] 4.1 Core: a traversal change name is refused by
  `writeChangeHarnessConfig` and `readChangeHarnessConfig`, and no file
  appears outside the workspace.
- [ ] 4.2 Bridge: `harness/write-change-override` with a traversal name
  replies `ok: false`.
- [ ] 4.3 Server: the harness write route answers 400 for a traversal
  name; the scheduled-runs route answers 400 for a malformed `add`, for
  a traversal `changeName`, and for `add` beside `remove`.
- [ ] 4.4 Core: `customAgent: "--flag"` is refused; a name with the same
  characters a model may carry is accepted.
- [ ] 4.5 Contract test between webui and server for the schedule route,
  since its accepted body changed.

## 5. Verification

- [ ] 5.1 `openspec validate --strict --changes`.
- [ ] 5.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run.
- [ ] 5.3 Version bump via `npx changeset` for core, server and the
  extension.
- [ ] 5.4 **Human-only**: in VS Code, open the settings view for a change
  and confirm the per-change override still reads and saves.
