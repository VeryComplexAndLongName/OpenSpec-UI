## Context

`AiPanel` receives `cwd` as a prop (`AiPanel.tsx:753`) — in the extension
host it arrives via the webview's `postMessage`/dataset context, so it can
be empty on the very first render and become valid a moment later. The
panel already has an effect that registers `transport.subscribe(...)`
(`AiPanel.tsx:786`), and `availableChanges` is populated only from a
`list` run's `stdout` events parsed by `parseChangeNamesFromStdout`.

## Goals / Non-Goals

**Goals:**

- Opening the panel leaves the change picker usable, with no click.
- Keep an explicit way to re-read changes that appeared on disk after the
  panel opened.

**Non-Goals (this change):**

- Auto-running anything other than `list`. `plan`/`review`/`implement`
  stay strictly user-initiated — they cost real agent credits and mutate
  the repository; only the pure-read `list` is auto-run.
- Live-watching `openspec/changes/` for filesystem changes and refreshing
  automatically. That is a bigger feature (a watcher, debouncing, and a
  decision about what to do when the selected change disappears
  mid-session) and is not needed to remove the click this change is
  about.
- Any change to the standalone shell's own change list, which is a
  separate surface with its own loading path.

## Decisions

### Auto-run `list` from an effect keyed on `cwd`, not on mount

Chosen: an effect that runs `list` when `cwd` first becomes non-empty,
guarded so it fires at most once per `cwd` value.

**Rejected alternative**: run it unconditionally on mount. Rejected — in
the extension host, the first render can happen before the context
message carrying `cwd` arrives, so a mount-only call would fire with an
empty `cwd` and either fail or list the wrong directory. Keying on `cwd`
is what makes it correct in both delivery targets (the standalone shell
has `cwd` immediately; the extension may not).

### The auto-load effect must be declared after the `transport.subscribe` effect

React runs effects in declaration order, and `availableChanges` is only
populated by events arriving on the subscription. If the `list` command
were sent before the subscription existed, its `stdout` could be missed
and the picker would stay empty — the exact bug this change is meant to
remove, in a harder-to-see form. The ordering is therefore load-bearing,
not cosmetic.

### The button stays, as "Reload changes"

**Rejected alternative**: remove the button entirely once loading is
automatic. Rejected — the set of changes on disk genuinely changes while
the panel is open (this repository routinely has a second agent creating
changes concurrently), and there is no filesystem watcher (see
Non-Goals). Removing the only manual re-read would trade one friction for
a worse one: a stale picker with no way to refresh short of reopening the
panel.

### Never auto-load while a run is in flight

The effect does nothing if a run is already active. A `list` fired into
an in-flight run would reset `events`/`runId` (see `runCommand`) and
visually clobber output the user is watching.

## Risks / Trade-offs

- **[Trade-off]** One extra `openspec list` subprocess per panel open.
  Accepted: it is exactly the call the user was making manually anyway,
  every time, and it is a pure read.
- **[Risk]** A panel opened directly into a chain (`startChain`) could
  race an auto-load against the chain's own first run. → **Mitigation**:
  the "never auto-load while a run is in flight" guard above, plus a test
  asserting no `list` command is sent when the panel mounts with a run
  already active.

## Migration Plan

No migration. Behavior-only change inside one component; no persisted
state, no protocol change, no config.
