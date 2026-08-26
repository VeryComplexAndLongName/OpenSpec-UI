## Context

Both delivery targets already have a live event stream for the active run
(`run-controller.ts`'s emitted events in the extension, `AiPanel`'s
`transport.subscribe` in webui) and a persisted process list
(`WorkbenchProcessScheduler`), but neither surfaces a notification when a
run finishes outside the user's direct attention. The user's own framing
("launch several changes and walk away, get notified as each finishes")
is the concrete scenario this closes.

## Goals / Non-Goals

**Goals:**
- A user who starts a `plan`/`implement`/`review` run and stops watching
  the Processes view/AI panel still learns, via each host's own native
  notification mechanism, when it finishes (successfully or not).
- Zero new outbound network dependencies, credentials, or third-party
  services -- both mechanisms (VS Code's `window.show*Message`, the
  browser `Notification` API) are already part of each host's platform.
- A process already terminal when first observed (restored from the run
  journal on extension activation) never notifies -- only a genuine,
  live transition does.

**Non-Goals:**
- Not building the previously-discussed docx-report-plus-email/messenger
  delivery mechanism -- explicitly rejected in the same review session as
  a scope expansion that conflicts with this product's local-first design
  (ADR 0001; `SECURITY.md`'s "Scope" section, added a day earlier in the
  same sequence of changes): no outbound network calls, no stored
  credentials, for a tool whose standalone server already binds to
  `localhost` only. A user who wants a shareable artifact can already
  generate one manually; this change is only about a same-machine,
  same-session "you can stop watching now" signal.
- Not notifying for `status`/`list`/`show`/`validate` (deterministic,
  near-instant -- see `run-controller.ts`'s `runDirectOpenSpecCommand`)
  or for `cancelled`/`interrupted`/`rolled-back` (cancellation is almost
  always the direct result of an action the user just took; interrupted/
  rolled-back are recovery-time states from a prior session, not "the
  agent just finished while you were away").
- Not requesting browser notification permission eagerly/unprompted, and
  not attempting it at all inside the VS Code local-server iframe embed
  (`VSCODE_LOCAL_SERVER_EMBED_SIGNAL`) -- that host already gets a native
  notification from the extension side, and iframe notification
  permission is unreliable across browsers/embedding contexts.

## Decisions

### Filtering and de-duplication logic lives in a pure, host-API-free module per delivery target

`packages/extension/src/run-notifications.ts` and
`packages/webui/src/notify-run-completion.ts` contain no `vscode`/
`Notification` calls themselves -- they only decide *whether* a given
state transition is notification-worthy and *what* it should say. The
actual `vscode.window.show*Message`/`new Notification(...)` calls live in
`extension.ts`/`standalone-entry.tsx` respectively. This keeps the
decision logic unit-testable without a real extension host or browser
(see both `*.test.ts` files), and keeps `AiPanel` itself transport- and
host-neutral per ADR 0001 -- it only reports terminal events for agent
commands via the optional `onRunTerminal` prop; the host decides what, if
anything, to do with that report.

### Extension: per-process last-seen-state tracking, not a diff on `onDidChange`

`WorkbenchProcessScheduler.onDidChange` re-emits the *entire* process
list on every change, not a diff, so `RunCompletionNotifier` keeps its
own `Map<processId, WorkbenchProcessState>` and compares on each call --
seeded from `scheduler.list()` at construction time, before the listener
is registered, so processes already terminal when the extension activates
(including ones the scheduler's own constructor just marked
`"interrupted"` from a prior session) are never mistaken for a fresh
completion.

### Standalone: a ref for the active run's command kind, not the `commandKind` state value

`AiPanel`'s command-kind dropdown is a piece of UI state (`commandKind`)
separate from which command the *currently in-flight* run was actually
started with. A ref (`activeCommandKindRef`, set alongside the existing
`runIdRef` in `runCommand`) captures the true value at run-start time,
avoiding any ambiguity if the dropdown's state ever changes for unrelated
reasons while a run is in flight.

## Risks / Trade-offs

- **[Risk]** Browser notification permission, once denied by the user,
  cannot be silently re-requested -- some users will simply never see
  standalone notifications. → **Mitigation**: this is inherently a
  best-effort enhancement layered on top of the always-available
  Processes view/AI panel, not a replacement for either; permission is
  requested lazily (on first notifiable event) rather than demanded
  upfront, so declining it costs nothing beyond not getting this one
  convenience.
- **[Risk]** A user running many changes in parallel could see a burst of
  native notifications in a short window. → **Mitigation**: out of scope
  for this change (no batching/digest); notifications are already scoped
  tightly (three command kinds, two terminal states only), and VS Code/
  browsers both already provide their own notification-center history if
  one is missed or dismissed quickly.
