# Design

## Context

`openspec-ui.runWithHarness` already resolves the config Node-side and
calls `buildRunPlan` before showing anything. What it does with the
result is the only thing changing: today `pickRunPath` renders it as a
quick-pick, and the panel it reveals afterwards never sees the plan.

The panel is `AiPanel` (`webview/ai-panel.ts`), which loads the `webui`
bundle and receives a `DashboardContext` — first baked into the initial
HTML, then as follow-up messages. `extension-entry.tsx` already switches
which component mounts on `startChain`.

## Decision: the plan travels as context, the choice comes back as a message

The plan is built where it is built now, on the host, and is delivered in
`DashboardContext`. Nothing about the resolution moves into the browser:
the browser cannot read `agent-harness.json`, the audit log, or the task
list, and the run-plan code is deliberately host-side.

A choice comes back as one message rather than as four. `RunDialog`
already reports a chosen path and an applied configuration through two
callbacks; the entry turns both into `openspec-ui/run-choice`.

## Decision: applying a configuration is done by the host

The dialog can apply a named configuration, which means a write. In the
standalone shell that write is an HTTP route; in the panel there is no
server, and the bridge carries `Command` and `Event`, not file writes.

So the webview posts the configuration's **id** and the host writes it,
through the same `templateConfigToWrite` both hosts already share. The id
rather than the object: the host has the list, and taking a
configuration's contents from the webview would let a message decide what
gets written to a file.

After the write the host rebuilds the plan and posts a fresh context, so
the dialog shows what the file now resolves to rather than what it read
before the write — the same re-read the standalone shell does.

## Decision: two paths are answered in the webview, one on the host

`Run the chain` and `Run one stage` only decide which component mounts,
and both components are already in the bundle beside the dialog. Sending
a message so the host can send a context back to mount them would be a
round trip to change a local variable.

`Implement with the VS Code agent` opens a chat session, which only the
host can do, so that one posts a message.

## Decision: the quick-pick goes, rather than staying as a fallback

Keeping both would mean two dialogs that must agree, and the one that
truncates is the one a person would keep seeing wherever the panel failed
to open. `pickRunPath` and its truncation helper are deleted with it.

The single-stage picker and the chain panel are untouched: they are what
the dialog dispatches to, and they already work.

## Rejected: a native VS Code webview of its own

A second panel would need its own bundle entry, its own bridge, its own
theme wiring and its own disposal rules — all of which the AI panel
already has, and all of which would then exist twice.
