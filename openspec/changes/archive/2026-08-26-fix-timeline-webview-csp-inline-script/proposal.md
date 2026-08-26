## Why

The user reported "No timeline data" in every timeline webview (both
the single-change command from `2026-08-26-add-change-timeline-view`
and the comparison command from
`2026-08-26-add-multi-change-timeline-view`) after installing the real
extension. Root cause: `TimelineWebviewPanel`'s CSP
(`script-src ${webview.cspSource}`) does not include `'unsafe-inline'`
or a nonce, so the browser silently blocks the inline
`<script>window.__OPENSPEC_UI_TIMELINE__ = ...;</script>` tag used to
embed the already-fetched data — the external `<script src=...>` tag
loading the bundle still matches `script-src` and runs fine, so the
page renders (React mounts, the "No timeline data." fallback shows),
masking the failure instead of erroring visibly. Every smoke test
performed while building both prior changes loaded the built bundle in
a bare Playwright page with no CSP at all, which never exercised this
code path — the exact gap this change's own verification specifically
targets.

## What Changes

- Add a random nonce per `getHtml()` call
  (`randomBytes(16).toString("base64")`), included in the CSP as
  `script-src ${webview.cspSource} 'nonce-${nonce}'` and on the inline
  data-injection `<script nonce="${nonce}">` tag. A nonce, not a
  blanket `'unsafe-inline'`, authorizes only this one inline script —
  keeping CSP's protection against injected scripts intact everywhere
  else on the page, per the [Content Security Policy nonce
  pattern](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/script-src#unsafe_inline_script)
  VS Code's own webview guidance recommends for exactly this scenario.
- Add `packages/extension/src/webview/timeline-panel.test.ts`: asserts
  the nonce appears in both the CSP and the inline script tag, that
  `'unsafe-inline'` is never used for `script-src`, that each panel
  gets a distinct nonce, and that the existing `</script>`-injection
  escaping still holds.
- No spec text change: `openspec/specs/vscode-extension/spec.md`'s
  existing Requirements (added by the two prior changes) already
  describe the intended behavior correctly — the code just failed to
  satisfy it. `.openspec.yaml` sets `skip_specs: true`.

## Capabilities

### Modified Capabilities

(none in the specified-behavior sense — restores already-specified
behavior; `.openspec.yaml` sets `skip_specs: true`)

## Impact

- `packages/extension/src/webview/timeline-panel.ts`
- `packages/extension/src/webview/timeline-panel.test.ts` (new)
- `.changeset/*.md` (new changeset file)
