---
"@openspec-ui/core": patch
---

Let every event kind survive a transport — `cancelling` and `usageReported` were being dropped.

`isEvent()` switches on `kind` and ends in `default: return false`, so a kind added to `EventKind` and to the `Event` union compiles cleanly while the guard silently rejects it. Two kinds had already gone through that gap: the VS Code webview discarded them (`message-bridge-transport` gates on `isEvent`) and the standalone app discarded them too (`fetch-transport`'s `deserializeEvent` throws inside a conservative `catch {}`). Nothing logged, nothing failed.

Both shipped features built on those events were therefore inert over both transports: the "Cancelling..." status from `cancel-reports-what-happened`, and the usage display from `usage-from-acp`. Recording and budget enforcement were unaffected — `agent-runner.ts` consumes the event in-process, never through a transport.

The samples in `protocol.test.ts` are now a `Record<EventKind, Event>`, so adding a kind without a guard case is a compile error rather than something to remember.
