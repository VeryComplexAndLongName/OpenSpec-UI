## 1. `Tabs.tsx`: opt-in lazy mounting

- [x] 1.1 `packages/webui/src/components/Tabs.tsx`: added `lazy?: boolean`
  to `TabPanelProps` (default `false`); `TabPanel` tracks `hasBeenActive`
  via `useState(isActive)` seeded at mount, latched permanently true by
  a `useEffect` the first time `isActive` becomes true; renders
  `children` when `!lazy || hasBeenActive`, otherwise `null` (wrapping
  `<div>`/testid always renders regardless). Updated the header comment
  to describe both the default (always mounted) and `lazy` (deferred
  first mount, then identical) modes.
- [x] 1.2 `Tabs.test.tsx`: added 3 new cases — a `lazy` panel not yet
  activated has no children in the document; switching to it mounts the
  children and switching away again leaves them mounted (just `hidden`);
  a `lazy` panel that is already the initial `activeTab` mounts its
  children immediately, and preserves in-progress child state across a
  subsequent switch away and back (reused the existing "Draft" harness
  pattern). Existing (non-`lazy`) test cases unmodified. 10/10 passing.

## 2. Wire `lazy` into the standalone app

- [x] 2.1 `packages/webui/src/standalone-entry.tsx`: passed `lazy` on all
  7 `<TabPanel>` usages (`run-a-command`, `processes`, `diff-preview`,
  `overview`, `change-editor`, `templates`, `timeline`).

## 3. Spec, versioning, verification

- [x] 3.1 `openspec/changes/lazy-mount-standalone-tabs/specs/standalone-app/spec.md`:
  `MODIFIED Requirements` for "Standalone shell exposes its sections as
  tabs" — full requirement text plus new scenarios for deferred first
  mount and preserved state after a tab has been opened once.
- [x] 3.2 `npm run typecheck && npm run lint && npm run test`
  workspace-wide (after `git add`): typecheck and lint (including
  `lint:english`) clean across all packages. Tests: 512 passing across
  core/cli/extension/webui, plus the Playwright e2e suite in
  `packages/server/e2e/standalone.spec.ts` (Overview → Change Editor →
  save, unmodified) — passing. `packages/server`'s own vitest suite: 48/49
  passing, with the same pre-existing, unrelated Windows temp-directory
  cleanup race in its WebSocket tests already documented against the
  previous change (`changes-overview-search`) — confirmed unrelated
  again here (different WebSocket test failed this run; the change
  touches no server code at all).
- [x] 3.3 Added `.changeset/lazy-mount-standalone-tabs.md` — minor bump
  for `@openspec-ui/webui`; verified with `npx changeset status`.
- [x] 3.4 Manual smoke test: ran the real standalone server and drove it
  with a real Chromium instance (Playwright) against a fresh temporary
  workspace, recording every `/api/processes/*` request. Confirmed zero
  such requests after filling in the workspace root and waiting, then a
  request to `/api/processes/list` appears immediately after clicking
  "Processes and Recovery." Separately re-ran the standalone e2e test
  (Change Editor draft persists across a save + reload flow) to confirm
  no regression in state preservation.
- [x] 3.5 `openspec change validate --strict lazy-mount-standalone-tabs`
  — "Change "lazy-mount-standalone-tabs" is valid".
