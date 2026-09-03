One defect, three symptoms. The change, the stage and the agent all come
from facts the host already sends; the panel just never reads them. Do
not add a new message to carry what `changeDir` and `stepAgents` already
carry.

## 1. The panel uses what it is given

- [ ] 1.1 `packages/webui/src/components/AiPanel.tsx`: seed the selected
  change from the `changeDir` prop's last path segment. The existing
  effect that reconciles the selection against the loaded change list
  must keep working — it already preserves a current selection that
  appears in the list, which is exactly the case a seed creates.
- [ ] 1.2 Same file: accept an optional initial command kind from the
  host, defaulting to today's `list`. A host that names no change has
  nothing to run and `list` remains right for it.
- [ ] 1.3 Do **not** touch the agent pre-selection effect. It already
  reads `stepAgents` through `COMMAND_KIND_TO_HARNESS_STAGE`; with the
  kind seeded to `implement` it resolves `apply` and selects the
  configured agent on its own. Confirm this rather than adding a second
  path to the same answer.

## 2. The host says why it opened the panel

- [ ] 2.1 `packages/extension`: opening the panel from
  `openspec-ui.runWithHarness` seeds `implement`. Every other reveal
  keeps `list`.
- [ ] 2.2 Carry it the way `startChain` is already carried — the panel
  context, not a new message kind. Two mechanisms for "why was this
  panel opened" is one more than the question needs.
- [ ] 2.3 The chain path is untouched: a config resolving to `chain`
  mounts `HarnessChainPanel`, which has nothing to pre-select.

## 3. Nothing is enforced

- [ ] 3.1 Every seeded value stays editable. The agent picker is a
  recommendation by existing decision ("Annotate, don't filter"); the
  change and the command kind are now the same.
- [ ] 3.2 A seeded change that turns out not to exist in the loaded list
  must not wedge the panel — it falls back to the existing selection
  behaviour rather than leaving a value the user cannot act on.

## 4. Tests

- [ ] 4.1 `AiPanel.test.tsx`: given a `changeDir`, that change is
  selected before any list has loaded, and stays selected once the list
  arrives containing it.
- [ ] 4.2 Same: given the seeded `implement` kind and a `stepAgents`
  entry for `apply`, the agent picker shows that agent — asserting the
  consequence in task 1.3, not a re-implementation of it.
- [ ] 4.3 Same: with no seed, the panel behaves exactly as before —
  `list`, no change, default agent. This is the path every other entry
  point uses.
- [ ] 4.4 `packages/extension`: `runWithHarness` reveals the panel with
  the seed; another reveal does not.

## 5. Verification

- [ ] 5.1 `openspec change validate --strict run-with-harness-prefills-the-run`.
- [ ] 5.2 `npm run typecheck`, `npm run lint`, `npm run test` — green
  across all five workspaces.
- [ ] 5.3 Version bump via `npx changeset` (`@openspec-ui/webui` and the
  extension).
- [ ] 5.4 **Human-only**: right-click a change, Run with Agentic Harness,
  and confirm the change, `implement`, and the configured agent are all
  already selected — and that changing any of them still works.
