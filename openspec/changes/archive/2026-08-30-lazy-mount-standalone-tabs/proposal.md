## Why

`TabPanel` (`packages/webui/src/components/Tabs.tsx:49-60`) deliberately
keeps every tab's children mounted at all times (native `hidden`
attribute, never conditional rendering) so switching tabs never discards
in-progress state — a documented, test-pinned decision from
`openspec/changes/archive/2026-08-17-standalone-shell-host-aware-tabs/`.
A side effect nobody addressed since: every host-visible top-level tab in
`standalone-entry.tsx` (Run a Command / Processes / Diff Preview /
OpenSpec view summary / Change Editor / Templates / Timeline) mounts on
the very first render of the whole app, whether or not the user ever
opens it. The concrete, reproducible cost is
`packages/webui/src/components/ProcessesView.tsx:45`'s
`useEffect(() => { void load(); }, [api])`, which fires a real
`api.list()` fetch the instant the app loads — as soon as `cwd` is
non-empty (which can be immediately, from a restored `localStorage`
value) — even if the user never clicks "Processes and Recovery." This
was raised in the improvement backlog as "tabs should load only when
opened"; the literal Specs/Design/Tasks case (the Change Editor's
artifact sub-tabs) turned out to already be efficient on inspection — a
single `<MarkdownPreview>`/`<textarea>` swaps content for whichever
`editorTab` is selected, and all four files are fetched together in one
"Load change" call, not per sub-tab — so this change targets the actual
gap instead: the top-level tabs.

## What Changes

- `TabPanel` gains an opt-in `lazy?: boolean` prop (default `false` —
  every existing caller/test is unaffected unless it opts in). When
  `lazy` is true, a panel's `children` are not rendered until that panel
  has been the active tab at least once; after that first activation, it
  behaves exactly like today's default (stays mounted, just hidden via
  `hidden`) for the rest of the session — the existing
  switch-preserves-state guarantee is untouched, since `lazy` only
  changes *when* the first mount happens, never causes an unmount
  afterward.
- `standalone-entry.tsx` passes `lazy` to all 7 `<TabPanel>` usages
  (including `run-a-command`, where it is a functional no-op since that
  tab is the initial `activeTab` default and so mounts immediately
  either way — applied uniformly rather than special-cased, so there is
  no per-tab judgment call to justify at each call site).
- No change to `ProcessesView.tsx`/`ChangeDiff.tsx` themselves — both
  already only start their real work once actually mounted, so gating
  their `TabPanel`'s first mount is sufficient on its own to defer
  `ProcessesView`'s fetch until the Processes tab is actually opened.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `standalone-app`: top-level tabs now defer mounting their content
  until first opened, instead of mounting on app load; the existing
  "switching tabs preserves in-progress state" guarantee is unchanged
  once a tab has been opened.

## Impact

- `packages/webui/src/components/Tabs.tsx` (`lazy` prop, `TabPanel`
  implementation, header comment).
- `packages/webui/src/components/Tabs.test.tsx` (new cases for `lazy`).
- `packages/webui/src/standalone-entry.tsx` (pass `lazy` to all 7
  `TabPanel` usages).
- No change to the command/event protocol, to `packages/core`, to
  `packages/server`, or to `packages/extension` (`extension-entry.tsx`
  does not use `Tabs`/`TabPanel` at all today).
