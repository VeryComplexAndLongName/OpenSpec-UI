## Standalone (real browser, real server)

Built the client bundle (`npm run build --workspace @openspec-ui/server`)
and started the real server against this repository's own workspace root
(`npx tsx src/cli.ts C:/Prog/OpenSpec-UI 4700`), then drove it with a real
browser tab (not a mock):

- Filled Workspace root/Change directory, which mounted `<AiPanel>` and
  triggered the `useEffect`-driven detection call automatically.
- The agent picker's real options, read from the live DOM:
  ```
  Claude CLI (detected)
  GitHub Copilot CLI (detected)
  Codex CLI (not detected)
  Gemini CLI (not detected)
  Local LLM (OpenAI-compatible) (not detected)
  ```
  All five options remained present and selectable — none hidden or
  disabled, confirming "annotate, don't filter" end to end.
- `read_network_requests` confirmed two real `POST /api/agents/detect →
  200 OK` calls: one from the automatic on-mount detection, one from
  manually clicking "Refresh agents". No console errors either time.
- **Live confirmation of a design-doc risk, not just a theoretical one**:
  an earlier direct-`tsx` invocation of `detectAvailableAgents()` in a
  different shell (this agent's own Bash tool subprocess) reported
  `copilot-cli: false`, while the real server process (started the same
  way `cli.ts` starts in production) reported `copilot-cli: true`. Same
  machine, different process `PATH` — exactly the scenario design.md's
  Non-Goals section calls out for why detection is never cached across
  hosts/processes and why undetected agents are never hidden (a false
  negative here would have wrongly hidden a real, working CLI).
- Stopped the smoke-test server processes afterward (own orphaned
  background processes; nothing pre-existing was touched).

## VS Code extension (real `@vscode/test-electron`, not mocked)

`npm run test:integration --workspace openspec-ui-vscode` — genuinely
launches a VS Code Extension Development Host. All 6 integration tests
passed, including `"opens the context-aware Process Dashboard webview"`
and `"runs a real status command..."`, both of which exercise
`AiPanel.reveal()` (and therefore the new `detectAndPostAgents()` call)
without throwing or hanging. This confirms the detection wiring doesn't
break panel creation/reveal in a real VS Code host.

**Gap**: the integration suite doesn't assert on the webview's *DOM*
(no webview-content driver in this environment, same limitation noted in
`agent-selection`'s smoke-test-notes.md) — so the actual appearance of
the "(detected)"/"(not detected)" suffix and the follow-up `postMessage`
inside a live VS Code Webview specifically were verified by the unit
tests in `ai-panel.test.ts` (mocked `vscode`/`@openspec-ui/core`, real
promise-timing assertions) rather than by this live run. The standalone
smoke test above exercises the identical `AiPanel`/`detectedAgents`
rendering code path used by both hosts.
