## Context

`TabPanel` (`packages/webui/src/components/Tabs.tsx:49-60`) has always
rendered `children` unconditionally, toggling only the native `hidden`
attribute. Its header comment states this is deliberate: "`TabPanel`
keeps its children mounted while inactive ... so switching tabs never
discards in-progress state such as an unsaved Change Editor draft or a
live Run a Command event stream." `Tabs.test.tsx` pins this with two
tests: "hides the inactive panel but keeps it mounted" (asserts an
inactive-from-the-start panel's children ARE in the document) and
"preserves child state across tab switches" (types into a draft input,
switches away and back, asserts the value survived).

`standalone-entry.tsx` renders 7 `TabPanel`s. 6 are gated by
`{visibleTabIds.has("<id>") && (<TabPanel .../>)}` (host-embed
visibility — does the tab exist for this host at all); `run-a-command`
is always rendered unconditionally. None of this gating is keyed on
`activeTab`, so every host-visible tab's subtree mounts on the very
first render of `StandaloneApp`, regardless of whether the user has ever
clicked that tab.

Data fetching inside these tabs is, with one exception, already
lazy at the *data* level — triggered by an explicit button `onClick`
(Overview's "Load summary", Change Editor's "Load change", Templates'
"Load templates", Timeline's various "Load"/"Download" buttons), not by
a `useEffect` keyed on mount or on `activeTab`. The one exception:
`ProcessesView.tsx:45`, `useEffect(() => { void load(); }, [api])`,
fires unconditionally on mount — i.e. the moment its `TabPanel` first
renders `children` for real, which today means "the moment the whole app
loads," not "the moment the user opens Processes."

## Goals / Non-Goals

**Goals:**
- A tab's content mounts only once the user has actually opened it,
  closing `ProcessesView`'s eager-fetch gap as a direct consequence.
- The existing "switching tabs preserves in-progress state" guarantee
  (`Tabs.test.tsx`'s two pinned tests) remains true, unchanged, for
  every tab once it has been opened at least once.
- Zero behavior change for any existing caller/test that doesn't opt in
  — this is why `lazy` is an added prop with a default that reproduces
  today's exact behavior, not a change to `TabPanel`'s existing default.

**Non-Goals:**
- No change to `ChangeDiff.tsx`'s unmemoized `diffLines(before, after)`
  call. It recomputes on every re-render of the whole app once its tab
  has been opened, which is a real but *distinct* inefficiency (repeated
  recomputation, not a mount-timing problem) — today's demo-sized
  strings make it harmless, and conflating a memoization fix with a
  mount-timing change would blur what this change is actually
  responsible for. Left as a known, documented candidate for a future,
  separate simplification pass.
- No change to the Change Editor's Proposal/Design/Tasks/Specs artifact
  sub-tabs. On inspection these are not a mounted-panel-per-artifact
  pattern at all — `standalone-entry.tsx` renders one
  `<MarkdownPreview>`/`<textarea>` bound to `editorFiles[editorTab]`,
  swapping content based on which sub-tab is selected, and all four
  files are fetched together in a single "Load change" call. There is no
  per-sub-tab mount or fetch to defer.
- No change to `extension-entry.tsx` — it renders a single flat page
  (cwd/changeDir form + `AiPanel`), no `Tabs`/`TabPanel` usage at all.

## Decisions

### `lazy` is an opt-in prop on `TabPanel`, not a new default behavior

Rejected changing `TabPanel`'s existing default to always defer first
mount: `Tabs.test.tsx`'s "hides the inactive panel but keeps it mounted"
test explicitly renders two panels where one is inactive from the very
first render and asserts its children ARE already in the document —
changing the default would break that pinned, deliberate assertion and
contradict the component's own header-comment rationale, without a new
architectural reason strong enough to reopen it. An additive, default-off
prop gets the lazy-mount behavior exactly where it is wanted
(`standalone-entry.tsx`'s top-level tabs) with zero risk to the existing
contract anywhere else `TabPanel` might be used.

### "Lazy" means "defer first mount," never "unmount after"

`hasBeenActive` is a one-way latch (`useState` seeded from the initial
`isActive` value, then flipped permanently true by a `useEffect` the
first time `isActive` becomes true — never flipped back). Rejected a
design that would unmount `children` again whenever the tab becomes
inactive (a stricter, more traditional "lazy tab" that only ever renders
the currently active tab): that would reintroduce exactly the
state-loss problem `TabPanel`'s current always-mounted design exists to
prevent (an unsaved Change Editor draft, a live Run a Command event
stream) — the entire point of this change is to fix the *mount-timing*
problem without touching the *state-preservation* guarantee.

### Applied uniformly to all 7 `TabPanel`s in `standalone-entry.tsx`, including the initially-active one

Rejected special-casing `run-a-command` (the initial `activeTab`) to
omit `lazy`: since `lazy` only ever changes the timing of the *first*
mount, and `run-a-command` is already active on the very first render,
passing `lazy` there is a functional no-op — but a harmless one. Adding
it uniformly means every call site follows the same rule ("this tab's
content loads when opened") without a reader having to figure out why
one of the seven is different.

## Risks / Trade-offs

- **[Risk]** A future `TabPanel` consumer might assume the current
  always-mounted default applies universally and be surprised to learn
  `lazy` exists as an opt-in elsewhere. → **Mitigation**: documented in
  `Tabs.tsx`'s header comment and the prop's own doc comment; default
  remains unchanged, so no existing usage is affected without an explicit,
  visible `lazy` at that call site.
- **[Risk]** `ChangeDiff`'s unmemoized recomputation (left as a Non-Goal)
  could be mistaken for "already fixed" once this change ships, since
  its tab's first mount is now deferred. → **Mitigation**: documented
  explicitly here and in proposal.md as out of scope, not silently
  dropped.

## Migration Plan

- No data migration; purely additive (`lazy` prop, no default-behavior
  change) plus internal wiring in one file (`standalone-entry.tsx`).
- Version bump (minor) for `@openspec-ui/webui` (new prop, standalone
  tab-mounting behavior change).
- Rollback: revert the two file changes together; no persisted state is
  introduced.
