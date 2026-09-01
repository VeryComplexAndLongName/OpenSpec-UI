## 1. Auto-load

- [ ] 1.1 `packages/webui/src/components/AiPanel.tsx`: add a
  `const autoLoadedCwdRef = useRef<string | null>(null);` next to the
  existing refs (`runIdRef`, `activeCommandKindRef`, around line 767).
- [ ] 1.2 `packages/webui/src/components/AiPanel.tsx`: add one
  `useEffect` **after** the existing `transport.subscribe(...)` effect
  (the one starting at line ~786) and **not before it** — see design.md,
  "The auto-load effect must be declared after the `transport.subscribe`
  effect". Body: if `cwd` is an empty string, return; if
  `autoLoadedCwdRef.current === cwd`, return; if `isRunning` is true,
  return; otherwise set `autoLoadedCwdRef.current = cwd` and call
  `runCommand("list")`. Dependency array: `[cwd, isRunning]`.
- [ ] 1.3 `packages/webui/src/components/AiPanel.tsx`: change the
  button's label text at line ~867 from `Load changes` to
  `Reload changes`. Do **not** change its `data-testid`
  (`load-changes-button`), its `onClick` handler, or its `disabled`
  condition — only the visible text.

## 2. Tests

- [ ] 2.1 `packages/webui/src/components/AiPanel.test.tsx`: new test —
  rendering `AiPanel` with a non-empty `cwd` sends exactly one command
  with `kind: "list"` through the transport, with no click.
- [ ] 2.2 `packages/webui/src/components/AiPanel.test.tsx`: new test —
  rendering with `cwd=""` sends no command; then re-rendering with a
  non-empty `cwd` sends exactly one `list` command.
- [ ] 2.3 `packages/webui/src/components/AiPanel.test.tsx`: new test —
  a re-render that does not change `cwd` does not send a second `list`
  command (asserts the `autoLoadedCwdRef` guard).
- [ ] 2.4 `packages/webui/src/components/AiPanel.test.tsx`: new test —
  the change picker becomes populated after the auto-load's `stdout`
  event arrives, with no click on the button.
- [ ] 2.5 `packages/webui/src/components/AiPanel.test.tsx`: existing
  tests that click `load-changes-button` must still pass unchanged
  (the button keeps its testid and handler) — do not rewrite them.

## 3. Verification

- [ ] 3.1 `openspec change validate --strict ai-panel-auto-load-changes`.
- [ ] 3.2 `npm run typecheck --workspace @openspec-ui/webui` and
  `npm run lint --workspace @openspec-ui/webui` — both clean.
- [ ] 3.3 `npm run test --workspace @openspec-ui/webui` — all green.
- [ ] 3.4 `openspec/specs/command-output-hub/spec.md` delta (already
  written in this change's `specs/` directory — confirm it still matches
  the implemented behavior, do not rewrite it).
- [ ] 3.5 Version bump via `npx changeset` (`@openspec-ui/webui` patch;
  add `openspec-ui-vscode` only if the extension's own source changed,
  which it should not for this change).
- [ ] 3.6 **Human-only, cannot be completed by an implementing agent**:
  live smoke test — open the AI panel in a real VS Code Extension
  Development Host, confirm the change picker is populated with no click
  and that "Reload changes" still re-reads. Leave unchecked if you are
  an agent; report it as outstanding instead of marking it done.
