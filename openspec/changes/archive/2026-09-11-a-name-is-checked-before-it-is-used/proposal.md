# A name is checked before it is used

## Why

Found by the code review of 2026-09-10 over the work merged between
`57fe223` and `8cfd92c`. Three places take a name from outside the
process and use it before anything checks its shape.

**A change name from a message decides where a file is written.**
`changeHarnessConfigPath` (`packages/core/src/harness-config.ts:697`) is a
bare `path.join(workspaceRoot, "openspec", "changes", changeName,
"harness.json")`. The VS Code bridge (`packages/extension/src/webview/
ai-panel.ts:431-437`) and the REST route (`packages/server/src/rest.ts:
1249-1278`) both pass the name straight through; the REST guard checks
only that it is a non-empty string. A message naming
`../../../../Users/me/.claude` writes `harness.json` there. The contents
are constrained to a valid harness configuration; the location is not.
The bridge's own header says a message must not be able to say what gets
read or written, and this one can. `workbench.ts:44` already has the
pattern every other path builder applies, and this one does not apply it.

**A schedule entry is stored without being read.** `/api/scheduled-runs`
(`rest.ts:1060-1064`) validates only `cwd`; `add` is appended to
`.openspec-ui/scheduled-runs.json` as sent. `readScheduledRuns` later
filters through `isScheduledRun`, so the response and the file disagree:
`{cwd, add: {changeName: 5}}` answers 200 with the junk row and the next
read returns nothing. A body carrying both `add` and `remove` applies
one and ignores the other silently.

**A custom agent name reaches the command line unchecked.** `customAgent`
is accepted as any non-blank string (`harness-config.ts:396`) and pushed
as `--agent <value>` by four adapters. `model` is guarded by
`MODEL_ID_PATTERN` (`harness-step-agent.ts:68`) precisely so a value
cannot start with `-` and be read as a second flag. A change's
`harness.json` is repository content, and `customAgent:
"--dangerously-skip-permissions"` passes validation today. Whether the
CLI's parser treats it as a value or a flag is left to the CLI, not to the
security model this repository states.

## Capabilities

### Modified

- A change name from a request is refused before it becomes a path, in
  core, so every host inherits the refusal.
- A schedule entry is validated on the way in, and a body asking for two
  operations at once is refused rather than half-applied.
- A custom agent name obeys the same shape rule as a model name, for the
  same reason.

## Out of scope

Any change to what a valid harness configuration contains. Only where it
is written and what names may be used to say so.
